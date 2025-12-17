import { NextFunction, Request, Response } from "express";

import { BadRequestError } from "../utils/errors";
import { SUCCESS } from "../utils/response";
import { JobModel } from "../models/Job";
import { ClientModel } from "../models/Client";
import { ObjectId } from "../utils/utills";
import { TimeLogModel } from "../models/TImeLog";

const createJob = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        if(req.user.role !== "superAdmin") {
            req.body.companyId = req.user.companyId;
        }
        req.body.createdBy = req.userId;
        // Normalize optional fields to avoid ObjectId cast errors
        if (typeof req.body.jobManagerId === 'string' && req.body.jobManagerId.trim() === '') {
            delete req.body.jobManagerId;
        }
        if (!Array.isArray(req.body.teamMembers) || req.body.teamMembers.length === 0) {
            req.body.teamMembers = [];
        }
        await JobModel.create(req.body);
        SUCCESS(res, 200, "Job created successfully", { data: {} });
    } catch (error) {
        console.log("error in addJob", error);
        next(error);
    }
};
interface GetJobsQuery {
    page?: string;
    limit?: string;
    status?: string;
    priority?: string;
    jobManagerId?: string;
    jobManagerIds?: string;
    teamMemberIds?: string;
    clientId?: string;
    search?: string;
    clientSearch?: string;
    jobTypeId?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    view?: 'daily' | 'weekly' | 'monthly' | 'yearly';
    periodOffset?: string;
}

