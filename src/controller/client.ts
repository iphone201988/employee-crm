import { NextFunction, Request, Response } from "express";
import { SUCCESS } from "../utils/response";
import { ClientModel } from "../models/Client";
import { BusinessCategoryModel } from "../models/BusinessCategory";
import { ServicesCategoryModel } from "../models/ServicesCategory";
import { BadRequestError } from "../utils/errors";
import { ObjectId } from "../utils/utills";
import { JobCategoryModel } from "../models/JobCategory";
import { TimeLogModel } from "../models/TImeLog";
import { JobModel } from "../models/Job";
import { ExpensesModel } from "../models/Expenses";
import { UserModel } from "../models/User";
import job from "./job";



const addClient = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        if (req.user.role !== "superAdmin") {
            req.body.companyId = req.user.companyId;
        }
        await ClientModel.create(req.body);
        SUCCESS(res, 200, "Client added successfully", { data: {} });
    } catch (error) {
        console.log("error in addClient", error);
        next(error);
    }
};
const updateClient = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { clientId } = req.params;
        await ClientModel.findByIdAndUpdate(clientId, req.body, { new: true });
        SUCCESS(res, 200, "Client updated successfully", { data: {} });
    } catch (error) {
        console.log("error in updateClient", error);
        next(error);
    }
}
const getClients = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        let { page = 1, limit = 10, search = "", businessTypeId = "", } = req.query;
        page = parseInt(page as string);
        limit = parseInt(limit as string);
        const skip = (page - 1) * limit;
        const query: any = { status: "active" };
        if (req.user.role !== "superAdmin") {
            query.companyId = req.user.companyId;
        }

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { clientRef: { $regex: search, $options: 'i' } },
            ];
        }

        // Filter by businessTypeId (ObjectId)
        if (businessTypeId) {
            query.businessTypeId = businessTypeId;
        }

        // Execute queries in parallel
        const [clientsDocs, totalClients, breakdown, businessTypes] = await Promise.all([
            ClientModel
                .find(query)
                .skip(skip)
                .limit(limit)
                .populate('businessTypeId')
                .populate({
                    path: 'clientManagerId',
                    select: 'name',
                })
                .select('-__v'),

            ClientModel.countDocuments(query),

            ClientModel.aggregate([
                {
                    $lookup: {
                        from: 'businesscategories',
                        localField: 'businessTypeId',
                        foreignField: '_id',
                        as: 'businessTypeInfo'
                    }
                },
                {
                    $unwind: '$businessTypeInfo'
                },
                {
                    $group: {
                        _id: '$businessTypeInfo.name',
                        count: { $sum: 1 }
                    }
                }
            ]),

            BusinessCategoryModel.find({}).select('name')
        ]);

        let breakdownData: any = { totalClients };

        businessTypes.forEach(bt => {
            console.log(bt);
            const key = bt.name.replace(/\s+/g, '').toLowerCase();
            breakdownData[key] = 0;
        });
        console.log(breakdown);
        breakdown.forEach(item => {
            console.log(item);
            const key = item._id.replace(/\s+/g, '').toLowerCase();
            breakdownData[key] = item.count;
        });
        breakdownData = Object.entries(breakdownData).map(([key, count]) => ({
            name: key,
            count
        }));

        const totalPages = Math.ceil(totalClients / limit);
        const pagination = {
            currentPage: page,
            totalPages,
            totalClients,
            limit
        }
        const normalizedClients = clientsDocs.map((client: any) => {
            const clientObj = client.toObject();
            const managerData = clientObj.clientManagerId;
            let managerName = '';
            let managerId: string | null = null;

            if (managerData && typeof managerData === 'object' && managerData !== null) {
                managerName = managerData.name || '';
                managerId = managerData._id ? String(managerData._id) : null;
            } else if (typeof managerData === 'string') {
                managerId = managerData;
            }

            return {
                ...clientObj,
            clientManagerId: managerId || '',
                clientManager: managerName,
            };
        });

        const response = {
            clients: normalizedClients,
            pagination,
            breakdown: breakdownData,
        };

        SUCCESS(res, 200, "Clients fetched successfully", { data: response });
    } catch (error) {
        console.log("error in getClients", error);
        next(error);
    }
};
const getClientById = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { clientId } = req.params;
        const [client] = await ClientModel.aggregate([
            {
                $match: { _id: ObjectId(clientId) }
            },
            {
                $lookup: {
                    from: 'businesscategories',
                    localField: 'businessTypeId',
                    foreignField: '_id',
                    as: 'businessTypeId'
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'clientManagerId',
                    foreignField: '_id',
                    as: 'clientManagerData'
                }
            },
            {
                $unwind: {
                    path: '$clientManagerData',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $lookup: {
                    from: 'timelogs',
                    localField: '_id',
                    foreignField: 'clientId',
                    as: 'timeLogs',
                    pipeline: [
                        {
                            $lookup: {
                                from: "users",
                                localField: "userId",
                                foreignField: "_id",
                                as: "user",
                                pipeline: [{ $project: { _id: 1, name: 1, avatarUrl: 1 } }]
                            }
                        },
                        { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
                        {
                            $lookup: {
                                from: "timecategories",
                                localField: "timeCategoryId",
                                foreignField: "_id",
                                as: "timeLogCategory",
                                pipeline: [{ $project: { _id: 1, name: 1 } }]
                            }
                        }, {
                            $unwind: { path: "$timeLogCategory", preserveNullAndEmptyArrays: true }
                        },
                        {
                            $lookup: {
                                from: "clients",
                                localField: "clientId",
                                foreignField: "_id",
                                as: "client",
                                pipeline: [{ $project: { _id: 1, name: 1, clientRef: 1 } }]
                            }
                        },
                        { $unwind: { path: "$client", preserveNullAndEmptyArrays: true } },
                        {
                            $lookup: {
                                from: "jobs",
                                localField: "jobId",
                                foreignField: "_id",
                                as: "job",
                                pipeline: [{ $project: { _id: 1, name: 1 } }]
                            }
                        },
                        { $unwind: { path: "$job", preserveNullAndEmptyArrays: true } },
                        {
                            $lookup: {
                                from: "jobcategories",
                                localField: "jobTypeId",
                                foreignField: "_id",
                                as: "jobCategory",
                                pipeline: [{ $project: { _id: 1, name: 1 } }]
                            }
                        },
                        { $unwind: { path: "$jobCategory", preserveNullAndEmptyArrays: true } },
                        {
                            $project: {
                                _id: 1,
                                date: 1,
                                // clientId: 1,
                                // timeCategoryId: 1,
                                // jobId: 1,
                                // userId: 1,
                                // jobTypeId: 1,
                                client: 1,
                                timeLogCategory: 1,
                                user: 1,
                                job: 1,
                                jobCategory: 1,
                                status: 1,
                                duration: 1,
                                amount: 1,
                                rate: 1,
                                description: 1,
                                billable: 1

                            }
                        }
                    ]
                }
            },
            {
                $lookup: {
                    from: 'jobs',
                    localField: '_id',
                    foreignField: 'clientId',
                    as: 'jobs',
                    pipeline: [
                        {
                            $lookup: {
                                from: "timelogs",
                                localField: "_id",
                                foreignField: "jobId",
                                as: "timeLogs",
                                pipeline: [{
                                    $lookup: {
                                        from: "timecategories",
                                        localField: "timeCategoryId",
                                        foreignField: "_id",
                                        as: "timeLogCategory",
                                        pipeline: [{ $project: { _id: 1, name: 1 } }]
                                    }
                                }, {
                                    $unwind: {
                                        path: "$timeLogCategory", preserveNullAndEmptyArrays: true
                                    },
                                },
                                {
                                    $lookup: {
                                        from: "users",
                                        localField: "userId",
                                        foreignField: "_id",
                                        as: "user",
                                        pipeline: [{ $project: { _id: 1, name: 1, avatarUrl: 1 } }]
                                    }
                                },
                                { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
                                {
                                    $project: {
                                        user: 1,
                                        timeLogCategory: 1,
                                        duration: 1,
                                        amount: 1,
                                        rate: 1,
                                        status: 1
                                    }
                                }
                                ]
                            }
                        },
                        {
                            $addFields: {
                                totalTimeLogHours: { $sum: "$timeLogs.duration" },
                                amount: { $sum: "$timeLogs.amount" }
                            }
                        }
                    ]
                }
            },
            {
                $lookup:{
                    from: 'expenses',
                    localField: '_id',
                    foreignField: 'clientId',
                    as: 'expenses',
                    pipeline: [
                        {
                            $project: {
                                _id: 1,
                                totalAmount: 1,
                                date: 1,
                                description: 1,
                                expreseCategory: 1,
                                status: 1
                            }
                        }
                    ]
                }
            },
            {
                $lookup: {
                    from: 'writeoffs',
                    let: { clientId: '$_id', companyId: ObjectId(req.user.companyId) },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ['$companyId', '$$companyId'] }
                            }
                        },
                        { $unwind: '$timeLogs' },
                        {
                            $match: {
                                $expr: { $eq: ['$timeLogs.clientId', '$$clientId'] }
                            }
                        },
                        {
                            $lookup: {
                                from: 'jobs',
                                localField: 'timeLogs.jobId',
                                foreignField: '_id',
                                as: 'jobDetails',
                                pipeline: [{ $project: { _id: 1, name: 1 } }]
                            }
                        },
                        { $unwind: { path: '$jobDetails', preserveNullAndEmptyArrays: true } },
                        {
                            $lookup: {
                                from: 'users',
                                localField: 'performedBy',
                                foreignField: '_id',
                                as: 'performedByDetails',
                                pipeline: [{ $project: { _id: 1, name: 1 } }]
                            }
                        },
                        { $unwind: { path: '$performedByDetails', preserveNullAndEmptyArrays: true } },
                        // First group by write-off document ID and jobId to identify unique occasions per job
                        {
                            $group: {
                                _id: {
                                    writeOffId: '$_id',
                                    jobId: '$timeLogs.jobId'
                                },
                                writeOffId: { $first: '$_id' },
                                jobId: { $first: '$timeLogs.jobId' },
                                jobName: { $first: '$jobDetails.name' },
                                writeOffAmount: { $sum: '$timeLogs.writeOffAmount' },
                                createdAt: { $first: '$createdAt' },
                                reason: { $first: '$reason' },
                                logic: { $first: '$logic' },
                                by: { $first: '$performedByDetails.name' }
                            }
                        },
                        // Then group by jobId to aggregate occasions and amounts
                        {
                            $group: {
                                _id: '$jobId',
                                jobId: { $first: '$jobId' },
                                jobName: { $first: '$jobName' },
                                writeOffOccasions: { $sum: 1 },
                                totalWriteOffAmount: { $sum: '$writeOffAmount' },
                                occasionDetails: {
                                    $push: {
                                        writeOffId: { $toString: { $ifNull: ['$writeOffId', ''] } },
                                        amount: '$writeOffAmount',
                                        date: { $ifNull: ['$createdAt', null] },
                                        reason: { $ifNull: ['$reason', ''] },
                                        logic: { $ifNull: ['$logic', ''] },
                                        by: { $ifNull: ['$by', 'N/A'] }
                                    }
                                }
                            }
                        }
                    ],
                    as: 'writeOffLogs'
                }
            },
            // Lookup notes for this client
            {
                $lookup: {
                    from: 'notes',
                    let: { clientId: '$_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ['$clientId', '$$clientId'] }
                            }
                        },
                        {
                            $lookup: {
                                from: 'users',
                                localField: 'createdBy',
                                foreignField: '_id',
                                as: 'createdBy',
                                pipeline: [{ $project: { _id: 1, name: 1, avatarUrl: 1 } }]
                            }
                        },
                        { $unwind: { path: '$createdBy', preserveNullAndEmptyArrays: true } },
                        {
                            $project: {
                                _id: 1,
                                note: 1,
                                createdAt: 1,
                                updatedAt: 1,
                                createdBy: 1
                            }
                        },
                        { $sort: { createdAt: -1 } }
                    ],
                    as: 'notes'
                }
            }

        ]);

        if (!client) {
            return SUCCESS(res, 200, "Client fetched successfully", { data: null });
        }

        const managerData: any = client.clientManagerData || null;
        let managerId: string | null = null;
        let managerName = '';

        if (managerData && typeof managerData === 'object') {
            managerId = managerData._id ? String(managerData._id) : null;
            managerName = managerData.name || '';
        } else if (client.clientManagerId) {
            managerId = String(client.clientManagerId);
        }

        const normalizedClient = {
            ...client,
            clientManagerId: managerId || '',
            clientManager: managerName,
        };
        delete (normalizedClient as any).clientManagerData;

        SUCCESS(res, 200, "Client fetched successfully", { data: normalizedClient, });
    } catch (error) {
        console.log("error in getClientById", error);
        next(error);
    }
}
const deleteClient = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { clientId } = req.params;
        await ClientModel.findByIdAndUpdate(clientId, { status: "inActive" }, { new: true });
        SUCCESS(res, 200, "Client deleted successfully", { data: {} });
    } catch (error) {
        console.log("error in deleteClient", error);
        next(error);
    }
};
const getClientServices = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        // Extract and parse query parameters
        let { page = 1, limit = 10, search = "", businessTypeId = "" } = req.query;
        page = parseInt(page as string);
        limit = parseInt(limit as string);
        const skip = (page - 1) * limit;
        const companyId = req.user.companyId;
        // Build search query
        const query: any = { status: "active", companyId };
        if (search) {
            query.$or = [
                { clientName: { $regex: search, $options: 'i' } },
                { clientRef: { $regex: search, $options: 'i' } },
            ];
        }
        if (businessTypeId) {
            query.businessTypeId = businessTypeId;
        }

        // Get all available job categories
        const allJobCategories = await JobCategoryModel.find({ companyId }, 'name _id').lean();
        const selectedJobCategories = allJobCategories.map(s => s._id);

        // Build dynamic projection with job category toggles
        const projection: any = {
            clientRef: 1,
            name: 1,
            businessTypeId: 1,
            businessType: { $arrayElemAt: ['$businessType.name', 0] },
            jobCategories: {
                $map: {
                    input: '$jobCategories',
                    as: 'job',
                    in: {
                        _id: '$$job._id',
                        name: '$$job.name'
                    }
                }
            }
        };

        // Add dynamic job category toggle fields
        selectedJobCategories.forEach((service: any) => {
            projection[service.toString()] = {
                $in: [service, '$jobCategories._id']
            };
        });

        // Also add job category name-based toggles for easier frontend usage
        allJobCategories.forEach(service => {
            const fieldName = service.name.toLowerCase().replace(/\s+/g, '');
            projection[fieldName] = {
                $in: [service.name, '$jobCategories.name']
            };
        });

        // Execute aggregation with facet for multiple operations
        const [result] = await ClientModel.aggregate([
            {
                $facet: {
                    // Get total count for pagination
                    total: [
                        { $match: query },
                        { $count: "count" }
                    ],

                    // Get paginated client data
                    data: [
                        { $match: query },
                        { $sort: { clientName: 1 } },
                        { $skip: skip },
                        { $limit: limit },
                        {
                            $lookup: {
                                from: 'businesscategories',
                                localField: 'businessTypeId',
                                foreignField: '_id',
                                as: 'businessType'
                            }
                        },
                        {
                            $lookup: {
                                from: 'servicescategories',
                                localField: 'services',
                                foreignField: '_id',
                                as: 'serviceDetails'
                            }
                        },
                        {
                            $lookup: {
                                from: 'jobcategories',
                                localField: 'jobCategories',
                                foreignField: '_id',
                                as: 'jobCategories'
                            }
                        },
                        {
                            $project: projection
                        }
                    ],

                    // Filtered job category counts for filtered/searched clients
                    filteredJobCategoriesCounts: [
                        { $match: query },
                        { $unwind: '$jobCategories' },
                        {
                            $group: {
                                _id: '$jobCategories',
                                count: { $sum: 1 }
                            }
                        },
                        {
                            $lookup: {
                                from: 'jobcategories',
                                localField: '_id',
                                foreignField: '_id',
                                as: 'jobCategoryInfo'
                            }
                        },
                        { $unwind: '$jobCategoryInfo' },
                        {
                            $project: {
                                serviceId: '$_id',
                                serviceName: '$jobCategoryInfo.name',
                                count: 1,
                                _id: 0
                            }
                        },
                        { $sort: { count: -1 } }
                    ],

                    // Global job category counts for all clients (for UI breakdown cards)
                    globalJobCategoriesCounts: [
                        { $match: { status: "active", companyId } },
                        { $unwind: '$jobCategories' },
                        {
                            $group: {
                                _id: '$jobCategories',
                                count: { $sum: 1 }
                            }
                        },
                        {
                            $lookup: {
                                from: 'jobcategories',
                                localField: '_id',
                                foreignField: '_id',
                                as: 'jobCategoryInfo'
                            }
                        },
                        { $unwind: '$jobCategoryInfo' },
                        {
                            $project: {
                                serviceId: '$_id',
                                serviceName: '$jobCategoryInfo.name',
                                count: 1,
                                _id: 0
                            }
                        },
                        { $sort: { count: -1 } }
                    ]
                }
            }
        ]).allowDiskUse(true).exec();

        // Extract results from aggregation
        const clients = result.data;
        const totalClients = result.total[0]?.count || 0;
        const filteredJobCategoriesCounts = result.filteredJobCategoriesCounts;
        const globalJobCategoriesCounts = result.globalJobCategoriesCounts;

        // Create maps for efficient lookup
        const filteredCountsMap = new Map();
        filteredJobCategoriesCounts.forEach((s: any) => {
            filteredCountsMap.set(s.serviceId.toString(), s.count);
        });

        console.log("globalJobCategoriesCounts", globalJobCategoriesCounts,);
        const globalCountsMap = new Map();
        globalJobCategoriesCounts.forEach((s: any) => {
            globalCountsMap.set(s.serviceId.toString(), s.count);
        });

        // Merge with all services to include zero counts
        const completeFilteredCounts = allJobCategories.map(service => ({
            jobCategoryId: service._id,
            jobCategoryName: service.name,
            count: filteredCountsMap.get(service._id.toString()) || 0
        }));

        const completeGlobalCounts = allJobCategories.map(service => ({
            jobCategoryId: service._id,
            jobCategoryName: service.name,
            count: globalCountsMap.get(service._id.toString()) || 0
        }));

        // Calculate pagination
        const totalPages = Math.ceil(totalClients / limit);
        const pagination = {
            currentPage: page,
            totalPages,
            totalClients,
            limit,
        };

        // Send response
        SUCCESS(res, 200, "Clients fetched successfully", {
            data: clients,
            pagination,
            breakdown: completeGlobalCounts,
            filteredCounts: completeFilteredCounts,
        });

    } catch (error) {
        console.log("error in getClientServices", error);
        next(error);
    }
};

