import { NextFunction, Request, Response } from "express";
import { FeatureAccessModel } from "../models/FeatureAccess";
import { PermissionModel } from "../models/Permission";
import { UserModel } from "../models/User";
import { LoginRequest } from "../types/request/types";
import { BadRequestError } from "../utils/errors";
import { SUCCESS } from "../utils/response";
import { comparePassword, findUserByEmail, generateOtp, signToken } from "../utils/utills";

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
}
export default { login, profile  };
