import { NextFunction, Request, Response } from "express";
import { FeatureAccessModel } from "../models/FeatureAccess";
import { PermissionModel } from "../models/Permission";
import { UserModel } from "../models/User";
import { LoginRequest } from "../types/request/types";
import { BadRequestError } from "../utils/errors";
import { SUCCESS } from "../utils/response";
import { comparePassword, findUserByEmail, generateOtp, hashPassword, ObjectId, signToken, verifyToken } from "../utils/utills";
import { sendEmail } from "../services/sendEmail";
import { ServicesCategoryModel } from "../models/ServicesCategory";
import { DepartmentCategoryModel } from "../models/DepartmentCategory";
import { JobCategoryModel } from "../models/JobCategory";
import { TimeCategoryModel } from "../models/TimeCategory";
import { BusinessCategoryModel } from "../models/BusinessCategory";
import { ClientModel } from "../models/Client";
import { JobModel } from "../models/Job";
import { SettingModel } from "../models/Setting";
import { getWIPDashboardData } from "./wip";
import { WipTragetAmountsModel } from "../models/WIPTargetAmounts";
import { TimeLogModel } from "../models/TImeLog";

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
        const currentUser = req.user;
        const { name, email, departmentId, workSchedule, hourlyRate, billableRate, avatarUrl, companyId } = req.body;
        const user = await findUserByEmail(email);
        if (user) {
            throw new BadRequestError("Email already exists");
        }
        const JobFees = (await JobCategoryModel.find({})).map((job) => ({ jobId: job._id, fee: 0 }));
        const teamMember = await UserModel.create({
            name,
            email,
            departmentId,
            workSchedule,
            role: "team",
            hourlyRate,
            billableRate,
            avatarUrl,
            JobFees
        });
        teamMember.companyId = companyId || currentUser.companyId;
        await teamMember.save();
        await PermissionModel.create({
            userId: teamMember._id,
            companyId: currentUser.companyId
        });
        await FeatureAccessModel.create({
            userId: teamMember._id,
            companyId: currentUser.companyId
        })

        SUCCESS(res, 200, "Team member added successfully", { data: {} });
    } catch (error) {
        console.log("error in addTeamMember", error);
        next(error);
    }
};
const getAllTeamMembers = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        let { page = 1, limit = 10, search = "", departmentId = "" } = req.query;
        page = parseInt(page as string);
        limit = parseInt(limit as string);
        const skip = (page - 1) * limit;
        const query: any = { role: "team", };
        if (req.user.role !== "superAdmin") {
            query.companyId = req.user.companyId;
        }
        if (search) {
            query.name = { $regex: search, $options: "i" }
        }
        if (departmentId) {
            query.departmentId = ObjectId(departmentId);
        }
        const result = await UserModel.aggregate(
            [
                { $match: query },
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
                await UserModel.findByIdAndUpdate(userId, { ...rest },);

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
                console.log("rest", rest);
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
        const link = `${process.env.FORNTEND_URL}/set-password/?token=` + token;
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
        const { password, token } = req.body;
        const decoded: any = verifyToken(token as string);
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

const dropdownOptions = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { type = "all", clientId } = req.query;
        const data: any = {};
        const companyId = req.user.companyId;
        if (type === "all") {

            const [departments, services, jobs, times, bussiness, teams, clients, jobList, companies, wipTargetAmount] = await Promise.all(
                [
                    DepartmentCategoryModel.find({ companyId }, { _id: 1, name: 1, }).lean(),
                    ServicesCategoryModel.find({ companyId }, { _id: 1, name: 1, }).lean(),
                    JobCategoryModel.find({ companyId }, { _id: 1, name: 1, }).lean(),
                    TimeCategoryModel.find({ companyId }, { _id: 1, name: 1, }).lean(),
                    BusinessCategoryModel.find({ companyId }, { _id: 1, name: 1, }).lean(),
                    UserModel.find({ role: "team", companyId }, { _id: 1, name: 1, }).lean(),
                    ClientModel.find({ companyId, status: "active" }, { _id: 1, name: 1, }).lean(),
                    JobModel.find({ companyId, }, { _id: 1, name: 1, clientId: 1 }).lean(),
                    UserModel.find({ role: "company" }, { _id: 1, name: 1, }).lean(),
                    WipTragetAmountsModel.find({ companyId }, { _id: 1, amount: 1, }).lean(),
                ]);
            data.departments = departments;
            data.services = services;
            data.jobs = jobs;
            data.times = times;
            data.bussiness = bussiness;
            data.teams = teams;
            data.clients = clients;
            data.jobList = jobList;
            data.companies = companies
            data.wipTargetAmount = wipTargetAmount

        } else if (type === "department") {
            data.departments = await DepartmentCategoryModel.find({ companyId }, { _id: 1, name: 1, }).lean();
        } else if (type === "service") {
            data.services = await ServicesCategoryModel.find({ companyId }, { _id: 1, name: 1, }).lean();
        } else if (type === "job") {
            data.jobs = await JobCategoryModel.find({ companyId }, { _id: 1, name: 1, }).lean();
        } else if (type === "time") {
            data.times = await TimeCategoryModel.find({ companyId }, { _id: 1, name: 1, }).lean();
        } else if (type === "bussiness") {
            data.bussiness = await BusinessCategoryModel.find({ companyId }, { _id: 1, name: 1, }).lean();
        } else if (type === "team") {
            data.teams = await UserModel.find({ role: "team", companyId }, { _id: 1, name: 1, }).lean();
        } else if (type === "client") {
            data.clients = await ClientModel.find({ companyId, status: "active" }, { _id: 1, name: 1, }).lean();
        } else if (type === "company") {
            data.companies = await UserModel.find({ role: "company" }, { _id: 1, name: 1, }).lean();
        } else if (type === "jobList") {
            let query: any = { companyId };
            if (clientId) query.clientId = clientId;
            data.jobs = await JobModel.find(query, { _id: 1, name: 1, clientId: 1 }).lean();
        } else if (type === "wipTargetAmount") {
            data.wipTargetAmount = await WipTragetAmountsModel.find({ companyId }, { _id: 1, amount: 1, }).lean();
        }
        else {
            throw new BadRequestError("Invalid type");
        }
        SUCCESS(res, 200, "fetched successfully", { data });
    } catch (error) {
        next(error);
    }
};
const getAccessOftabs = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {

        const { tabName } = req.query;
        const query = tabName ? { [tabName as string]: true, companyId: req.user.companyId } : {};
        const result = await FeatureAccessModel.aggregate([
            { $match: query },
            {
                $lookup: {
                    from: "users",
                    localField: "userId",
                    foreignField: "_id",
                    as: "user",
                    pipeline: [{ $project: { _id: 1, name: 1, avatarUrl: 1, role: 1 } }],
                },
            },
            { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
            { $match: { "user": { $ne: null } } },
            {
                $project: {
                    _id: "$user._id",
                    name: "$user.name",
                    avatarUrl: "$user.avatarUrl",
                    role: "$user.role",
                },
            },
        ]);
        SUCCESS(res, 200, "fetched successfully", { result });
    } catch (error) {
        next(error);
    }
};
const addCompany = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { name, email, avatarUrl } = req.body;
        const user = await findUserByEmail(email);
        if (user) {
            throw new BadRequestError("Email already exists");
        }
        const member = await UserModel.create({
            name,
            email,
            role: "company",
            avatarUrl,
        });
        member.companyId = member._id;
        await member.save();
        await PermissionModel.create({
            userId: member._id,
            companyId: member._id,
            approveTimesheets: true,
            editServices: true,
            editJobBuilder: true,
            editJobTemplates: true,
            bulkDeleteLogs: true,
        });
        await FeatureAccessModel.create({
            userId: member._id,
            companyId: member._id, // Assuming companyId = user's own _id for company role

            // Time
            myTimesheet: true,
            allTimesheets: true,
            timeLogs: true,
            myTimeLogs: true,

            // WIP & Debtors
            WIP: true,
            agedWIP: true,
            invoices: true,
            agedDebtors: true,
            writeOff: true,

            // Clients
            clientList: true,
            clientBreakdown: true,

            // Jobs
            services: true,
            jobTemplates: true,
            jobBuilder: true,
            jobList: true,

            // Expenses
            clientExpenses: true,
            teamExpenses: true,

            // Reports
            reports: true,

            // Team
            teamList: true,
            rates: true,
            permissions: true,
            access: true,

            // Settings
            general: true,
            invoicing: true,
            tags: true,
            clientImport: true,
            jobImport: true,
            timeLogsImport: true,
            integrations: true,
        });
        await SettingModel.create({ companyId: member._id });
        SUCCESS(res, 200, "Member added successfully", { data: {} });
    } catch (error) {
        console.log("error in add company", error);
        next(error);
    }
};
const getAllCompanyMembers = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        let { page = 1, limit = 10, search = "", } = req.query;
        page = parseInt(page as string);
        limit = parseInt(limit as string);
        const skip = (page - 1) * limit;
        const query: any = { role: "company" };
        if (search) {
            query.name = { $regex: search, $options: "i" }
        }
        const result = await UserModel.aggregate(
            [
                { $match: query },
                { $sort: { createdAt: -1 } },
                {
                    $facet: {
                        total: [{ $count: "count" }],
                        data: [
                            { $skip: skip },
                            { $limit: limit },
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
                                $lookup: {
                                    from: "users",
                                    let: { companyId: "$_id", role: "team" },
                                    pipeline: [
                                        { $match: { $expr: { $and: [{ $eq: ["$companyId", "$$companyId"] }, { $eq: ["$role", "$$role"] }] } } },
                                        { $project: { _id: 1 } },
                                    ],
                                    as: "company",
                                },
                            },
                            {
                                $addFields: {
                                    teamMembersCount: { $size: "$company" },
                                },
                            },
                            {
                                $project: {
                                    password: 0,
                                    company: 0,
                                },
                            },
                        ]
                    }
                }
            ]);
        const total = result[0]?.total[0]?.count || 0;
        const pagination = { total, totalPages: Math.ceil(total / limit) }
        const companyMembers = result[0]?.data || [];
        SUCCESS(res, 200, "members fetched successfully", { data: { companyMembers, pagination } });
    } catch (error) {
        console.log("error in getAllCompanyMembers", error);
        next(error);
    }
};
const getCompanyById = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { companyId } = req.params;
        const company = await UserModel.aggregate([
            { $match: { _id: ObjectId(companyId), role: "company" } },
            { $project: { password: 0 } }
        ]).then(result => result[0]);
        if (!company) {
            throw new BadRequestError("Company not found");
        }
        const teamMembersCount = await UserModel.countDocuments({ companyId: company._id, role: "team" });
        company.teamMembersCount = teamMembersCount;
        SUCCESS(res, 200, "Company fetched successfully", { data: { company } });
    } catch (error) {
        console.log("error in getCompanyById", error);
        next(error);
    };
}
const companyTeamMembers = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { companyId } = req.params;
        let { page = 1, limit = 10, search = "", departmentId = "" } = req.query;
        page = parseInt(page as string);
        limit = parseInt(limit as string);
        const skip = (page - 1) * limit;
        const query: any = { role: "team", companyId: ObjectId(companyId) };
        if (search) {
            query.name = { $regex: search, $options: "i" }
        }
        if (departmentId) {
            query.departmentId = ObjectId(departmentId);
        }
        const result = await UserModel.aggregate(
            [
                { $match: query },
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
                            { $project: { password: 0 } },
                        ]
                    }
                }
            ]);
        const total = result[0]?.total[0]?.count || 0;
        const pagination = { total, totalPages: Math.ceil(total / limit) }
        const teamMembers = result[0]?.data || [];
        SUCCESS(res, 200, "Team members fetched successfully", { data: { teamMembers, pagination } });
    } catch (error) {
        console.log("error in companyTeamMembers", error);
        next(error);
    }
};
const updateSettings = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const companyId = req.user.companyId;
        await SettingModel.updateOne({ companyId }, { $set: req.body });
        SUCCESS(res, 200, "Settings updated successfully", { data: {} });
    } catch (error) {
        console.log("error in updateSettings", error);
        next(error);
    }
};
const reports = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        let { startDate, endDate, periodType, page, limit } = req.query;
        const companyId = req.user.companyId;
        
        if (!startDate || !endDate || !periodType) {
            return res.status(400).json({
                success: false,
                message: 'startDate, endDate, and periodType are required'
            });
        }

        if (!['daily', 'weekly', 'monthly', 'yearly'].includes(periodType as string)) {
            return res.status(400).json({
                success: false,
                message: 'periodType must be one of: daily, weekly, monthly, yearly'
            });
        }

        const pageNumber = parseInt(page as string) || 1;
        const limitNumber = parseInt(limit as string) || 10;
        const skip = (pageNumber - 1) * limitNumber;
        
        const dateGrouping = getDateGrouping(periodType);
        const newStartDate = new Date(startDate as string);
        const newEndDate = new Date(endDate as string);
        
        // Build the common pipeline stages (before pagination)
        const commonPipeline: any[] = [
            {
                $match: {
                    companyId: companyId,
                    date: {
                        $gte: newStartDate,
                        $lte: newEndDate
                    }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'userDetails'
                }
            },
            {
                $unwind: '$userDetails'
            },
            {
                $addFields: {
                    dayOfWeek: { $dayOfWeek: '$date' }
                }
            },
            {
                $group: {
                    _id: {
                        period: dateGrouping,
                        userId: '$userId'
                    },
                    name: { $first: '$userDetails.name' },
                    avatarUrl: { $first: '$userDetails.avatarUrl' },
                    workSchedule: { $first: '$userDetails.workSchedule' },
                    hourlyRate: { $first: '$userDetails.hourlyRate' },
                    billableRate: { $first: '$userDetails.billableRate' },
                    dayOfWeek: { $first: '$dayOfWeek' },
                    totalLoggedDuration: {
                        $sum: '$duration'
                    },
                    billableHours: {
                        $sum: {
                            $cond: [
                                { $eq: ['$billable', true] },
                                '$duration',
                                0
                            ]
                        }
                    },
                    billableAmount: {
                        $sum: {
                            $cond: [
                                { $eq: ['$billable', true] },
                                '$amount',
                                0
                            ]
                        }
                    },
                    nonBillableHours: {
                        $sum: {
                            $cond: [
                                { $eq: ['$billable', false] },
                                '$duration',
                                0
                            ]
                        }
                    }
                }
            },
            {
                $addFields: {
                    capacity: {
                        $cond: [
                            { $eq: [periodType, 'daily'] },
                            {
                                $switch: {
                                    branches: [
                                        {
                                            case: { $eq: ['$dayOfWeek', 1] },
                                            then: { $ifNull: ['$workSchedule.sunday', 0] }
                                        },
                                        {
                                            case: { $eq: ['$dayOfWeek', 2] },
                                            then: { $ifNull: ['$workSchedule.monday', 0] }
                                        },
                                        {
                                            case: { $eq: ['$dayOfWeek', 3] },
                                            then: { $ifNull: ['$workSchedule.tuesday', 0] }
                                        },
                                        {
                                            case: { $eq: ['$dayOfWeek', 4] },
                                            then: { $ifNull: ['$workSchedule.wednesday', 0] }
                                        },
                                        {
                                            case: { $eq: ['$dayOfWeek', 5] },
                                            then: { $ifNull: ['$workSchedule.thursday', 0] }
                                        },
                                        {
                                            case: { $eq: ['$dayOfWeek', 6] },
                                            then: { $ifNull: ['$workSchedule.friday', 0] }
                                        },
                                        {
                                            case: { $eq: ['$dayOfWeek', 7] },
                                            then: { $ifNull: ['$workSchedule.saturday', 0] }
                                        }
                                    ],
                                    default: 0
                                }
                            },
                            {
                                $cond: [
                                    { $eq: [periodType, 'weekly'] },
                                    {
                                        $add: [
                                            { $ifNull: ['$workSchedule.monday', 0] },
                                            { $ifNull: ['$workSchedule.tuesday', 0] },
                                            { $ifNull: ['$workSchedule.wednesday', 0] },
                                            { $ifNull: ['$workSchedule.thursday', 0] },
                                            { $ifNull: ['$workSchedule.friday', 0] },
                                            { $ifNull: ['$workSchedule.saturday', 0] },
                                            { $ifNull: ['$workSchedule.sunday', 0] }
                                        ]
                                    },
                                    {
                                        $cond: [
                                            { $eq: [periodType, 'monthly'] },
                                            {
                                                $multiply: [
                                                    {
                                                        $add: [
                                                            { $ifNull: ['$workSchedule.monday', 0] },
                                                            { $ifNull: ['$workSchedule.tuesday', 0] },
                                                            { $ifNull: ['$workSchedule.wednesday', 0] },
                                                            { $ifNull: ['$workSchedule.thursday', 0] },
                                                            { $ifNull: ['$workSchedule.friday', 0] },
                                                            { $ifNull: ['$workSchedule.saturday', 0] },
                                                            { $ifNull: ['$workSchedule.sunday', 0] }
                                                        ]
                                                    },
                                                    4.33
                                                ]
                                            },
                                            {
                                                $multiply: [
                                                    {
                                                        $add: [
                                                            { $ifNull: ['$workSchedule.monday', 0] },
                                                            { $ifNull: ['$workSchedule.tuesday', 0] },
                                                            { $ifNull: ['$workSchedule.wednesday', 0] },
                                                            { $ifNull: ['$workSchedule.thursday', 0] },
                                                            { $ifNull: ['$workSchedule.friday', 0] },
                                                            { $ifNull: ['$workSchedule.saturday', 0] },
                                                            { $ifNull: ['$workSchedule.sunday', 0] }
                                                        ]
                                                    },
                                                    52
                                                ]
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    },
                    writeOff: { $literal: 0 }
                }
            },
            {
                $project: {
                    period: '$_id.period',
                    userId: '$_id.userId',
                    name: 1,
                    avatarUrl: 1,
                    hourlyRate: '$hourlyRate',
                    capacity: { $round: ['$capacity', 2] },
                    logged: { $round: ['$totalLoggedDuration', 2] },
                    billable: { $round: ['$billableHours', 2] },
                    billableAmount: { $round: ['$billableAmount', 2] },
                    nonBillable: { $round: ['$nonBillableHours', 2] },
                    writeOff: 1,
                }
            },
            {
                $sort: { period: 1, name: 1 }
            }
        ];

        // Use $facet to get paginated data, total count, and global totals
        const result = await TimeLogModel.aggregate([
            ...commonPipeline,
            {
                $facet: {
                    // Paginated data
                    paginatedData: [
                        { $skip: skip },
                        { $limit: limitNumber }
                    ],
                    
                    // Total count for pagination metadata
                    totalCount: [
                        { $count: 'count' }
                    ],
                    
                    // Global totals (across ALL records, not just current page)
                    globalTotals: [
                        {
                            $group: {
                                _id: null,
                                totalCapacity: { $sum: '$capacity' },
                                totalLogged: { $sum: '$logged' },
                                totalRevenue: { $sum: '$billableAmount' },
                                uniqueUsers: { $addToSet: '$userId' }
                            }
                        }
                    ]
                }
            },
            {
                $project: {
                    paginatedData: 1,
                    totalCount: { $arrayElemAt: ['$totalCount.count', 0] },
                    globalTotals: { $arrayElemAt: ['$globalTotals', 0] }
                }
            }
        ]);

        // Extract results
        const paginatedData = result[0]?.paginatedData || [];
        const totalCount = result[0]?.totalCount || 0;
        const globalTotals = result[0]?.globalTotals || {
            totalCapacity: 0,
            totalLogged: 0,
            totalRevenue: 0,
            uniqueUsers: []
        };

        // Format the paginated results
        const formattedReports = paginatedData.map((log:any) => ({
            // period: formatPeriod(log.period, periodType),
            name: log.name,
            userId: log.userId,
            hourlyRate: log.hourlyRate,
            capacity: log.capacity,
            logged: log.logged,
            billable: log.billable,
            billableAmount: log.billableAmount,
            nonBillable: log.nonBillable,
            writeOff: log.writeOff,
        }));

        // Calculate total pages
        const totalPages = Math.ceil(totalCount / limitNumber);

        const data = {
            periodType,
            startDate: newStartDate,
            endDate: newEndDate,
            
            // Global totals (across ALL records in the date range)
            totalCapacity: parseFloat((globalTotals.totalCapacity || 0).toFixed(2)),
            totalLogged: parseFloat((globalTotals.totalLogged || 0).toFixed(2)),
            totalRevenue: parseFloat((globalTotals.totalRevenue || 0).toFixed(2)),
            teamMembers: globalTotals.uniqueUsers?.length || 0,
            
            // Paginated results
            reports: formattedReports,
            
            // Pagination metadata
            pagination: {
                total: totalCount,
                page: pageNumber,
                limit: limitNumber,
            }
        };

        res.json({
            success: true,
            data: data
        });
    } catch (error: any) {
        console.error('Error generating period report:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate period report',
            error: error.message
        });
    }
};



// Generate date grouping based on period type
function getDateGrouping(periodType: any) {
    switch (periodType) {
        case 'daily':
            return {
                year: { $year: '$date' },
                month: { $month: '$date' },
                day: { $dayOfMonth: '$date' }
            };
        case 'weekly':
            return {
                year: { $isoWeekYear: '$date' },
                week: { $isoWeek: '$date' }
            };
        case 'monthly':
            return {
                year: { $year: '$date' },
                month: { $month: '$date' }
            };
        case 'yearly':
            return {
                year: { $year: '$date' }
            };
    }
}
// Format period string for display
function formatPeriod(groupId: any, periodType: any): any {
    switch (periodType) {
        case 'daily':
            return `${groupId.year}-${String(groupId.month).padStart(2, '0')}-${String(groupId.day).padStart(2, '0')}`;
        case 'weekly':
            return `${groupId.year}-W${String(groupId.week).padStart(2, '0')}`;
        case 'monthly':
            return `${groupId.year}-${String(groupId.month).padStart(2, '0')}`;
        case 'yearly':
            return `${groupId.year}`;
    }
}
export default { uploadImage, addTeamMember, getAllTeamMembers, sendInviteToTeamMember, updateTeamMembers, setPassword, dropdownOptions, getAccessOftabs, addCompany, getAllCompanyMembers, getCompanyById, companyTeamMembers, updateSettings, reports };