const updateClientService = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { clientJobCategories } = req.body;
        for (const jobCategory of clientJobCategories) {
            const { clientId, jobCategoriesIds } = jobCategory;
            await ClientModel.findByIdAndUpdate(clientId, { jobCategories: jobCategoriesIds }, { new: true });

        }
        SUCCESS(res, 200, "Client updated successfully", {});
    } catch (error) {
        console.log("error in updateClientService", error);
        next(error);
    }
};


const getClientBreakdown = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const companyId = req.user.companyId;

        // Pagination params
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;
        const search = req.query.search as string || '';

        // Base client match condition
        const baseMatch: any = {
            companyId: ObjectId(companyId),
            status: 'active'
        };

        if (search) {
            const searchRegex = new RegExp(search, 'i');
            baseMatch.$or = [
                { name: { $regex: searchRegex } },
                { clientRef: { $regex: searchRegex } }
            ];
        }

        // Main aggregation pipeline
        const pipeline: any[] = [
            { $match: baseMatch },

            // Lookup jobs for this client
            {
                $lookup: {
                    from: 'jobs',
                    let: { clientId: '$_id', companyId: '$companyId' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$clientId', '$$clientId'] },
                                        { $eq: ['$companyId', '$$companyId'] }
                                    ]
                                }
                            }
                        },
                        {
                            $lookup: {
                                from: 'timelogs',
                                let: { jobId: '$_id' },
                                pipeline: [
                                    {
                                        $match: {
                                            $expr: {
                                                $and: [
                                                    { $eq: ['$jobId', '$$jobId'] },
                                                    { $eq: ['$billable', true] }
                                                ]
                                            }
                                        }
                                    },
                                    {
                                        $lookup: {
                                            from: 'users',
                                            localField: 'userId',
                                            foreignField: '_id',
                                            as: 'user',
                                            pipeline: [{ $project: { _id: 1, name: 1, avatarUrl: 1 } }]
                                        }
                                    },
                                    {$unwind: { path: '$user' , preserveNullAndEmptyArrays: true } },
                                    {$lookup: {
                                        from: 'timecategories',
                                        localField: 'timeCategoryId',
                                        foreignField: '_id',
                                        as: 'timeCategory',
                                        pipeline: [{ $project: { _id: 1, name: 1 } }]
                                    }},
                                    {$unwind: { path: '$timeCategory' , preserveNullAndEmptyArrays: true } },
                                  
                                ],
                                as: 'timeLogs'
                            }
                        },
                        {
                            $addFields: {
                                totalLogDuration: { $sum: '$timeLogs.duration' }
                            }
                        },
                        {
                            $project: {
                                _id: 1,
                                name: 1,
                                status: 1,
                                timeLogs: 1,
                                totalLogDuration: 1
                            }
                        }
                    ],
                    as: 'allJobs'
                }
            },

            // Lookup WIP (unbilled time logs)
            {
                $lookup: {
                    from: 'timelogs',
                    let: { clientId: '$_id', companyId: '$companyId' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$clientId', '$$clientId'] },
                                        { $eq: ['$companyId', '$$companyId'] },
                                        { $eq: ['$billable', true] },
                                        { $eq: ['$status', 'notInvoiced'] }
                                    ]
                                }
                            }
                        },
                        {
                            $group: {
                                _id: null,
                                totalWipAmount: { $sum: '$amount' },
                                totalWipDuration: { $sum: '$duration' }
                            }
                        }
                    ],
                    as: 'wipData'
                }
            },
            {
                $addFields: {
                    wipAmount: {
                        $ifNull: [{ $arrayElemAt: ['$wipData.totalWipAmount', 0] }, 0]
                    },
                    wipDuration: {
                        $ifNull: [{ $arrayElemAt: ['$wipData.totalWipDuration', 0] }, 0]
                    }
                }
            },

            // Lookup invoices for this client
            {
                $lookup: {
                    from: 'invoices',
                    let: { clientId: '$_id', companyId: '$companyId' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$clientId', '$$clientId'] },
                                        { $eq: ['$companyId', '$$companyId'] }
                                    ]
                                }
                            }
                        },
                        {
                            $addFields: {
                                balance: { $subtract: ['$totalAmount', '$paidAmount'] }
                            }
                        },
                        {
                            $group: {
                                _id: null,
                                totalInvoices: { $sum: 1 },
                                totalInvoiceAmount: { $sum: '$totalAmount' },
                                totalOutstanding: { $sum: '$balance' },
                                totalPaid: { $sum: '$paidAmount' },
                            }
                        }
                    ],
                    as: 'invoiceData'
                }
            },
            {
                $addFields: {
                    totalInvoices: {
                        $ifNull: [{ $arrayElemAt: ['$invoiceData.totalInvoices', 0] }, 0]
                    },
                    totalOutstanding: {
                        $ifNull: [{ $arrayElemAt: ['$invoiceData.totalOutstanding', 0] }, 0]
                    },
                    totalPaid: {
                        $ifNull: [{ $arrayElemAt: ['$invoiceData.totalPaid', 0] }, 0]
                    },
                    totalInvoiceAmount: {
                        $ifNull: [{ $arrayElemAt: ['$invoiceData.totalInvoiceAmount', 0] }, 0]
                    }
                }
            },

            // Lookup expenses for this client
            {
                $lookup: {
                    from: 'expenses',
                    let: { clientId: '$_id', companyId: '$companyId' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$clientId', '$$clientId'] },
                                        { $eq: ['$companyId', '$$companyId'] }
                                    ]
                                }
                            }
                        },
                        {
                            $group: {
                                _id: null,
                                totalExpenses: { $sum: '$totalAmount' }
                            }
                        }
                    ],
                    as: 'expenseData'
                }
            },
            {
                $addFields: {
                    totalExpenses: {
                        $ifNull: [{ $arrayElemAt: ['$expenseData.totalExpenses', 0] }, 0]
                    }
                }
            },

            // Lookup write-offs for this client
            {
                $lookup: {
                    from: 'writeoffs',
                    let: { clientId: '$_id', companyId: '$companyId' },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ['$companyId', '$$companyId'] }
                            }
                        },
                        { $unwind: '$timeLogs' },
                        {
                            $match: {
                                $expr: { $eq: ['$timeLogs.clientId', '$$clientId'] }
                            }
                        },
                        {
                            $group: {
                                _id: null,
                                totalWriteOffAmount: { $sum: '$timeLogs.writeOffAmount' }
                            }
                        }
                    ],
                    as: 'writeOffData'
                }
            },
            {
                $addFields: {
                    totalWriteOffAmount: {
                        $ifNull: [{ $arrayElemAt: ['$writeOffData.totalWriteOffAmount', 0] }, 0]
                    }
                }
            },

            // Lookup notes for this client
            {
                $lookup: {
                    from: 'notes',
                    let: { clientId: '$_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ['$clientId', '$$clientId'] }
                            }
                        },
                        {
                            $lookup: {
                                from: 'users',
                                localField: 'createdBy',
                                foreignField: '_id',
                                as: 'createdBy',
                                pipeline: [{ $project: { _id: 1, name: 1, avatarUrl: 1 } }]
                            }
                        },
                        { $unwind: { path: '$createdBy', preserveNullAndEmptyArrays: true } },
                        {
                            $project: {
                                _id: 1,
                                note: 1,
                                createdAt: 1,
                                updatedAt: 1,
                                createdBy: 1
                            }
                        },
                        { $sort: { createdAt: -1 } }
                    ],
                    as: 'notes'
                }
            },
            // jobCategory
            {
                $lookup: {
                    from: 'jobcategories',
                    localField: 'jobCategories',
                    foreignField: '_id',
                    as: 'jobCategory'
                }
            },

            // Calculate derived fields
            {
                $addFields: {
                    // WIP + Outstanding 
                    wipPlusOutstanding: { $add: ['$wipAmount', '$totalOutstanding'] },
                    // Average Balance
                    averageBalance: {
                        $cond: [
                            { $gt: ['$totalInvoices', 0] },
                            { $divide: ['$totalOutstanding', '$totalInvoices'] },
                            0
                        ]
                    },

                    totalLogDuration: { $sum: '$allJobs.totalLogDuration' }
                }
            },


            // Project final fields
            {
                $project: {
                    _id: 1,
                    clientRef: 1,
                    name: 1,
                    email: 1,
                    phone: 1,
                    status: 1,
                    allJobs: 1,
                    totalLogDuration: 1,
                    jobCategory: 1,
                    totalOutstanding: { $round: ['$totalOutstanding', 2] },
                    wipAmount: { $round: ['$wipAmount', 2] },
                    totalInvoices: 1,
                    totalInvoiceAmount: { $round: ['$totalInvoiceAmount', 2] },
                    totalPaid: { $round: ['$totalPaid', 2] },
                    wipPlusOutstanding: { $round: ['$wipPlusOutstanding', 2] },
                    averageBalance: { $round: ['$averageBalance', 2] },
                    totalExpenses: { $round: ['$totalExpenses', 2] },
                    totalWriteOffAmount: { $round: ['$totalWriteOffAmount', 2] },
                    notes: 1,
                    createdAt: 1
                }
            },

            // Sort by client name
            { $sort: { name: 1 } },

            // Facet for pagination and total count
            {
                $facet: {
                    data: [
                        { $skip: skip },
                        { $limit: limit }
                    ],
                    totalCount: [{ $count: 'count' }]
                }
            }
        ];

        // Execute aggregation
        const result = await ClientModel.aggregate(pipeline).collation({ locale: "en", strength: 2 });
        const clientBreakdown = result[0].data;
        const totalCount = result[0].totalCount[0]?.count || 0;

        // Calculate summary totals
        const summaryPipeline = [
            { $match: baseMatch },
            {
                $lookup: {
                    from: 'jobs',
                    let: { clientId: '$_id', companyId: '$companyId' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$clientId', '$$clientId'] },
                                        { $eq: ['$companyId', '$$companyId'] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: 'jobs'
                }
            },
            {
                $lookup: {
                    from: 'timelogs',
                    let: { clientId: '$_id', companyId: '$companyId' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$clientId', '$$clientId'] },
                                        { $eq: ['$companyId', '$$companyId'] },
                                        { $eq: ['$billable', true] },
                                        { $eq: ['$status', 'notInvoiced'] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: 'wipLogs'
                }
            },
            {
                $lookup: {
                    from: 'invoices',
                    let: { clientId: '$_id', companyId: '$companyId' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$clientId', '$$clientId'] },
                                        { $eq: ['$companyId', '$$companyId'] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: 'invoices'
                }
            },
            {
                $lookup: {
                    from: 'expenses',
                    let: { clientId: '$_id', companyId: '$companyId' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$clientId', '$$clientId'] },
                                        { $eq: ['$companyId', '$$companyId'] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: 'expenses'
                }
            },
            {
                $lookup: {
                    from: 'writeoffs',
                    let: { clientId: '$_id', companyId: '$companyId' },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ['$companyId', '$$companyId'] }
                            }
                        },
                        { $unwind: '$timeLogs' },
                        {
                            $match: {
                                $expr: { $eq: ['$timeLogs.clientId', '$$clientId'] }
                            }
                        },
                        {
                            $group: {
                                _id: null,
                                totalWriteOffAmount: { $sum: '$timeLogs.writeOffAmount' }
                            }
                        }
                    ],
                    as: 'writeOffs'
                }
            },
            {
                $addFields: {
                    wipAmount: { $sum: '$wipLogs.amount' },
                    totalOutstanding: {
                        $sum: {
                            $map: {
                                input: '$invoices',
                                as: 'inv',
                                in: { $subtract: ['$$inv.totalAmount', '$$inv.paidAmount'] }
                            }
                        }
                    },
                    totalWriteOffAmount: {
                        $ifNull: [{ $arrayElemAt: ['$writeOffs.totalWriteOffAmount', 0] }, 0]
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    totalClients: { $sum: 1 },
                    totalJobs: { $sum: { $size: '$jobs' } },
                    totalOutstanding: { $sum: '$totalOutstanding' },
                    totalWipAmount: { $sum: '$wipAmount' },
                    totalInvoices: { $sum: { $size: '$invoices' } },
                    totalExpenses: { $sum: { $sum: '$expenses.totalAmount' } },
                    totalWriteOffAmount: { $sum: '$totalWriteOffAmount' }
                }
            }
        ];

        const summaryResult = await ClientModel.aggregate(summaryPipeline);
        const summary = summaryResult[0] || {
            totalClients: 0,
            totalJobs: 0,
            totalOutstanding: 0,
            totalWipAmount: 0,
            totalInvoices: 0,
            totalExpenses: 0,
            totalWriteOffAmount: 0
        };



        return res.status(200).json({
            success: true,
            message: "Client breakdown fetched successfully",
            data: {
                clients: clientBreakdown,

                summary: {
                    totalClients: summary.totalClients,
                    totalJobs: summary.totalJobs,
                    totalOutstanding: parseFloat(summary.totalOutstanding.toFixed(2)),
                    totalWipAmount: parseFloat(summary.totalWipAmount.toFixed(2)),
                    totalInvoices: summary.totalInvoices,
                    totalExpenses: parseFloat(summary.totalExpenses.toFixed(2)),
                    totalWriteOffAmount: parseFloat((summary.totalWriteOffAmount || 0).toFixed(2))
                },
                pagination: {
                    page,
                    limit,
                    totalCount,
                    totalPages: Math.ceil(totalCount / limit),
                }
            }
        });
    } catch (error) {
        console.log("error in getClientBreakdown", error);
        next(error);
    }
};

const importClients = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { clients } = req.body;
        const companyId = req.user.companyId;

        if (!Array.isArray(clients) || clients.length === 0) {
            throw new BadRequestError("Clients array is required and must not be empty");
        }

        // Get all business types and team members for the company to map names to IDs
        const [businessTypes, teamMembers] = await Promise.all([
            BusinessCategoryModel.find({ companyId }).lean(),
            UserModel.find({ companyId, role: { $ne: 'superadmin' } }).lean()
        ]);

        // Create maps for quick lookup (using Map that can be updated during import)
        const businessTypeMap = new Map(businessTypes.map((bt: any) => [bt.name.toLowerCase().trim(), { id: bt._id, name: bt.name }]));
        const teamMemberMap = new Map(teamMembers.map((tm: any) => [tm.name.toLowerCase().trim(), tm._id]));

        const importedClients = [];
        const errors = [];

        // Helper function to get or create business type
        const getOrCreateBusinessType = async (businessTypeName: string): Promise<any> => {
            if (!businessTypeName) return null;
            
            const businessTypeKey = businessTypeName.toLowerCase().trim();
            const existing = businessTypeMap.get(businessTypeKey);
            
            if (existing) {
                return existing.id;
            }
            
            // Create new business type
            try {
                const newBusinessType = await BusinessCategoryModel.create({
                    name: businessTypeName.trim(),
                    companyId: companyId
                });
                
                // Update map for future lookups
                businessTypeMap.set(businessTypeKey, { id: newBusinessType._id, name: newBusinessType.name });
                
                return newBusinessType._id;
            } catch (error: any) {
                console.error(`Error creating business type "${businessTypeName}":`, error);
                throw new Error(`Failed to create business type "${businessTypeName}": ${error.message}`);
            }
        };

        for (let i = 0; i < clients.length; i++) {
            const clientData = clients[i];
            try {
                // Map Excel columns to client fields
                const clientRef = (clientData['CLIENT REF.'] || clientData['CLIENT REF'] || '').toString().trim() || 'N/A';
                const name = (clientData['CLIENT NAME'] || '').toString().trim();
                const clientManagerName = (clientData['CLIENT MANAGER'] || '').toString().trim();
                const clientStatus = (clientData['CLIENT STATUS'] || 'Current').toString().trim();
                const businessTypeName = (clientData['BUSINESS TYPE'] || '').toString().trim();
                const taxNumber = (clientData['TAX/PPS NO.'] || clientData['TAX/PPS NO'] || '').toString().trim();
                const yearEnd = (clientData['YEAR END'] || '').toString().trim();
                const audit = (clientData['IN AUDIT'] || '').toString().trim().toLowerCase();
                const croNumber = (clientData['CRO NO.'] || clientData['CRO NO'] || '').toString().trim() || '';
                const croLink = (clientData['CRO LINK'] || '').toString().trim() || '';
                const arDateStr = clientData['AR DATE'];
                const address = (clientData['ADDRESS'] || '').toString().trim() || 'N/A';
                const phone = (clientData['PHONE'] || '').toString().trim() || 'N/A';
                const phoneNote = (clientData['PHONE NOTE'] || '').toString().trim() || 'N/A';
                const email = (clientData['EMAIL'] || '').toString().trim() || '';
                const emailNote = (clientData['EMAIL NOTE'] || '').toString().trim() || 'N/A';
                const onboardedDateStr = clientData['ONBOARDED DATE'];
                const amlCompliant = (clientData['AML COMPLAINT'] || clientData['AML COMPLAINT'] || '').toString().trim().toLowerCase();
                const wipBalance = parseFloat(clientData['WIP BALANCE'] || clientData['WIP BALANCE'] || '0') || 0;
                const debtorsBalance = parseFloat(clientData['DEBTORS BALANCE'] || clientData['DEBTORS BALA'] || '0') || 0;

                // Validate required fields
                if (!name) {
                    errors.push({ row: i + 2, error: `Row ${i + 2}: Client name is required` });
                    continue;
                }

                if (!taxNumber) {
                    errors.push({ row: i + 2, error: `Row ${i + 2}: Tax number is required` });
                    continue;
                }

                // Get or create business type
                let businessTypeId = null;
                if (businessTypeName) {
                    try {
                        businessTypeId = await getOrCreateBusinessType(businessTypeName);
                    } catch (error: any) {
                        errors.push({ row: i + 2, error: `Row ${i + 2}: ${error.message}` });
                        continue;
                    }
                }

                // Map client manager name to ID
                let clientManagerId = null;
                if (clientManagerName) {
                    const managerKey = clientManagerName.toLowerCase().trim();
                    clientManagerId = teamMemberMap.get(managerKey);
                    // Don't error if manager not found, just skip it
                }

                // Parse dates
                let onboardedDate = new Date();
                if (onboardedDateStr) {
                    const parsedDate = new Date(onboardedDateStr);
                    if (!isNaN(parsedDate.getTime())) {
                        onboardedDate = parsedDate;
                    }
                }

                let arDate = undefined;
                if (arDateStr) {
                    const parsedArDate = new Date(arDateStr);
                    if (!isNaN(parsedArDate.getTime())) {
                        arDate = parsedArDate;
                    }
                }

                // Convert boolean fields
                const auditValue = audit === 'yes' || audit === 'true' || audit === '1';
                const amlCompliantValue = amlCompliant === 'yes' || amlCompliant === 'true' || amlCompliant === '1';

                // Validate client status
                const validStatuses = ['Prospect', 'Current', 'Archived'];
                const finalClientStatus = validStatuses.includes(clientStatus) ? clientStatus : 'Current';

                // Create client object
                const clientToCreate: any = {
                    companyId,
                    clientRef,
                    name,
                    businessTypeId,
                    taxNumber,
                    croNumber: croNumber || '',
                    croLink: croLink || '',
                    clientManagerId: clientManagerId || undefined,
                    address: address || 'N/A',
                    email: email || '',
                    emailNote: emailNote || 'N/A',
                    phone: phone || 'N/A',
                    phoneNote: phoneNote || 'N/A',
                    onboardedDate,
                    amlCompliant: amlCompliantValue,
                    audit: auditValue,
                    clientStatus: finalClientStatus,
                    yearEnd: yearEnd || '',
                    arDate: arDate || undefined,
                    status: 'active',
                    services: [],
                    jobCategories: [],
                    wipBalance: wipBalance || 0,
                    debtorsBalance: debtorsBalance || 0,
                };

                const createdClient = await ClientModel.create(clientToCreate);
                importedClients.push({ row: i + 2, clientId: createdClient._id, name: createdClient.name });
            } catch (error: any) {
                errors.push({ row: i + 2, error: `Row ${i + 2}: ${error.message || 'Failed to import client'}` });
            }
        }

        SUCCESS(res, 200, "Clients imported successfully", {
            data: {
                imported: importedClients.length,
                failed: errors.length,
                importedClients,
                errors: errors.length > 0 ? errors : undefined
            }
        });
    } catch (error) {
        console.log("error in importClients", error);
        next(error);
    }
};

export default { addClient, updateClient, getClients, getClientServices, updateClientService, getClientById, deleteClient, getClientBreakdown, importClients };