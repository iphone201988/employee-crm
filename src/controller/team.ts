import { NextFunction, Request, Response } from "express";
import { FeatureAccessModel } from "../models/FeatureAccess";
import { PermissionModel } from "../models/Permission";
import { UserModel } from "../models/User";
import { LoginRequest } from "../types/request/types";
import { BadRequestError } from "../utils/errors";
import { SUCCESS } from "../utils/response";
import { comparePassword, findUserByEmail, generateOtp, hashPassword, signToken, verifyToken } from "../utils/utills";
import { sendEmail } from "../services/sendEmail";

const uploadImage = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        if (!req.file) {
            throw new BadRequestError("Image is required");
        }
        const fileUrl = `/uploads/${(req.file as Express.Multer.File).filename}`;
        SUCCESS(res, 200, "Image uploaded successfully", { fileUrl });
    } catch (error) {
        console.log("error in uploadImage", error);
        next(error);

    }

};
const addTeamMember = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { name, email, departmentId, workSchedule, hourlyRate, billableRate, avatarUrl } = req.body;
        const user = await findUserByEmail(email);
        if (user) {
            throw new BadRequestError("Email already exists");
        }

        const teamMember = await UserModel.create({
            name,
            email,
            departmentId,
            workSchedule,
            role: "team",
            hourlyRate,
            billableRate,
            avatarUrl
        });
        await PermissionModel.create({
            userId: teamMember._id,
        });
        await FeatureAccessModel.create({
            userId: teamMember._id,
        })

        SUCCESS(res, 200, "Team member added successfully", { data: {} });
    } catch (error) {
        console.log("error in addTeamMember", error);
        next(error);
    }
};
const getAllTeamMembers = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        let { page = 1, limit = 10 } = req.query;
        page = parseInt(page as string);
        limit = parseInt(limit as string);
        const skip = (page - 1) * limit;
        const result = await UserModel.aggregate(
            [
                { $match: { role: "team" } },
                { $sort: { createdAt: -1 } },
                {
                    $facet: {
                        total: [{ $count: "count" }],
                        data: [
                            { $skip: skip },
                            { $limit: limit },
                            {
                                $lookup: {
                                    from: "departmentcategories",
                                    localField: "departmentId",
                                    foreignField: "_id",
                                    as: "department",
                                },
                            },
                            {
                                $unwind: {
                                    path: "$department",
                                    preserveNullAndEmptyArrays: true,
                                }
                            },
                            {
                                $lookup: {
                                    from: "featureaccesses",
                                    localField: "_id",
                                    foreignField: "userId",
                                    as: "featureAccess",
                                }
                            },
                            {
                                $unwind: {
                                    path: "$featureAccess",
                                    preserveNullAndEmptyArrays: true,
                                }
                            },
                            {
                                $lookup: {
                                    from: "permissions",
                                    localField: "_id",
                                    foreignField: "userId",
                                    as: "permission",
                                },
                            },
                            {
                                $unwind: {
                                    path: "$permission",
                                    preserveNullAndEmptyArrays: true,
                                }
                            },
                            {
                                $project: {
                                    password: 0
                                },
                            },
                        ]
                    }
                }
            ]);
        const total = result[0]?.total[0]?.count || 0;
        const pagination = { total, totalPages: Math.ceil(total / limit) }
        const teamMembers = result[0]?.data || [];
        SUCCESS(res, 200, "Team members fetched successfully", { data: { teamMembers, pagination } });
    } catch (error) {
        console.log("error in getAllTeamMembers", error);
        next(error);
    }
};
const updateTeamMembers = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { permissions, rates, featureAccess, blukWeeklyHours, singleTeamMenber } = req.body
        if (blukWeeklyHours?.length > 0) {
            for (const week of blukWeeklyHours) {
                const { userId, ...rest } = week
                await UserModel.findByIdAndUpdate(userId, { ...rest }, );

            }
        }
        if (permissions?.length > 0) {
            for (const permission of permissions) {
                const { userId, ...rest } = permission
                await PermissionModel.findOneAndUpdate({ userId: userId }, { ...rest }, { upsert: true });
            }

        }
        if (featureAccess?.length > 0) {
            for (const feature of featureAccess) {
                const { userId, ...rest } = feature
                await FeatureAccessModel.findOneAndUpdate({ userId: userId }, { ...rest }, { upsert: true });
            }
        }
        if (rates?.length > 0) {
            for (const rate of rates) {
                const { userId, ...rest } = rate
                await UserModel.findByIdAndUpdate(userId, { ...rest }, { upsert: true });
            }
        }
        if (singleTeamMenber?.userId) {
            const { userId, ...rest } = singleTeamMenber
            await UserModel.findByIdAndUpdate(userId, { ...rest }, { upsert: true });
        } 
        SUCCESS(res, 200, "Data updated successfully", { data: {} });
    } catch (error) {
        console.log("error in bulkUpdateTeamMembers", error);
        next(error);

    }
}
const sendInviteToTeamMember = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { email } = req.body;
        const user = await findUserByEmail(email);
        if (!user) {
            throw new BadRequestError("User does not exist");
        }
        const token = signToken({ id: user._id }, '10m');
        const link = 'http://localhost:8080/set-password/?token=' + token;
        await sendEmail(email, 1, link);
        user.passwordResetToken = token;
        await user.save();
        SUCCESS(res, 200, "Invite sent successfully", { data: {} });
    } catch (error) {
        console.log("error in sendInviteToTeamMember", error);
        next(error);
    }
};
const setPassword = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { password,token } = req.body;
        const decoded:any = verifyToken(token as string);
        if (!decoded) {
            throw new BadRequestError("Invalid token");
        }
        const user = await UserModel.findById(decoded?.id);
        if (!user) {
            throw new BadRequestError("User does not exist");
        }
        if (user?.passwordResetToken !== token) {
            throw new BadRequestError("Invalid token");
        }
        user.password = await hashPassword(password);
        user.passwordResetToken = '';
        await user.save();
        SUCCESS(res, 200, "Password set successfully", { data: {} });
    } catch (error) {
        console.log("error in setPassword", error);
        next(error);
    }
};


export default { uploadImage, addTeamMember, getAllTeamMembers, sendInviteToTeamMember ,updateTeamMembers,setPassword};
