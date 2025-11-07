import { NextFunction, Request, Response } from "express";
import { InvoiceModel } from "../models/Invoice";
import { BadRequestError } from "../utils/errors";
import { WriteOffModel } from "../models/WriteOff";
import { InvoiceLogModel } from "../models/InvoiceLog";
import { ERROR, SUCCESS } from "../utils/response";
import { ObjectId } from "../utils/utills";
import { pipeline } from "stream";

const createWriteOff = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        let { invoiceNo, amount, date, writeOffData } = req.body;
        const invoice: any = await InvoiceModel.findOne({ invoiceNo });
        if (!invoice) {
            throw new BadRequestError("Invoice not found");
        };
        writeOffData.invoiceId = invoice._id;
        writeOffData.companyId = req.user.companyId;
        writeOffData.performedBy = req.userId;

        const writeOff = await WriteOffModel.create(writeOffData);
        invoice.totalAmount = amount;
        await invoice.save();
        await InvoiceLogModel.create({ invoiceId: invoice._id, action: 'writeOff', amount: writeOff.totalWriteOffAmount, date, companyId: req.user.companyId, performedBy: req.userId });
        SUCCESS(res, 200, "Write off created successfully", { data: writeOff });
    } catch (error) {
        console.log("error in createWriteOff", error);
        next(error);
    }
};
const getWriteOff = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        let { page = 1, limit = 10, startDate, endDate, search, clientId, jobId, logic } = req.query;
        page = parseInt(page as string);
        limit = parseInt(limit as string);
        const skip = (page - 1) * limit;

        const query: any = { companyId: req.user.companyId };

        if (startDate && endDate) {
            query.createdAt = {
                $gte: new Date(startDate as string),
                $lte: new Date(endDate as string)
            };
        }

        // Build match conditions for filters (applied after unwind)
        const matchConditions: any[] = [];

        // Client filter - handle comma-separated IDs
        if (clientId) {
            const clientIds = (clientId as string).split(',').map(id => id.trim()).filter(id => id && id.length === 24);
            if (clientIds.length > 0) {
                try {
                    const validClientIds = clientIds.filter(id => {
                        try {
                            ObjectId(id);
                            return true;
                        } catch {
                            return false;
                        }
                    });
                    if (validClientIds.length > 0) {
                        matchConditions.push({
                            'timeLogs.clientId': { $in: validClientIds.map(id => ObjectId(id)) }
                        });
                    }
                } catch (e) {
                    console.log('Error parsing clientIds:', e);
                }
            }
        }

        // Job filter - handle comma-separated IDs
        if (jobId) {
            const jobIds = (jobId as string).split(',').map(id => id.trim()).filter(id => id && id.length === 24);
            if (jobIds.length > 0) {
                try {
                    const validJobIds = jobIds.filter(id => {
                        try {
                            ObjectId(id);
                            return true;
                        } catch {
                            return false;
                        }
                    });
                    if (validJobIds.length > 0) {
                        matchConditions.push({
                            'timeLogs.jobId': { $in: validJobIds.map(id => ObjectId(id)) }
                        });
                    }
                } catch (e) {
                    console.log('Error parsing jobIds:', e);
                }
            }
        }

        // Logic filter
        if (logic && logic !== 'all') {
            matchConditions.push({
                logic: logic
            });
        }

        const pipeline: any[] = [
            { $match: query },
            // Flatten timeLogs
            { $unwind: '$timeLogs' },
        ];

        // Apply filter match conditions if any (after unwind)
        if (matchConditions.length > 0) {
            pipeline.push({
                $match: {
                    $and: matchConditions
                }
            });
        }

        // Continue with lookups
        pipeline.push(
            // Lookup related collections
            {
                $lookup: {
                    from: 'clients',
                    localField: 'timeLogs.clientId',
                    foreignField: '_id',
                    as: 'clientDetails',
                    pipeline: [{ $project: { _id: 1, name: 1, clientRef: 1 } }]
                }
            },
            { $unwind: { path: '$clientDetails', preserveNullAndEmptyArrays: true } },

            {
                $lookup: {
                    from: 'jobs',
                    localField: 'timeLogs.jobId',
                    foreignField: '_id',
                    as: 'jobDetails'
                }
            },
            { $unwind: { path: '$jobDetails', preserveNullAndEmptyArrays: true } },

            {
                $lookup: {
                    from: 'users',
                    localField: 'performedBy',
                    foreignField: '_id',
                    as: 'performedByDetails'
                }
            },
            { $unwind: { path: '$performedByDetails', preserveNullAndEmptyArrays: true } },

            // Shape the final structure
            {
                $project: {
                    _id: 1,
                    clientDetails: { $ifNull: ['$clientDetails', 'N/A'] },
                    jobDetails: { $ifNull: ['$jobDetails', 'N/A'] },
                    amount: '$timeLogs.writeOffAmount',
                    originalAmount: '$timeLogs.originalAmount',
                    writeOffPercentage: '$timeLogs.writeOffPercentage',
                    by: { $ifNull: ['$performedByDetails.name', 'N/A'] },
                    reason: '$reason',
                    logic: '$logic',
                    createdAt: '$createdAt',
                    invoiceId: '$invoiceId',
                    timeLogId: '$timeLogs.timeLogId'
                }
            },
            {
                $group: {
                    _id: '$_id',
                    clientDetails: { $first: '$clientDetails' },
                    jobs: { $addToSet: '$jobDetails' },
                    amount: { $first: '$amount' },
                    originalAmount: { $first: '$originalAmount' },
                    writeOffPercentage: { $first: '$writeOffPercentage' },
                    by: { $first: '$by' },
                    reason: { $first: '$reason' },
                    logic: { $first: '$logic' },
                    createdAt: { $first: '$createdAt' },
                    invoiceId: { $first: '$invoiceId' },
                }
            }
        );

        // Apply search filter if provided (after grouping)
        if (search && typeof search === 'string' && search.trim()) {
            const searchRegex = new RegExp(search.trim(), 'i');
            pipeline.push({
                $match: {
                    $or: [
                        { 'clientDetails.name': searchRegex },
                        { 'jobs.name': searchRegex },
                        { reason: searchRegex },
                        { by: searchRegex } // Submitted By name (performedByDetails.name)
                    ]
                }
            });
        }

        // Sort by date
        pipeline.push({ $sort: { createdAt: -1 } });

        // Pagination + totals
        pipeline.push({
            $facet: {
                data: [{ $skip: skip }, { $limit: limit }],
                total: [{ $count: "count" }],
                totalWriteOffs: [
                    {
                        $group: {
                            _id: null,
                            totalAmount: { $sum: "$amount" }
                        }
                    }
                ]
            }
        });

        const results = await WriteOffModel.aggregate(pipeline);

        const total = results[0].total[0]?.count || 0;
        const totalWriteOffs = results[0].totalWriteOffs[0]?.totalAmount || 0;
        const writeOffs = results[0].data;

        const pagination = {
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            total,
            limit
        };

        SUCCESS(res, 200, "Write off fetched successfully", {
            data: writeOffs,
            totalWriteOffs: parseFloat(totalWriteOffs.toFixed(2)),
            pagination
        });
    } catch (error) {
        console.log("error in getWriteOff", error);
        next(error);
    }
};

