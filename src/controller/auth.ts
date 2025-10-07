import { NextFunction, Request, Response } from "express";
import { UserModel } from "../models/User";
import { LoginRequest } from "../types/request/types";
import { BadRequestError } from "../utils/errors";
import { SUCCESS } from "../utils/response";
import { comparePassword, findUserByEmail, findUserById, generateOtp, signToken } from "../utils/utills";

const login = async (req: Request<{}, {}, LoginRequest>, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { email, password, deviceToken, deviceType } = req.body;
        const user = await findUserByEmail(email);
        console.log(user);
        if (!user) {
            throw new BadRequestError("User does not exist");
        }
        if (user.status !== "active") {
            throw new BadRequestError("User is not active");
        };
        console.log(user.password);
        if (!user.password) {
            throw new BadRequestError("Set password first");
        }
        const isMatch = await comparePassword(password, user.password);
        if (!isMatch) {
            throw new BadRequestError("Invalid credentials");
        }
        user.jti = generateOtp(30, true, true);
        user.deviceToken = deviceToken ?? '';
        user.deviceType = deviceType ?? '';
        await user.save();
        const token = signToken({ id: user._id, jti: user.jti });
        SUCCESS(res, 200, "Login successful", { data: { token } });
    } catch (error) {
        next(error);
    }
};
const profile = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { user } = req;
        const result = await UserModel.aggregate([
            { $match: { _id: user._id } },
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
                },
            },
            {
                $lookup: {
                    from: "permissions",
                    localField: "_id",
                    foreignField: "userId",
                    as: "permissions",
                },
            },
            {
                $lookup: {
                    from: "featureaccesses",
                    localField: "_id",
                    foreignField: "userId",
                    as: "features",
                },
            },
            {
                $unwind: {
                    path: "$permissions",
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $unwind: {
                    path: "$features",
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $lookup:{
                    from: "settings",
                    localField: "companyId",
                    foreignField: "companyId",
                    as: "settings"
                }
            },{
                $project: {
                    password: 0
                },
            },
        ])
        SUCCESS(res, 200, "Profile fetched successfully", { data: result[0] });
    } catch (error) {
        next(error);
    }
};
const updateProfileImage = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { user } = req;
       console.log(req.body);
       if(req.file){
        req.body.avatarUrl = `/uploads/${(req.file as Express.Multer.File).filename}`
       }
        const result = await UserModel.findByIdAndUpdate(user._id, req.body, { new: true });
        SUCCESS(res, 200, "Profile Image updated successfully", { data: result });
    } catch (error) {
        next(error);
    }
}
const loginAsguest = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { userId } = req.body;
        const user = await findUserById(userId);
        console.log(user);
        if (!user) {
            throw new BadRequestError("User does not exist");
        }
        const token = signToken({ id: user._id, admin: true });
        SUCCESS(res, 200, "Login successful", { data: { token } });
    } catch (error) {
        next(error);
    }
};
export default { login, profile, updateProfileImage , loginAsguest  };