const getJobs = async (
    req: Request<{}, {}, {}, GetJobsQuery>,
    res: Response,
    next: NextFunction
): Promise<any> => {
    try {
        let {
            page = "1",
            limit = "15",
            status = "",
            priority = "",
            jobManagerId = "",
            jobManagerIds = "",
            teamMemberIds = "",
            clientId = "",
            search = "",
            jobTypeId = "",
            sortBy = "createdAt",
            sortOrder = "desc",
            view = "yearly",
            periodOffset = "0"
        } = req.query;

        const parseObjectIdList = (ids: string) => {
            if (!ids) return [];
            return ids.split(',')
                .map(id => id.trim())
                .filter(Boolean)
                .map(id => {
                    try {
                        return ObjectId(id);
                    } catch (error) {
                        console.warn("Invalid ObjectId provided to getJobs:", id);
                        return null;
                    }
                })
                .filter(Boolean);
        };

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        // Build query
        const query: any = {};
        if(req.user.role !== "superAdmin") {
            query.companyId = req.user.companyId;
        }

        if (priority && priority !== "All Priority") {
            query.priority = priority;
        }

        const managerIdsList = jobManagerIds ? parseObjectIdList(jobManagerIds) : [];
        if (managerIdsList.length > 0) {
            query.jobManagerId = managerIdsList.length === 1 ? managerIdsList[0] : { $in: managerIdsList };
        } else if (jobManagerId) {
            try {
                query.jobManagerId = ObjectId(jobManagerId);
            } catch (error) {
                console.warn("Invalid jobManagerId provided to getJobs:", jobManagerId);
            }
        }

        const teamMemberIdsList = teamMemberIds ? parseObjectIdList(teamMemberIds) : [];
        if (teamMemberIdsList.length > 0) {
            query.teamMembers = teamMemberIdsList.length === 1 ? teamMemberIdsList[0] : { $in: teamMemberIdsList };
        }

        const statusBuckets = ["queued", "awaitingRecords", "inProgress", "withClient", "forApproval", "completed"];

        let clientFilterIds: any[] | null = null;
        if (clientId) {
            try {
                clientFilterIds = [ObjectId(clientId)];
            } catch (error) {
                console.warn("Invalid clientId provided to getJobs:", clientId);
            }
        }

        if (jobTypeId) {
            try {
                query.jobTypeId = ObjectId(jobTypeId);
            } catch (error) {
                console.warn("Invalid jobTypeId provided to getJobs:", jobTypeId);
            }
        }

        if (search) {
            const matchingClients = await ClientModel.find({
                name: { $regex: search, $options: 'i' }
            }).select('_id');

            const matchedIds = matchingClients.map(client => client._id);
            if (clientFilterIds) {
                const matchedSet = new Set(matchedIds.map((id: any) => id.toString()));
                clientFilterIds = clientFilterIds.filter((id: any) => matchedSet.has(id.toString()));
            } else {
                clientFilterIds = matchedIds;
            }
        }

        if (clientFilterIds) {
            if (clientFilterIds.length === 0) {
                const emptyBreakdown = statusBuckets.reduce((acc: any, key) => {
                    acc[key] = 0;
                    return acc;
                }, { all: 0 });

                return SUCCESS(res, 200, "Jobs fetched successfully", {
                    data: {
                        jobs: [],
                        pagination: {
                            currentPage: pageNum,
                            totalPages: 0,
                            totalJobs: 0,
                            limit: limitNum
                        },
                        statusBreakdown: emptyBreakdown,
                        teamMemberStats: [],
                        statusDistribution: [],
                        jobManagerDistribution: [],
                        wipFeeDistribution: [],
                        jobTypeCounts: [],
                        filters: {
                            currentView: view,
                            currentStatus: status || "All",
                            currentPriority: priority || "All Priority"
                        }
                    }
                });
            }
            query.clientId = clientFilterIds.length === 1 ? clientFilterIds[0] : { $in: clientFilterIds };
        }

        // Date filtering based on view
        const now = new Date();
        const offsetNumber = parseInt(periodOffset as string, 10);
        const normalizedOffset = Number.isNaN(offsetNumber) ? 0 : offsetNumber;
        const referenceDate = new Date(now);

        if (view === 'daily') {
            referenceDate.setDate(referenceDate.getDate() + normalizedOffset);
        } else if (view === 'weekly') {
            referenceDate.setDate(referenceDate.getDate() + (normalizedOffset * 7));
        } else if (view === 'monthly') {
            referenceDate.setMonth(referenceDate.getMonth() + normalizedOffset);
        } else if (view === 'yearly') {
            referenceDate.setFullYear(referenceDate.getFullYear() + normalizedOffset);
        }

        const dateFilter: any = {};
        if (view === 'daily') {
            const startOfDay = new Date(referenceDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(referenceDate);
            endOfDay.setHours(23, 59, 59, 999);
            dateFilter.$gte = startOfDay;
            dateFilter.$lte = endOfDay;
        } else if (view === 'weekly') {
            const startOfWeek = new Date(referenceDate);
            startOfWeek.setDate(referenceDate.getDate() - referenceDate.getDay() + 1);
            startOfWeek.setHours(0, 0, 0, 0);
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);
            endOfWeek.setHours(23, 59, 59, 999);
            dateFilter.$gte = startOfWeek;
            dateFilter.$lte = endOfWeek;
        } else if (view === 'monthly') {
            const startOfMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
            const endOfMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0);
            startOfMonth.setHours(0, 0, 0, 0);
            endOfMonth.setHours(23, 59, 59, 999);
            dateFilter.$gte = startOfMonth;
            dateFilter.$lte = endOfMonth;
        } else if (view === 'yearly') {
            const startOfYear = new Date(referenceDate.getFullYear(), 0, 1);
            const endOfYear = new Date(referenceDate.getFullYear(), 11, 31);
            startOfYear.setHours(0, 0, 0, 0);
            endOfYear.setHours(23, 59, 59, 999);
            dateFilter.$gte = startOfYear;
            dateFilter.$lte = endOfYear;
        }

        if (Object.keys(dateFilter).length > 0) {
            query.createdAt = dateFilter;
        }

        const baseQuery = { ...query };

        if (status && status !== "All") {
            query.status = status;
        }

        // Build sort object
        const sortObj: any = {};
        sortObj[sortBy] = sortOrder === "asc" ? 1 : -1;

        // Execute queries in parallel
        const [jobs, totalJobs, teamMemberStats, statusDistribution,
            jobManagerDistribution,
            wipFeeDistribution, statusCounts, jobTypeCounts] = await Promise.all([
                JobModel
                    .find(query)
                    .sort(sortObj)
                    .skip(skip)
                    .limit(limitNum)
                    .populate('clientId', 'name email')
                    .populate('jobTypeId', 'name description')
                    .populate('jobManagerId', 'name email department')
                    .populate('teamMembers', 'name email department avatarUrl')
                    .populate('createdBy', 'name email'),

                JobModel.countDocuments(query),

                // Get team member job counts
                JobModel.aggregate([
                    { $match: query },
                    { $unwind: "$teamMembers" },
                    {
                        $group: {
                            _id: "$teamMembers",
                            totalJobs: { $sum: 1 },
                            jobTypeIds: { $addToSet: "$jobTypeId" },
                            jobTypeDetails: {
                                $push: {
                                    jobTypeId: "$jobTypeId",
                                    status: "$status"
                                }
                            },
                            statuses: { $push: "$status" }
                        }
                    },
                    {
                        $lookup: {
                            from: 'users',
                            localField: '_id',
                            foreignField: '_id',
                            as: 'userInfo'
                        }
                    },
                    {
                        $unwind: '$userInfo'
                    },
                    {
                        $lookup: {
                            from: 'jobcategories',
                            localField: 'jobTypeIds',
                            foreignField: '_id',
                            as: 'jobTypeInfo'
                        }
                    },
                    {
                        $project: {
                            totalJobs: 1,
                            userName: "$userInfo.name",
                            userEmail: "$userInfo.email",
                            userDepartment: "$userInfo.department",

                            // Job types with counts
                            jobTypesWithCount: {
                                $map: {
                                    input: "$jobTypeInfo",
                                    as: "jobType",
                                    in: {
                                        name: "$$jobType.name",
                                        _id: "$$jobType._id",
                                        count: {
                                            $size: {
                                                $filter: {
                                                    input: "$jobTypeDetails",
                                                    as: "detail",
                                                    cond: { $eq: ["$$detail.jobTypeId", "$$jobType._id"] }
                                                }
                                            }
                                        }
                                    }
                                }
                            },

                            // Status breakdown
                            statusBreakdown: {
                                $reduce: {
                                    input: statusBuckets,
                                    initialValue: {},
                                    in: {
                                        $mergeObjects: [
                                            "$$value",
                                            {
                                                $arrayToObject: [[{
                                                    k: "$$this",
                                                    v: {
                                                        $size: {
                                                            $filter: {
                                                                input: "$statuses",
                                                                as: "statusItem",
                                                                cond: { $eq: ["$$statusItem", "$$this"] }
                                                            }
                                                        }
                                                    }
                                                }]]
                                            }
                                        ]
                                    }
                                }
                            }
                        }
                    },
                    { $sort: { totalJobs: -1, userName: 1 } }
                ]),
                // Status Distribution
                JobModel.aggregate([
                    { $match: query },
                    {
                        $group: {
                            _id: '$status',
                            count: { $sum: 1 },
                            totalFee: { $sum: '$jobFee' },
                            avgWIP: { $avg: '$wipPercentage' },
                            jobs: { $push: '$$ROOT' }
                        }
                    },
                    {
                        $project: {
                            count: 1,
                            totalFee: 1,
                            avgWIP: 1,
                            wipPercentage: {
                                $cond: {
                                    if: { $gt: [{ $sum: '$jobs.jobFee' }, 0] },
                                    then: {
                                        $multiply: [
                                            {
                                                $divide: [
                                                    { $sum: { $map: { input: '$jobs', as: 'job', in: { $multiply: ['$$job.jobFee', { $divide: ['$$job.wipPercentage', 100] }] } } } },
                                                    { $sum: '$jobs.jobFee' }
                                                ]
                                            },
                                            100
                                        ]
                                    },
                                    else: 0
                                }
                            }
                        }
                    },
                    { $sort: { count: -1 } }
                ]),

                // Job Manager Distribution
                JobModel.aggregate([
                    { $match: query },
                    {
                        $lookup: {
                            from: 'users',
                            localField: 'jobManagerId',
                            foreignField: '_id',
                            as: 'managerInfo'
                        }
                    },
                    { $unwind: '$managerInfo' },
                    {
                        $group: {
                            _id: '$managerInfo.name',
                            managerId: { $first: '$managerInfo._id' },
                            count: { $sum: 1 },
                            totalFee: { $sum: '$jobFee' },
                            avgWIP: { $avg: '$wipPercentage' },
                            jobs: { $push: '$$ROOT' }
                        }
                    },
                    {
                        $project: {
                            managerId: 1,
                            count: 1,
                            totalFee: 1,
                            avgWIP: 1,
                            wipPercentage: {
                                $cond: {
                                    if: { $gt: [{ $sum: '$jobs.jobFee' }, 0] },
                                    then: {
                                        $multiply: [
                                            {
                                                $divide: [
                                                    { $sum: { $map: { input: '$jobs', as: 'job', in: { $multiply: ['$$job.jobFee', { $divide: ['$$job.wipPercentage', 100] }] } } } },
                                                    { $sum: '$jobs.jobFee' }
                                                ]
                                            },
                                            100
                                        ]
                                    },
                                    else: 0
                                }
                            }
                        }
                    },
                    { $sort: { count: -1 } }
                ]),

                // WIP % of Fee Distribution
                JobModel.aggregate([
                    { $match: query },
                    {
                        $bucket: {
                            groupBy: '$wipPercentage',
                            boundaries: [0, 25, 50, 75, 100, Infinity],
                            default: 'Other',
                            output: {
                                count: { $sum: 1 },
                                totalFee: { $sum: '$jobFee' },
                                avgWIP: { $avg: '$wipPercentage' },
                                jobs: { $push: '$$ROOT' }
                            }
                        }
                    },
                    {
                        $project: {
                            _id: {
                                $switch: {
                                    branches: [
                                        { case: { $eq: ['$_id', 0] }, then: '0-25%' },
                                        { case: { $eq: ['$_id', 25] }, then: '26-50%' },
                                        { case: { $eq: ['$_id', 50] }, then: '51-75%' },
                                        { case: { $eq: ['$_id', 75] }, then: '76-100%' }
                                    ],
                                    default: 'Other'
                                }
                            },
                            count: 1,
                            totalFee: 1,
                            avgWIP: 1,
                            wipPercentage: {
                                $cond: {
                                    if: { $gt: [{ $sum: '$jobs.jobFee' }, 0] },
                                    then: {
                                        $multiply: [
                                            {
                                                $divide: [
                                                    { $sum: { $map: { input: '$jobs', as: 'job', in: { $multiply: ['$$job.jobFee', { $divide: ['$$job.wipPercentage', 100] }] } } } },
                                                    { $sum: '$jobs.jobFee' }
                                                ]
                                            },
                                            100
                                        ]
                                    },
                                    else: 0
                                }
                            }
                        }
                    }
                ]),

                // Status counts for bottom tabs
                JobModel.aggregate([
                    { $match: baseQuery },
                    {
                        $group: {
                            _id: '$status',
                            count: { $sum: 1 }
                        }
                    }
                ]),
                // job type
                JobModel.aggregate([
                    { $match: query },
                    {
                        $group: {
                            _id: "$jobTypeId",
                            count: { $sum: 1 }
                        }
                    },
                    {
                        $lookup: {
                            from: "jobcategories",
                            localField: "_id",
                            foreignField: "_id",
                            as: "jobType"
                        }
                    },
                    { $unwind: "$jobType" },
                    {
                        $project: {
                            _id: 1,
                            count: 1,
                            name: "$jobType.name"
                        }
                    },
                    { $sort: { count: -1 } }
                ])
            ]);

        const jobIds = jobs.map((job: any) => job._id);
        let jobWipMap = new Map<string, number>();
        let jobHoursMap = new Map<string, number>();
        if (jobIds.length > 0) {
            const wipMatch: any = {
                jobId: { $in: jobIds },
                billable: true,
            };
            if (req.user.role !== "superAdmin") {
                wipMatch.companyId = req.user.companyId;
            }
            const wipAggregation = await TimeLogModel.aggregate([
                { $match: wipMatch },
                {
                    $group: {
                        _id: '$jobId',
                        wipBalance: { $sum: '$amount' }
                    }
                }
            ]);
            jobWipMap = new Map(
                wipAggregation.map(item => [item._id.toString(), parseFloat(item.wipBalance.toFixed(2))])
            );

            const hoursMatch: any = {
                jobId: { $in: jobIds },
            };
            if (req.user.role !== "superAdmin") {
                hoursMatch.companyId = req.user.companyId;
            }
            const hoursAggregation = await TimeLogModel.aggregate([
                { $match: hoursMatch },
                {
                    $group: {
                        _id: '$jobId',
                        totalDuration: { $sum: '$duration' }
                    }
                }
            ]);
            jobHoursMap = new Map(
                hoursAggregation.map(item => {
                    const hours = (item.totalDuration || 0) / 3600;
                    return [item._id.toString(), parseFloat(hours.toFixed(2))];
                })
            );
        }

        const jobsWithWip = jobs.map((job: any) => {
            const jobObj = job.toObject ? job.toObject() : job;
            const wipBalance = jobWipMap.get(job._id.toString()) || 0;
            const hoursLogged = jobHoursMap.get(job._id.toString()) || 0;
            return {
                ...jobObj,
                wipBalance: parseFloat(wipBalance.toFixed(2)),
                hoursLogged
            };
        });

        // Process status counts for dashboard stats
        const statusBreakdown = statusBuckets.reduce((acc: any, key) => {
            acc[key] = 0;
            return acc;
        }, { all: totalJobs });

        statusCounts.forEach(item => {
            statusBreakdown[item._id as keyof typeof statusBreakdown] = item.count;
        });

        const totalPages = Math.ceil(totalJobs / limitNum);

        const response = {
            jobs: jobsWithWip,
            pagination: {
                currentPage: pageNum,
                totalPages,
                totalJobs,
                limit: limitNum
            },
            statusBreakdown,
            teamMemberStats,
            statusDistribution,
            jobManagerDistribution,
            wipFeeDistribution,
            jobTypeCounts,

            filters: {
                currentView: view,
                currentStatus: status || "All",
                currentPriority: priority || "All Priority"
            }
        };

        SUCCESS(res, 200, "Jobs fetched successfully", { data: response });
    } catch (error) {
        console.log("error in getJobs", error);
        next(error);
    }
};
const getJobById = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { jobId } = req.params;
        const job = await JobModel.findById(jobId).populate('clientId', 'name email')
            .populate('jobTypeId', 'name ')
            .populate('jobManagerId', 'name email department')
            .populate('teamMembers', 'name email department')
            .populate('createdBy', 'name email');
        const logsMatch: any = { jobId: ObjectId(jobId) };
        if (req.user.role !== "superAdmin") {
            logsMatch.companyId = req.user.companyId;
        }

        const timeLogs = await TimeLogModel.aggregate([
            { $match: logsMatch },
            {
                $lookup: {
                    from: 'users',
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'user',
                    pipeline: [{ $project: { _id: 1, name: 1, avatarUrl: 1 } }]
                }
            },
            { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    _id: 1,
                    date: 1,
                    description: 1,
                    durationSeconds: { $ifNull: ['$duration', 0] },
                    rate: { $ifNull: ['$rate', 0] },
                    amount: { $ifNull: ['$amount', 0] },
                    billable: { $ifNull: ['$billable', false] },
                    user: {
                        _id: '$user._id',
                        name: '$user.name',
                        avatarUrl: '$user.avatarUrl'
                    }
                }
            },
            { $sort: { date: -1, createdAt: -1 } }
        ]);
        SUCCESS(res, 200, "Job fetched successfully", { data: job, timeLogs });
    } catch (error) {
        console.log("error in getJobById", error);
        next(error);
    }
}
const updateJob = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { jobId } = req.params;
        // Normalize optional fields to avoid ObjectId cast errors
        if (typeof req.body.jobManagerId === 'string' && req.body.jobManagerId.trim() === '') {
            delete req.body.jobManagerId;
        }
        if (!Array.isArray(req.body.teamMembers)) {
            // if sent as empty string/null, drop it so it won't overwrite with invalid type
            if (req.body.teamMembers === '' || req.body.teamMembers === null) {
                delete req.body.teamMembers;
            }
        }
        await JobModel.findByIdAndUpdate(jobId, req.body, { new: true });
        SUCCESS(res, 200, "Job updated successfully", { data: {} });
    } catch (error) {
        console.log("error in updateJob", error);
        next(error);
    }
};
const deleteJob = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { jobId } = req.params;
        await JobModel.findByIdAndDelete(jobId);
        SUCCESS(res, 200, "Job deleted successfully", { data: {} });
    } catch (error) {
        console.log("error in deleteJob", error);
        next(error);
    }
};

export default { createJob, getJobs, updateJob, deleteJob, getJobById };