// Unified Write-offs Dashboard with Dynamic Grouping
// const getWriteOffsDashboard = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
//     try {
//         let { 
//             type = 'client', 
//             page = 1, 
//             limit = 10, 
//             search = "", 
//             clientId, 
//             jobId,
//             startDate, 
//             endDate 
//         } = req.query;

//         // Validate type parameter
//         const validTypes = ['client', 'job', 'jobtype', 'team'];
//         if (!validTypes.includes(type as string)) {
//             return ERROR(res, 400, `Invalid type parameter. Must be one of: ${validTypes.join(', ')}`);
//         }

//         page = parseInt(page as string);
//         limit = parseInt(limit as string);
//         const skip = (page - 1) * limit;

//         const companyId = req.user.companyId;
//         const query: any = { companyId };

//         // Date filter
//         if (startDate && endDate) {
//             query.createdAt = {
//                 $gte: new Date(startDate as string),
//                 $lte: new Date(endDate as string)
//             };
//         }

//         // Build dynamic aggregation pipeline based on type
//         const pipeline = buildDynamicPipeline(
//             type as string, 
//             query, 
//             search as string, 
//             clientId as string, 
//             jobId as string,
//             skip, 
//             limit
//         );

//         const results = await WriteOffModel.aggregate(pipeline);

