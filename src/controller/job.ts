import { NextFunction, Request, Response } from "express";

import { BadRequestError } from "../utils/errors";
import { SUCCESS } from "../utils/response";
import { JobModel } from "../models/Job";

const createJob = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        req.body.createdBy = req.userId;
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
    clientId?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    view?: 'daily' | 'weekly' | 'monthly' | 'yearly';
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
            clientId = "",
            search = "",
            sortBy = "createdAt",
            sortOrder = "desc",
            view = "yearly"
        } = req.query;

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        // Build query
        const query: any = {};

        if (status && status !== "All") {
            query.status = status;
        }

        if (priority && priority !== "All Priority") {
            query.priority = priority;
        }

        if (jobManagerId) {
            query.jobManagerId = jobManagerId;
        }

        if (clientId) {
            query.clientId = clientId;
        }

        if (search) {
            query.name = { $regex: search, $options: 'i' } ;
        }

        // Date filtering based on view
        const now = new Date();
        if (view !== "yearly") {
            const startDate = new Date();
            switch (view) {
                case 'daily':
                    startDate.setHours(0, 0, 0, 0);
                    query.createdAt = { $gte: startDate };
                    break;
                case 'weekly':
                    startDate.setDate(now.getDate() - 7);
                    query.createdAt = { $gte: startDate };
                    break;
                case 'monthly':
                    startDate.setMonth(now.getMonth() - 1);
                    query.createdAt = { $gte: startDate };
                    break;
            }
        }

        // Build sort object
        const sortObj: any = {};
        sortObj[sortBy] = sortOrder === "asc" ? 1 : -1;

        // Execute queries in parallel
        const [jobs, totalJobs, teamMemberStats, statusDistribution,
            jobManagerDistribution,
            wipFeeDistribution, statusCounts] = await Promise.all([
                JobModel
                    .find(query)
                    .sort(sortObj)
                    .skip(skip)
                    .limit(limitNum)
                    .populate('clientId', 'name email')
                    .populate('jobTypeId', 'name description')
                    .populate('jobManagerId', 'name email department')
                    .populate('teamMembers', 'name email department')
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
                                    input: ["queued", "inProgress", "withClient", "forApproval", "completed"],
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
                    { $match: {} }, // All jobs for status counts
                    {
                        $group: {
                            _id: '$status',
                            count: { $sum: 1 }
                        }
                    }
                ])
            ]);

        // Process status counts for dashboard stats
        const statusBreakdown = {
            all: totalJobs,
            queued: 0,
            inProgress: 0,
            withClient: 0,
            forApproval: 0,
            completed: 0
        };

        statusCounts.forEach(item => {
            statusBreakdown[item._id as keyof typeof statusBreakdown] = item.count;
        });

        const totalPages = Math.ceil(totalJobs / limitNum);

        const response = {
            jobs,
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
const updateJob = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { jobId } = req.params;
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

export default { createJob, getJobs,updateJob,deleteJob };