//         // Extract results
//         const data = results[0]?.data || [];
//         const totalCount = results[0]?.totalCount[0]?.count || 0;
//         const dashboardStats = results[0]?.dashboardStats[0] || {
//             totalWriteOffs: 0,
//             totalOccasions: 0,
//             totalJobs: 0,
//             totalFees: 0,
//             avgWriteOffPercentage: 0
//         };

//         const pagination = {
//             currentPage: page,
//             totalPages: Math.ceil(totalCount / limit),
//             total: totalCount,
//             limit: limit,
//         };

//         SUCCESS(res, 200, `Write-offs by ${type} fetched successfully`, {
//             type: type,
//             summary: {
//                 totalWriteOffs: dashboardStats.totalWriteOffs,
//                 totalOccasions: dashboardStats.totalOccasions,
//                 jobsWithWriteOffs: dashboardStats.totalJobs,
//                 avgWriteOffPercentage: `${dashboardStats.avgWriteOffPercentage}%`
//             },
//             totals: {
//                 occasions: dashboardStats.totalOccasions,
//                 writeOffValue: dashboardStats.totalWriteOffs,
//                 jobs: dashboardStats.totalJobs,
//                 totalFees: dashboardStats.totalFees,
//                 avgWriteOffPercentage: `${dashboardStats.avgWriteOffPercentage}%`
//             },
//             data,
//             pagination
//         });
//     } catch (error) {
//         console.log("error in getWriteOffsDashboard", error);
//         next(error);
//     }
// };

// Dynamic Pipeline Builder Function
function buildDynamicPipeline(
    type: string,
    query: any,
    search: string,
    clientId: string,
    jobId: string,
    skip: number,
    limit: number
): any[] {
    // Common initial stages
    const commonPipeline: any[] = [
        { $match: query },
        { $unwind: '$timeLogs' }
    ];

    // Add client filter if provided
    if (clientId) {
        commonPipeline.push({
            $match: {
                'timeLogs.clientId': ObjectId(clientId)
            }
        });
    }

    // Add job filter if provided
    if (jobId) {
        commonPipeline.push({
            $match: {
                'timeLogs.jobId': ObjectId(jobId)
            }
        });
    }

    // Type-specific pipeline configurations
    let lookupStages: any[] = [];
    let groupStage: any = {};
    let searchMatch: any = {};

    switch (type) {
        case 'client':
            // Lookup client details
            lookupStages = [
                {
                    $lookup: {
                        from: 'clients',
                        localField: 'timeLogs.clientId',
                        foreignField: '_id',
                        as: 'clientDetails'
                    }
                },
                { $unwind: { path: '$clientDetails', preserveNullAndEmptyArrays: true } }
            ];

            // Search filter
            if (search) {
                searchMatch = {
                    $match: {
                        'clientDetails.name': { $regex: search, $options: 'i' }
                    }
                };
            }

            // Group by client
            groupStage = {
                $group: {
                    _id: '$timeLogs.clientId',
                    clientRef: { $first: '$clientDetails.clientRef' },
                    name: { $first: '$clientDetails.name' },
                    occasionDetails: { $addToSet: '$' },

                    occasions: { $sum: 1 },

                    totalWriteOffValue: { $sum: '$timeLogs.writeOffAmount' },
                    totalFees: { $sum: '$timeLogs.originalAmount' },
                    jobsWithWriteOff: { $addToSet: '$timeLogs.jobId' }
                }
            };
            break;

        case 'job':
            // Lookup job and client details
            lookupStages = [
                {
                    $lookup: {
                        from: 'jobs',
                        localField: 'timeLogs.jobId',
                        foreignField: '_id',
                        as: 'jobDetails'
                    }
                },
                { $unwind: { path: '$jobDetails', preserveNullAndEmptyArrays: true } },
                {
                    $lookup: {
                        from: 'clients',
                        localField: 'timeLogs.clientId',
                        foreignField: '_id',
                        as: 'clientDetails'
                    }
                },
                { $unwind: { path: '$clientDetails', preserveNullAndEmptyArrays: true } }
            ];

            // Search filter
            if (search) {
                searchMatch = {
                    $match: {
                        $or: [
                            { 'jobDetails.name': { $regex: search, $options: 'i' } },
                            { 'clientDetails.name': { $regex: search, $options: 'i' } }
                        ]
                    }
                };
            }

            // Group by job
            groupStage = {
                $group: {
                    _id: '$timeLogs.jobId',
                    jobRef: { $first: '$jobDetails.jobRef' },
                    jobName: { $first: '$jobDetails.name' },
                    clientName: { $first: '$clientDetails.name' },
                    clientRef: { $first: '$clientDetails.clientRef' },
                    occasions: { $sum: 1 },
                    totalWriteOffValue: { $sum: '$timeLogs.writeOffAmount' },
                    totalFees: { $sum: '$timeLogs.originalAmount' }
                }
            };
            break;

        case 'jobtype':
            // Lookup job category details
            lookupStages = [
                {
                    $lookup: {
                        from: 'jobcategories',
                        localField: 'timeLogs.jobCategoryId',
                        foreignField: '_id',
                        as: 'categoryDetails'
                    }
                },
                { $unwind: { path: '$categoryDetails', preserveNullAndEmptyArrays: true } }
            ];

            // Search filter
            if (search) {
                searchMatch = {
                    $match: {
                        'categoryDetails.name': { $regex: search, $options: 'i' }
                    }
                };
            }

            // Group by job category
            groupStage = {
                $group: {
                    _id: '$timeLogs.jobCategoryId',
                    categoryName: { $first: '$categoryDetails.name' },
                    occasions: { $sum: 1 },
                    totalWriteOffValue: { $sum: '$timeLogs.writeOffAmount' },
                    totalFees: { $sum: '$timeLogs.originalAmount' },
                    uniqueJobs: { $addToSet: '$timeLogs.jobId' }
                }
            };
            break;

        case 'team':
            // Lookup user details
            lookupStages = [
                {
                    $lookup: {
                        from: 'users',
                        localField: 'timeLogs.userId',
                        foreignField: '_id',
                        as: 'userDetails'
                    }
                },
                { $unwind: { path: '$userDetails', preserveNullAndEmptyArrays: true } }
            ];

            // Search filter
            if (search) {
                searchMatch = {
                    $match: {
                        $or: [
                            { 'userDetails.name': { $regex: search, $options: 'i' } },
                            { 'userDetails.email': { $regex: search, $options: 'i' } }
                        ]
                    }
                };
            }

            // Group by user
            groupStage = {
                $group: {
                    _id: '$timeLogs.userId',
                    userName: { $first: '$userDetails.name' },
                    userEmail: { $first: '$userDetails.email' },
                    occasions: { $sum: 1 },
                    totalWriteOffValue: { $sum: '$timeLogs.writeOffAmount' },
                    totalFees: { $sum: '$timeLogs.originalAmount' },
                    uniqueClients: { $addToSet: '$timeLogs.clientId' },
                    uniqueJobs: { $addToSet: '$timeLogs.jobId' }
                }
            };
            break;
    }

    // Build complete pipeline
    const completePipeline = [
        ...commonPipeline,
        ...lookupStages,
        ...(search ? [searchMatch] : []),
        groupStage,

        // Add calculated fields
        {
            $addFields: {
                ...(type === 'client' && { jobsWithWriteOffCount: { $size: '$jobsWithWriteOff' } }),
                ...(type === 'jobtype' && { jobsCount: { $size: '$uniqueJobs' } }),
                ...(type === 'team' && {
                    clientsCount: { $size: '$uniqueClients' },
                    jobsCount: { $size: '$uniqueJobs' }
                }),
                writeOffPercentage: {
                    $cond: [
                        { $gt: ['$totalFees', 0] },
                        {
                            $round: [
                                {
                                    $multiply: [
                                        { $divide: ['$totalWriteOffValue', '$totalFees'] },
                                        100
                                    ]
                                },
                                1
                            ]
                        },
                        0
                    ]
                }
            }
        },

        // Sort by total write-off value descending
        { $sort: { totalWriteOffValue: -1 } },

        // Use $facet for pagination and statistics
        {
            $facet: {
                // Paginated data
                data: [
                    { $skip: skip },
                    { $limit: limit }
                ],

                // Total count
                totalCount: [
                    { $count: 'count' }
                ],

                // Dashboard statistics
                dashboardStats: [
                    {
                        $group: {
                            _id: null,
                            totalWriteOffs: { $sum: '$totalWriteOffValue' },
                            totalOccasions: { $sum: '$occasions' },
                            totalJobs: type === 'client'
                                ? { $sum: '$jobsWithWriteOffCount' }
                                : type === 'jobtype' || type === 'team'
                                    ? { $sum: '$jobsCount' }
                                    : { $sum: 1 },
                            totalFees: { $sum: '$totalFees' }
                        }
                    },
                    {
                        $project: {
                            _id: 0,
                            totalWriteOffs: { $round: ['$totalWriteOffs', 2] },
                            totalOccasions: 1,
                            totalJobs: 1,
                            totalFees: { $round: ['$totalFees', 2] },
                            avgWriteOffPercentage: {
                                $cond: [
                                    { $gt: ['$totalFees', 0] },
                                    {
                                        $round: [
                                            {
                                                $multiply: [
                                                    { $divide: ['$totalWriteOffs', '$totalFees'] },
                                                    100
                                                ]
                                            },
                                            1
                                        ]
                                    },
                                    0
                                ]
                            }
                        }
                    }
                ]
            }
        }
    ];

    return completePipeline;
}


const getWriteOffsDashboard = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const {
            type = 'client', // client, job, jobtype, team
            page = 1,
            limit = 10,
            search = '',
            startDate,
            endDate
        } = req.query;

        const companyId = req.user.companyId;

        // Validate parameters
        const validTypes = ['client', 'job', 'jobtype', 'team'];
        if (!validTypes.includes(type as string)) {
            return ERROR(res, 400, `Invalid type parameter. Must be one of: ${validTypes.join(', ')}`);
        }

        const pageNumber = parseInt(page as string);
        const limitNumber = parseInt(limit as string);
        const skip = (pageNumber - 1) * limitNumber;

        const query: any = { companyId };

        // Date filter
        if (startDate && endDate) {
            query.createdAt = {
                $gte: new Date(startDate as string),
                $lte: new Date(endDate as string)
            };
        }

        // Common lookup stages
        const commonLookups = [
            // Lookup for client details
            {
                $lookup: {
                    from: 'clients',
                    localField: 'timeLogs.clientId',
                    foreignField: '_id',
                    as: 'clientDetails',
                    pipeline: [{ $project: { _id: 1, name: 1, clientRef: 1 } }]
                }
            },
            { $unwind: { path: '$clientDetails', preserveNullAndEmptyArrays: true } },

            // Lookup for job details
            {
                $lookup: {
                    from: 'jobs',
                    localField: 'timeLogs.jobId',
                    foreignField: '_id',
                    as: 'jobDetails',
                    pipeline: [{ $project: { _id: 1, name: 1, } }]
                }
            },
            { $unwind: { path: '$jobDetails', preserveNullAndEmptyArrays: true } },

            // Lookup for team member (userId)
            {
                $lookup: {
                    from: 'users',
                    localField: 'timeLogs.userId',
                    foreignField: '_id',
                    as: 'teamMemberDetails',
                    pipeline: [{ $project: { _id: 1, name: 1, avatarUrl: 1 } }]
                }
            },
            { $unwind: { path: '$teamMemberDetails', preserveNullAndEmptyArrays: true } },

            // Lookup for job category details
            {
                $lookup: {
                    from: 'jobcategories',
                    localField: 'timeLogs.jobCategoryId',
                    foreignField: '_id',
                    as: 'categoryDetails',
                    pipeline: [{ $project: { _id: 1, name: 1 } }]
                }
            },
            { $unwind: { path: '$categoryDetails', preserveNullAndEmptyArrays: true } },

            // Lookup for performedBy
            {
                $lookup: {
                    from: 'users',
                    localField: 'performedBy',
                    foreignField: '_id',
                    as: 'performedByDetails',
                    pipeline: [{ $project: { _id: 1, name: 1, avatarUrl: 1 } }]
                }
            },
            { $unwind: { path: '$performedByDetails', preserveNullAndEmptyArrays: true } }
        ];

        // Build dynamic grouping based on type
        let groupStage: any = {};
        let addFieldsStage: any = {};
        let searchMatchStage: any = {};

        switch (type) {
            case 'client':
                // Search filter for client
                if (search) {
                    searchMatchStage = {
                        $match: {
                            'clientDetails.name': { $regex: search, $options: 'i' }
                        }
                    };
                }

                // Group by client
                groupStage = {
                    $group: {
                        _id: '$clientDetails._id',
                        clientRef: { $first: '$clientDetails.clientRef' },
                        name: { $first: '$clientDetails.name' },
                        totalWriteOffValue: { $sum: '$timeLogs.writeOffAmount' },
                        totalFees: { $sum: '$timeLogs.originalAmount' },
                        jobsWithWriteOff: { $addToSet: '$timeLogs.jobId' },
                        uniqueJobs: { $addToSet: '$jobDetails' },
                        uniqueClients: { $addToSet: '$clientDetails' },
                        // Store write-off details for occasions drill-down
                        occasionDetails: {
                            $addToSet: {
                                writeOffId: '$_id',
                                amount: '$timeLogs.writeOffAmount',
                                date: '$createdAt',
                                reason: '$reason',
                                logic: '$logic',
                                by: '$performedByDetails.name',
                                clientDetails: '$clientDetails',
                                jobDetails: '$jobDetails'
                            }
                        }
                    }
                };

                addFieldsStage = {
                    $addFields: {
                        jobsWithWriteOffCount: { $size: '$jobsWithWriteOff' },
                        writeOffPercentage: {
                            $cond: [
                                { $gt: ['$totalFees', 0] },
                                { $round: [{ $multiply: [{ $divide: ['$totalWriteOffValue', '$totalFees'] }, 100] }, 1] },
                                0
                            ]
                        }
                    }
                };
                break;

            case 'job':
                // Search filter for job
                if (search) {
                    searchMatchStage = {
                        $match: {
                            $or: [
                                { 'jobDetails.name': { $regex: search, $options: 'i' } },
                            ]
                        }
                    };
                }

                // Group by job
                groupStage = {
                    $group: {
                        _id: '$jobDetails._id',
                        name: { $first: '$jobDetails.name' },
                        clientDetails: { $first: '$clientDetails' },
                        totalWriteOffValue: { $sum: '$timeLogs.writeOffAmount' },
                        totalFees: { $sum: '$timeLogs.originalAmount' },
                        uniqueJobs: { $addToSet: '$jobDetails' },
                        uniqueClients: { $addToSet: '$clientDetails' },
                        occasionDetails: {
                            $addToSet: {
                                writeOffId: '$_id',
                                amount: '$timeLogs.writeOffAmount',
                                date: '$createdAt',
                                reason: '$reason',
                                logic: '$logic',
                                by: '$performedByDetails.name',
                                clientDetails: '$clientDetails',
                                jobDetails: '$jobDetails'
                            }
                        }
                    }
                };

                addFieldsStage = {
                    $addFields: {
                        writeOffPercentage: {
                            $cond: [
                                { $gt: ['$totalFees', 0] },
                                { $round: [{ $multiply: [{ $divide: ['$totalWriteOffValue', '$totalFees'] }, 100] }, 1] },
                                0
                            ]
                        }
                    }
                };
                break;

            case 'jobtype':
                // Search filter for job type
                if (search) {
                    searchMatchStage = {
                        $match: {
                            'categoryDetails.name': { $regex: search, $options: 'i' }
                        }
                    };
                }

                // Group by job category
                groupStage = {
                    $group: {
                        _id: '$categoryDetails._id',
                        categoryName: { $first: '$categoryDetails.name' },
                        totalWriteOffValue: { $sum: '$timeLogs.writeOffAmount' },
                        totalFees: { $sum: '$timeLogs.originalAmount' },
                        uniqueJobs: { $addToSet: '$jobDetails' },
                        uniqueClients: { $addToSet: '$clientDetails' },
                        occasionDetails: {
                            $addToSet: {
                                writeOffId: '$_id',
                                amount: '$timeLogs.writeOffAmount',
                                date: '$createdAt',
                                reason: '$reason',
                                logic: '$logic',
                                by: '$performedByDetails.name',
                                clientDetails: '$clientDetails',
                                jobDetails: '$jobDetails'
                            }
                        }
                    }
                };

                addFieldsStage = {
                    $addFields: {
                        jobsCount: { $size: '$uniqueJobs' },
                        writeOffPercentage: {
                            $cond: [
                                { $gt: ['$totalFees', 0] },
                                { $round: [{ $multiply: [{ $divide: ['$totalWriteOffValue', '$totalFees'] }, 100] }, 1] },
                                0
                            ]
                        }
                    }
                };
                break;

            case 'team':
                // Search filter for team
                if (search) {
                    searchMatchStage = {
                        $match: {
                            $or: [
                                { 'teamMemberDetails.name': { $regex: search, $options: 'i' } },
                                { 'teamMemberDetails.email': { $regex: search, $options: 'i' } }
                            ]
                        }
                    };
                }

                // Group by team member
                groupStage = {
                    $group: {
                        _id: '$teamMemberDetails._id',
                        name: { $first: '$teamMemberDetails.name' },
                        totalWriteOffValue: { $sum: '$timeLogs.writeOffAmount' },
                        totalFees: { $sum: '$timeLogs.originalAmount' },
                        uniqueClients: { $addToSet: '$clientDetails' },
                        uniqueJobs: { $addToSet: '$jobDetails' },
                        occasionDetails: {
                            $addToSet: {
                                writeOffId: '$_id',
                                amount: '$timeLogs.writeOffAmount',
                                date: '$createdAt',
                                reason: '$reason',
                                logic: '$logic',
                                by: '$performedByDetails.name',
                                clientDetails: '$clientDetails',
                                jobDetails: '$jobDetails'
                            }
                        }
                    }
                };

                addFieldsStage = {
                    $addFields: {
                        clientsCount: { $size: '$uniqueClients' },
                        jobsCount: { $size: '$uniqueJobs' },
                        writeOffPercentage: {
                            $cond: [
                                { $gt: ['$totalFees', 0] },
                                { $round: [{ $multiply: [{ $divide: ['$totalWriteOffValue', '$totalFees'] }, 100] }, 1] },
                                0
                            ]
                        }
                    }
                };
                break;
        }

        // Build complete aggregation pipeline
        const results = await WriteOffModel.aggregate([
            { $match: query },
            { $unwind: '$timeLogs' },
            ...commonLookups,
            ...(search ? [searchMatchStage] : []),
            groupStage,
            addFieldsStage,

            // Sort by total write-off value descending
            { $sort: { totalWriteOffValue: -1 } },

            // Use $facet for pagination and statistics
            {
                $facet: {
                    // Paginated data
                    data: [
                        { $skip: skip },
                        { $limit: limitNumber }
                    ],

                    // Total count
                    totalCount: [
                        { $count: 'count' }
                    ],

                    // Dashboard statistics
                    dashboardStats: [
                        {
                            $group: {
                                _id: null,
                                totalWriteOffs: { $sum: '$totalWriteOffValue' },
                                totalOccasions: { $sum: '$occasions' },
                                totalJobs: type === 'client'
                                    ? { $sum: '$jobsWithWriteOffCount' }
                                    : type === 'jobtype' || type === 'team'
                                        ? { $sum: '$jobsCount' }
                                        : { $sum: 1 },
                                totalFees: { $sum: '$totalFees' }
                            }
                        },
                        {
                            $project: {
                                _id: 0,
                                totalWriteOffs: { $round: ['$totalWriteOffs', 2] },
                                totalOccasions: 1,
                                totalJobs: 1,
                                totalFees: { $round: ['$totalFees', 2] },
                                avgWriteOffPercentage: {
                                    $cond: [
                                        { $gt: ['$totalFees', 0] },
                                        { $round: [{ $multiply: [{ $divide: ['$totalWriteOffs', '$totalFees'] }, 100] }, 1] },
                                        0
                                    ]
                                }
                            }
                        }
                    ]
                }
            }
        ]);

        // Extract results
        const data = results[0]?.data || [];
        const totalCount = results[0]?.totalCount[0]?.count || 0;
        const dashboardStats = results[0]?.dashboardStats[0] || {
            totalWriteOffs: 0,
            totalOccasions: 0,
            totalJobs: 0,
            totalFees: 0,
            avgWriteOffPercentage: 0
        };

        const pagination = {
            currentPage: pageNumber,
            totalPages: Math.ceil(totalCount / limitNumber),
            total: totalCount,
            limit: limitNumber,
        };

        SUCCESS(res, 200, `Write-offs by ${type} fetched successfully`, {
            type,
            summary: {
                totalWriteOffs: dashboardStats.totalWriteOffs,
                totalOccasions: dashboardStats.totalOccasions,
                jobsWithWriteOffs: dashboardStats.totalJobs,
                avgWriteOffPercentage: dashboardStats.avgWriteOffPercentage
            },
            totals: {
                occasions: dashboardStats.totalOccasions,
                writeOffValue: dashboardStats.totalWriteOffs,
                jobs: dashboardStats.totalJobs,
                totalFees: dashboardStats.totalFees,
                avgWriteOffPercentage: dashboardStats.avgWriteOffPercentage
            },
            data,
            pagination
        });
    } catch (error) {
        console.log("error in getWriteOffsDashboard", error);
        next(error);
    }
};




export default {
    createWriteOff,
    getWriteOff,
    getWriteOffsDashboard
};