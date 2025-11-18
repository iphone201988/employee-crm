import { JobModel } from '../models/Job';
import { ClientModel } from '../models/Client';
import { TimeEntryModel } from '../models/TimeEntry';
import { ExpensesModel } from '../models/Expenses';
import { ObjectId } from '../utils/utills';




import mongoose from 'mongoose';
import { SUCCESS } from '../utils/response';
import { NextFunction, Request, Response } from 'express';
import { WipOpenBalanceModel } from '../models/wipOpenBalance';
import { TimeLogModel } from '../models/TImeLog';
import { WipTragetAmountsModel } from '../models/WIPTargetAmounts';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { SettingModel } from '../models/Setting';


// Main function to get WIP data
export async function getWIPDashboardData(companyId: string) {
    const wipData = await ClientModel.aggregate([

        // ========================================
        // STEP 1: Find all clients for the company
        // ========================================
        {
            $match: {
                companyId: new mongoose.Types.ObjectId(companyId),
                status: 'active'
            }
        },

        // ========================================
        // STEP 2: Lookup Jobs for each client
        // ========================================
        {
            $lookup: {
                from: 'jobs', // Collection name (lowercase, pluralized)
                let: { clientId: '$_id', companyId: '$companyId' },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ['$clientId', '$$clientId'] },
                                    { $eq: ['$companyId', '$$companyId'] },
                                    // Only active jobs (WIP)
                                    {
                                        $in: ['$status', ['queued', 'inProgress', 'withClient', 'forApproval']]
                                    }
                                ]
                            }
                        }
                    },
                    {
                        $project: {
                            _id: 1,
                            name: 1,
                            jobCost: 1,
                            status: 1,
                            startDate: 1,
                            endDate: 1,
                            priority: 1
                        }
                    }
                ],
                as: 'jobs'
            }
        },

        // ========================================
        // STEP 3: Lookup TimeEntries for each client
        // Find how much accounting work has been done
        // ========================================
        {
            $lookup: {
                from: 'timeentries', // Collection name
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
                    // Unwind the logs array to calculate total duration
                    {
                        $unwind: {
                            path: '$logs',
                            preserveNullAndEmptyArrays: true
                        }
                    },
                    // Group back to calculate totals
                    {
                        $group: {
                            _id: {
                                entryId: '$_id',
                                clientId: '$clientId',
                                jobId: '$jobId',
                                isbillable: '$isbillable'
                            },
                            totalDuration: { $sum: '$logs.duration' }, // Sum all log durations
                            totalHours: { $first: '$totalHours' },
                            totalAmount: { $first: '$totalAmount' },
                            rate: { $first: '$rate' },
                            isbillable: { $first: '$isbillable' },
                            lastLogDate: { $max: '$logs.date' }
                        }
                    },
                    // Group by client to get client-level totals
                    {
                        $group: {
                            _id: '$_id.clientId',
                            totalWorkDone: { $sum: '$totalDuration' }, // Total minutes worked
                            totalHours: { $sum: '$totalHours' },
                            billableAmount: {
                                $sum: {
                                    $cond: [
                                        { $eq: ['$_id.isbillable', true] },
                                        '$totalAmount',
                                        0
                                    ]
                                }
                            },
                            nonBillableAmount: {
                                $sum: {
                                    $cond: [
                                        { $eq: ['$_id.isbillable', false] },
                                        '$totalAmount',
                                        0
                                    ]
                                }
                            },
                            billableHours: {
                                $sum: {
                                    $cond: [
                                        { $eq: ['$_id.isbillable', true] },
                                        '$totalHours',
                                        0
                                    ]
                                }
                            },
                            nonBillableHours: {
                                $sum: {
                                    $cond: [
                                        { $eq: ['$_id.isbillable', false] },
                                        '$totalHours',
                                        0
                                    ]
                                }
                            },
                            lastInvoicedDate: { $max: '$lastLogDate' },
                            entryCount: { $sum: 1 }
                        }
                    }
                ],
                as: 'timeEntriesData'
            }
        },

        // ========================================
        // STEP 4: Lookup Expenses for each client
        // ========================================
        {
            $lookup: {
                from: 'expenses', // Collection name
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
                    // Group expenses by client
                    {
                        $group: {
                            _id: '$clientId',
                            totalExpenses: { $sum: '$totalAmount' },
                            totalNetAmount: { $sum: '$netAmount' },
                            totalVatAmount: { $sum: '$vatAmount' },
                            expenseCount: { $sum: 1 },
                            expenseDetails: {
                                $push: {
                                    date: '$date',
                                    category: '$expreseCategory',
                                    amount: '$totalAmount',
                                    description: '$description'
                                }
                            }
                        }
                    }
                ],
                as: 'expensesData'
            }
        },

        // ========================================
        // STEP 5: Unwind the lookup results
        // ========================================
        {
            $addFields: {
                timeEntriesData: { $arrayElemAt: ['$timeEntriesData', 0] },
                expensesData: { $arrayElemAt: ['$expensesData', 0] }
            }
        },

        // ========================================
        // STEP 6: Calculate WIP Balance and Metrics
        // ========================================
        {
            $addFields: {
                // Count of active jobs
                jobCount: { $size: '$jobs' },

                // Total WIP Balance (sum of all job costs)
                wipBalance: {
                    $reduce: {
                        input: '$jobs',
                        initialValue: 0,
                        in: { $add: ['$$value', '$$this.jobCost'] }
                    }
                },

                // Total work done (in hours)
                totalWorkDone: {
                    $ifNull: ['$timeEntriesData.totalHours', 0]
                },

                // Total billable amount
                billableAmount: {
                    $ifNull: ['$timeEntriesData.billableAmount', 0]
                },

                // Total expenses
                totalExpenses: {
                    $ifNull: ['$expensesData.totalExpenses', 0]
                },

                // Last invoiced date
                lastInvoicedDate: {
                    $ifNull: ['$timeEntriesData.lastInvoicedDate', null]
                }
            }
        },

        // ========================================
        // STEP 7: Calculate Percentages and Status
        // ========================================
        {
            $addFields: {
                // Calculate expense percentage of WIP
                expensePercentage: {
                    $cond: [
                        { $gt: ['$wipBalance', 0] },
                        {
                            $round: [
                                {
                                    $multiply: [
                                        { $divide: ['$totalExpenses', '$wipBalance'] },
                                        100
                                    ]
                                },
                                2
                            ]
                        },
                        0
                    ]
                },

                // Calculate days since last invoice
                daysSinceLastInvoice: {
                    $cond: [
                        { $ne: ['$lastInvoicedDate', null] },
                        {
                            $dateDiff: {
                                startDate: '$lastInvoicedDate',
                                endDate: new Date(),
                                unit: 'day'
                            }
                        },
                        null
                    ]
                },

                // Determine invoice level
                invoiceLevel: {
                    $cond: [
                        { $gt: ['$jobCount', 1] },
                        'Client',
                        'Job'
                    ]
                },

                // WIP Target (example: 80% of WIP balance)
                wipTarget: {
                    $cond: [
                        { $gt: ['$wipBalance', 0] },
                        { $multiply: ['$wipBalance', 0.8] },
                        null
                    ]
                },

                // Invoice Status
                invoiceStatus: {
                    $cond: [
                        { $gte: ['$wipBalance', 1000] },
                        'Invoice Now',
                        {
                            $cond: [
                                {
                                    $and: [
                                        { $gt: ['$wipBalance', 0] },
                                        { $lt: ['$wipBalance', 1000] }
                                    ]
                                },
                                'Not Ready',
                                '-'
                            ]
                        }
                    ]
                },

                // WIP Ready to Invoice
                wipReadyToInvoice: {
                    $cond: [
                        { $gte: ['$wipBalance', 1000] },
                        '$wipBalance',
                        0
                    ]
                }
            }
        },

        // ========================================
        // STEP 8: Project Final Output Structure
        // ========================================
        {
            $project: {
                _id: 0,
                clientId: '$_id',
                clientRef: 1,
                clientName: '$name',
                email: 1,
                phone: 1,

                // Jobs Information
                jobs: {
                    count: '$jobCount',
                    details: '$jobs'
                },

                // WIP Balance
                wipBalance: {
                    $round: ['$wipBalance', 2]
                },

                // Time Entries Summary (Accounting Work Done)
                timeTracked: {
                    totalHours: { $round: ['$totalWorkDone', 2] },
                    billableHours: {
                        $round: [{ $ifNull: ['$timeEntriesData.billableHours', 0] }, 2]
                    },
                    nonBillableHours: {
                        $round: [{ $ifNull: ['$timeEntriesData.nonBillableHours', 0] }, 2]
                    },
                    billableAmount: { $round: ['$billableAmount', 2] },
                    nonBillableAmount: {
                        $round: [{ $ifNull: ['$timeEntriesData.nonBillableAmount', 0] }, 2]
                    }
                },

                // Expenses Summary
                expenses: {
                    total: { $round: ['$totalExpenses', 2] },
                    percentage: '$expensePercentage',
                    count: { $ifNull: ['$expensesData.expenseCount', 0] },
                    details: { $ifNull: ['$expensesData.expenseDetails', []] },
                    display: {
                        $concat: [
                            '€',
                            { $toString: { $round: ['$totalExpenses', 2] } }
                        ]
                    }
                },

                // Last Invoiced
                lastInvoiced: {
                    date: '$lastInvoicedDate',
                    daysAgo: '$daysSinceLastInvoice',
                    display: {
                        $cond: [
                            { $ne: ['$lastInvoicedDate', null] },
                            {
                                $concat: [
                                    { $dateToString: { format: '%d/%m/%Y', date: '$lastInvoicedDate' } },
                                    ' (',
                                    { $toString: '$daysSinceLastInvoice' },
                                    ' days ago)'
                                ]
                            },
                            'N/A'
                        ]
                    }
                },

                // Invoice Details
                invoiceLevel: {
                    type: '$invoiceLevel',
                    badge: '$invoiceLevel'
                },

                // WIP Target
                wipTarget: {
                    amount: { $round: ['$wipTarget', 2] },
                    display: {
                        $cond: [
                            { $ne: ['$wipTarget', null] },
                            {
                                $concat: [
                                    'WIP of €',
                                    { $toString: { $round: ['$wipTarget', 2] } }
                                ]
                            },
                            '-'
                        ]
                    }
                },

                // Status Fields
                targetMet: {
                    $cond: [
                        { $ne: ['$wipTarget', null] },
                        {
                            $cond: [
                                { $gte: ['$billableAmount', '$wipTarget'] },
                                'yes',
                                'no'
                            ]
                        },
                        '-'
                    ]
                },
                invoiceStatus: 1,
                wipReadyToInvoice: { $round: ['$wipReadyToInvoice', 2] }
            }
        },

        // ========================================
        // STEP 9: Sort by Client Name
        // ========================================
        {
            $sort: { clientName: 1 }
        }
    ]);
    console.log(wipData);
    return wipData;
}


function calculateWIPSummary(wipData: any[]) {
    const totalClients = wipData.length;

    const totalJobs = wipData.reduce((sum, client) => sum + client.jobCount, 0);

    const totalCapacity = wipData.reduce((sum, client) => {
        return sum + (client.wipBalance || 0);
    }, 0);

    const totalLogged = wipData.reduce((sum, client) => {
        return sum + (client.wipBalance || 0);
    }, 0);

    const totalRevenue = wipData.reduce((sum, client) => {
        return sum + (client.wipReadyToInvoice || 0);
    }, 0);

    return {
        totalClients,
        totalJobs,
        currentWIP: totalCapacity.toFixed(2),
        wipReadyToInvoice: totalRevenue.toFixed(2),
        totalLogged: totalLogged.toFixed(2)
    };
}
const createOpenWipBalance = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const companyId = req.user.companyId;
    try {
        const { clientId, amount, jobId, type } = req.body;
        const openBalance = await WipOpenBalanceModel.create({ clientId, amount, jobId, type, companyId });
        SUCCESS(res, 200, "Open balance created successfully", { data: openBalance });

    } catch (error) {
        console.log("error in createOpenWipBalance", error);
        next(error);
    }
}
const workInProgress = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const companyId = req.user.companyId;

        // Pagination params
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;
        const setting = await SettingModel.findOne({ companyId: req.user.companyId });
        const WIPWarningJobs = req.query.WIPWarningJobs as string === "true"
        const wipTargetPercent = setting?.wipWarningPercentage || 80;
        const targetMetCondition = req.query.targetMetCondition as string || undefined; // 1,2 
        // 🧠 Base client match condition
        const baseMatch: any = {
            companyId: new mongoose.Types.ObjectId(companyId),
            status: 'active'
        };
        if (req.query.serach) {
            const searchRegex = new RegExp(`^${req.query.serach}`, 'i');
            baseMatch.name = { $regex: searchRegex };
        }
        // Main pipeline
        const pipeline: any[] = [
            { $match: baseMatch },
            {
                $lookup: {
                    from: 'users',
                    localField: 'companyId',
                    foreignField: '_id',
                    as: 'company',
                    pipeline: [
                        {
                            $project: {
                                _id: 1,
                                name: 1,
                                email: 1,
                            }
                        }
                    ]
                }
            }, {
                $unwind: {
                    path: '$company',
                    preserveNullAndEmptyArrays: true,
                },
            },

            // --- your same full lookup logic ---
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
                                        { $eq: ['$companyId', '$$companyId'] },
                                        {
                                            $in: ['$status', ['queued', 'inProgress', 'withClient', 'forApproval']]
                                        },
                                    ]
                                }
                            }
                        },
                        {
                            $lookup: {
                                from: 'timelogs',
                                let: { jobId: '$_id', companyId: '$companyId' },
                                pipeline: [
                                    {
                                        $match: {
                                            $expr: {
                                                $and: [
                                                    { $eq: ['$jobId', '$$jobId'] },
                                                    { $eq: ['$companyId', '$$companyId'] },
                                                    { $eq: ['$billable', true] },
                                                    { $eq: ['$status', 'notInvoiced'] }
                                                ]
                                            }
                                        }
                                    },
                                    {
                                        $group: {
                                            _id: '$jobId',
                                            wipAmount: { $sum: '$amount' },
                                            wipDuration: { $sum: '$duration' }
                                        }
                                    }
                                ],
                                as: 'wipData'
                            }
                        },

                        {
                            $addFields: {
                                wipAmount: { $ifNull: [{ $arrayElemAt: ['$wipData.wipAmount', 0] }, 0] },
                                wipDuration: { $ifNull: [{ $arrayElemAt: ['$wipData.wipDuration', 0] }, 0] }
                            }
                        },

                        {
                            $lookup: {
                                from: 'wipopenbalances',
                                localField: '_id',
                                foreignField: 'jobId',
                                as: 'wipopenbalances',
                                pipeline: [
                                    {
                                        $match: { status: "notInvoiced" }
                                    }
                                ]
                            }
                        },
                        {
                            $addFields: {
                                wipTotalOpenBalance: { $sum: '$wipopenbalances.amount' }
                            }
                        },
                        {
                            $lookup: {
                                from: 'wiptragetamounts',
                                localField: 'wipTargetId',
                                foreignField: '_id',
                                as: 'jobWipTraget'
                            }
                        },
                        {
                            $unwind: {
                                path: '$jobWipTraget',
                                preserveNullAndEmptyArrays: true
                            }
                        },
                        {
                            $addFields: {
                                jobFeePercentage: {
                                    $cond: [
                                        { $gt: ["$jobCost", 0] },
                                        { $multiply: [{ $divide: ["$wipAmount", "$jobCost"] }, 100] },
                                        0
                                    ]
                                },
                                targetAmount: { $ifNull: ["$jobWipTraget.amount", 0] },
                                targetMet: {
                                    $cond: [
                                        { $gt: ["$wipAmount", "$jobWipTraget.amount"] },
                                        "2",
                                        "1"
                                    ]
                                },
                            }
                        },
                        // ...(targetMetCondition
                        //     ? [
                        //         {
                        //             $match: {
                        //                 targetMet: targetMetCondition
                        //             }
                        //         }
                        //     ]
                        //     : []),
                        // user breakdown per job
                        {
                            $lookup: {
                                from: 'timelogs',
                                localField: '_id',
                                foreignField: 'jobId',
                                as: 'wipBreakdown',
                                pipeline: [

                                    {
                                        $match: {
                                            status: 'notInvoiced',
                                        }
                                    },
                                    {
                                        $lookup: {
                                            from: 'users',
                                            localField: 'userId',
                                            foreignField: '_id',
                                            as: 'user'
                                        }
                                    },
                                    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
                                    {
                                        $lookup: {
                                            from: 'jobs',
                                            localField: 'jobId',
                                            foreignField: '_id',
                                            as: 'job'
                                        }
                                    },
                                    { $unwind: { path: '$job', preserveNullAndEmptyArrays: true } },
                                    {
                                        $group: {
                                            _id: '$userId',
                                            userName: { $first: '$user.name' },
                                            billableRate: { $first: '$rate' },
                                            totalHours: { $sum: '$duration' },
                                            totalAmount: { $sum: '$amount' },
                                            tasks: {
                                                $push: {
                                                    timeLogId: '$_id',
                                                    description: '$description',
                                                    date: '$date',
                                                    jobTypeId: '$job.jobTypeId',
                                                    jobName: '$job.name',
                                                    duration: '$duration',
                                                    rate: '$rate',
                                                    amount: '$amount'
                                                }
                                            }
                                        }
                                    },
                                    { $sort: { userName: 1 } }
                                ]
                            }
                        },

                        {
                            $project: {
                                _id: 1,
                                name: 1,
                                jobCost: 1,
                                status: 1,
                                startDate: 1,
                                endDate: 1,
                                priority: 1,
                                wipAmount: 1,
                                wipDuration: 1,
                                wipopenbalances: 1,
                                wipTotalOpenBalance: 1,
                                jobWipTraget: 1,
                                wipBreakdown: 1,
                                jobFeePercentage: 1,
                                targetMet: 1,
                                targetAmount: 1
                            }
                        }
                    ],
                    as: 'jobs'
                }
            },

            // total client WIP amount = sum of job wipAmount
            {
                $addFields: {
                    clientTotalWipAmount: { $sum: '$jobs.wipAmount' },
                    clientTotalWipJobs: { $size: '$jobs' }
                }
            },
            {
                $lookup:
                {
                    from: 'expenses',
                    let: {
                        clientId: '$_id',
                        companyId: '$companyId'
                    },
                    pipeline: [
                        {
                            $match:
                            {
                                $expr:
                                {
                                    $and: [
                                        { $eq: ['$clientId', '$$clientId'] },
                                        { $eq: ['$companyId', '$$companyId'] },
                                        { $eq: ['$status', 'no'] },
                                    ]
                                }
                            }
                        },], as: 'expensesData'
                }
            }, {
                $addFields:
                    { totalExpenses: { $sum: '$expensesData.totalAmount' } }
            },
            {
                $lookup:
                {
                    from: 'wipopenbalances', localField: '_id', foreignField: 'clientId',
                    as: 'clientWipOpenBalance', pipeline: [
                        {
                            $match:
                            {
                                status: 'notInvoiced'
                            }
                        }
                    ]
                }
            }, {
                $addFields:
                    { clientWipTotalOpenBalance: { $sum: '$clientWipOpenBalance.amount' } }
            }, {
                $lookup:
                {
                    from: 'wiptragetamounts', localField: 'wipTargetId', foreignField: '_id',
                    as: 'clientWipTraget'
                }
            }, {
                $unwind: {
                    path: '$clientWipTraget',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $addFields: {
                    clientTargetAmount: { $ifNull: ['$clientWipTraget.amount', 0] },
                    clientTargetMet: {
                        $cond: {
                            if: { $gt: ['$clientTotalWipAmount', '$clientTargetAmount'] },
                            then: '2',
                            else: '1'
                        }
                    }
                }
            },
            {
                $lookup: {
                    from: "timelogs",
                    let: { clientId: '$_id', companyId: '$companyId' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [{ $eq: ['$clientId', '$$clientId'] },
                                    { $eq: ['$companyId', '$$companyId'] },
                                    { $eq: ['$status', 'notInvoiced'] }
                                    ]

                                }
                            }
                        },
                        {
                            $lookup: {
                                from: 'jobs', localField: 'jobId',
                                foreignField: '_id', as: 'job'
                            }
                        }, {
                            $unwind: {
                                path: '$job',
                                preserveNullAndEmptyArrays: true
                            }
                        },
                        {
                            $lookup: {
                                from: "users",
                                localField: "userId",
                                foreignField: "_id",
                                as: "user"
                            }
                        }, {
                            $unwind: {
                                path: '$user',
                                preserveNullAndEmptyArrays: true
                            }
                        }, {
                            $group:
                            {
                                _id: "$userId",
                                userName: { $first: "$user.name" },
                                billableRate: { $first: "$rate" },
                                totalHours: { $sum: "$duration" },
                                totalAmount: { $sum: "$amount" },
                                tasks: {
                                    $push: {
                                        timeLogId: "$_id",
                                        description: "$description",
                                        date: "$date",
                                        jobTypeId: "$job.jobTypeId",
                                        jobName: "$job.name",
                                        duration: "$duration",
                                        rate: "$rate",
                                        amount: "$amount"
                                    }
                                }
                            }
                        }, { $sort: { userName: 1 } }],
                    as: "wipBreakdown"
                }
            },
            ...(WIPWarningJobs ? [
                {
                    $match: {
                        "jobs.jobFeePercentage": { $gte: wipTargetPercent }
                    }
                }] : []),
            ...(targetMetCondition ? [
                {
                    $match: {
                        clientTargetMet: targetMetCondition
                    }
                }

            ] : []),

            {
                $facet: {
                    data: [

                        {
                            $sort: { name: 1 }
                        },


                        // Pagination
                        { $skip: skip },
                        { $limit: limit }
                    ],
                    totalCount: [{ $count: 'count' }]
                }
            },

        ];

        // Get paginated clients
        const result = await ClientModel.aggregate(pipeline).collation({ locale: "en", strength: 2 });
        const wipData = result[0].data;
        const totalCount = result[0].totalCount[0]?.count || 0;

        // Get total counts and summary for dashboard
        const summary = await ClientModel.aggregate([
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
                                        { $eq: ['$companyId', '$$companyId'] },
                                        {
                                            $in: ['$status', ['queued', 'inProgress', 'withClient', 'forApproval']]
                                        }
                                    ]
                                }
                            }
                        },
                        {
                            $lookup: {
                                from: 'timelogs',
                                let: { jobId: '$_id', companyId: '$companyId' },
                                pipeline: [
                                    {
                                        $match: {
                                            $expr: {
                                                $and: [
                                                    { $eq: ['$jobId', '$$jobId'] },
                                                    { $eq: ['$companyId', '$$companyId'] },
                                                    { $eq: ['$billable', true] },
                                                    { $eq: ['$status', 'notInvoiced'] }
                                                ]
                                            }
                                        }
                                    },
                                    { $group: { _id: null, wipAmount: { $sum: '$amount' } } }
                                ],
                                as: 'jobWip'
                            }
                        },
                        {
                            $addFields: {
                                wipAmount: {
                                    $ifNull: [{ $arrayElemAt: ['$jobWip.wipAmount', 0] }, 0]
                                }
                            }
                        }
                    ],
                    as: 'jobs'
                }
            },

            {
                $lookup: {
                    from: 'wiptragetamounts',
                    localField: 'wipTargetId',
                    foreignField: '_id',
                    as: 'clientWipTraget'
                }
            },
            { $unwind: { path: '$clientWipTraget', preserveNullAndEmptyArrays: true } },
            {
                $addFields: {
                    targetMet:
                    {
                        $cond: {
                            if: {
                                $gt:
                                    [{ $sum: '$jobs.wipAmount' }, '$clientWipTraget.amount']
                            },
                            then: '2',
                            else: '1'
                        }
                    },
                    clientWipAmount: { $sum: '$jobs.wipAmount' }
                }
            },
            {
                $group: {
                    _id: null,
                    totalClients: { $sum: 1 },
                    totalJobs: { $sum: { $size: '$jobs' } },
                    totalWipAmount: { $sum: { $sum: '$jobs.wipAmount' } },
                    // amount those who are target met 2
                    totalInvoicedAmount: {
                        $sum: {
                            $cond: [
                                { $eq: ['$targetMet', '2'] },
                                '$clientWipAmount',
                                0
                            ]
                        }
                    }
                }
            }
        ]);

        const summaryData = summary[0] || {
            totalClients: 0,
            totalJobs: 0,
            totalWipAmount: 0
        };

        SUCCESS(res, 200, "Work in progress data fetched successfully", {
            data: wipData,
            pagination: { page, limit, totalCount },
            summary: summaryData
        });
    } catch (error) {
        console.log("error in workInProgress", error);
        next(error);
    }
};

const wipBalance = async (req: Request, res: Response) => {
    try {
        const {
            startDate,
            endDate,
            clientId,
            page = '1', // default page number 1
            limit = '10', // default page size 10
            search = '',
        }: any = req.query;

        const companyId = req.user.companyId;
        const currentDate = new Date();

        const matchConditions: any = {
            companyId: companyId,
            billable: true,
        };

        if (clientId) {
            matchConditions.clientId = new mongoose.Types.ObjectId(clientId);
        }

        if (startDate) {
            matchConditions.date = { $gte: new Date(startDate) };
        }

        if (endDate) {
            matchConditions.date = {
                ...matchConditions.date,
                $lte: new Date(endDate),
            };
        }

        const pageNumber = parseInt(page, 10);
        const pageSize = parseInt(limit, 10);
        const skipCount = (pageNumber - 1) * pageSize;

        // Construct aggregation pipeline
        const pipeline: any[] = [
            { $match: matchConditions },
            {
                $addFields: {
                    daysOld: {
                        $divide: [{ $subtract: [currentDate, '$date'] }, 1000 * 60 * 60 * 24],
                    },
                },
            },
            {
                $lookup: {
                    from: 'clients',
                    localField: 'clientId',
                    foreignField: '_id',
                    as: 'clientInfo',
                },
            },
            { $unwind: '$clientInfo' },
            ...(search
                ? [
                    {
                        $match: {
                            "clientInfo.name": { $regex: new RegExp(search, 'i') },
                        },
                    },
                ]
                : []),
            {
                $group: {
                    _id: '$clientId',
                    clientRef: { $first: '$clientInfo.clientRef' },
                    clientName: { $first: '$clientInfo.name' },
                    wipBalance: { $sum: '$amount' },
                    days30: {
                        $sum: { $cond: [{ $lte: ['$daysOld', 30] }, '$amount', 0] },
                    },
                    days60: {
                        $sum: {
                            $cond: [
                                { $and: [{ $gt: ['$daysOld', 30] }, { $lte: ['$daysOld', 60] }] },
                                '$amount',
                                0,
                            ],
                        },
                    },
                    days90: {
                        $sum: {
                            $cond: [
                                { $and: [{ $gt: ['$daysOld', 60] }, { $lte: ['$daysOld', 90] }] },
                                '$amount',
                                0,
                            ],
                        },
                    },
                    days120: {
                        $sum: {
                            $cond: [
                                { $and: [{ $gt: ['$daysOld', 90] }, { $lte: ['$daysOld', 120] }] },
                                '$amount',
                                0,
                            ],
                        },
                    },
                    days150: {
                        $sum: {
                            $cond: [
                                { $and: [{ $gt: ['$daysOld', 120] }, { $lte: ['$daysOld', 150] }] },
                                '$amount',
                                0,
                            ],
                        },
                    },
                    days180: {
                        $sum: {
                            $cond: [
                                { $and: [{ $gt: ['$daysOld', 150] }, { $lte: ['$daysOld', 180] }] },
                                '$amount',
                                0,
                            ],
                        },
                    },
                    days180Plus: {
                        $sum: { $cond: [{ $gt: ['$daysOld', 180] }, '$amount', 0] },
                    },
                },
            },
            {
                $project: {
                    _id: 0,
                    clientId: '$_id',
                    clientRef: 1,
                    clientName: 1,
                    wipBalance: { $round: ['$wipBalance', 2] },
                    days30: { $round: ['$days30', 2] },
                    days60: { $round: ['$days60', 2] },
                    days90: { $round: ['$days90', 2] },
                    days120: { $round: ['$days120', 2] },
                    days150: { $round: ['$days150', 2] },
                    days180: { $round: ['$days180', 2] },
                    days180Plus: { $round: ['$days180Plus', 2] },
                },
            },
            { $sort: { clientRef: 1 } },
            {
                $facet: {
                    clients: [
                        { $skip: skipCount },
                        { $limit: pageSize },
                    ],
                    totals: [
                        {
                            $group: {
                                _id: null,
                                wipBalance: { $sum: '$wipBalance' },
                                days30: { $sum: '$days30' },
                                days60: { $sum: '$days60' },
                                days90: { $sum: '$days90' },
                                days120: { $sum: '$days120' },
                                days150: { $sum: '$days150' },
                                days180: { $sum: '$days180' },
                                days180Plus: { $sum: '$days180Plus' },
                                totalClients: { $sum: 1 },
                            },
                        },
                    ],
                },
            },
            {
                $project: {
                    clients: 1,
                    totals: {
                        $ifNull: [
                            { $arrayElemAt: ['$totals', 0] },
                            {
                                wipBalance: 0,
                                days30: 0,
                                days60: 0,
                                days90: 0,
                                days120: 0,
                                days150: 0,
                                days180: 0,
                                days180Plus: 0,
                                totalClients: 0,
                            },
                        ],
                    },
                },
            },
        ];

        const aggregationResult = await TimeLogModel.aggregate(pipeline);
        const aggregationPayload = aggregationResult[0] || { clients: [], totals: {} };
        const wipData = aggregationPayload.clients || [];
        const totals = aggregationPayload.totals || {
            wipBalance: 0,
            days30: 0,
            days60: 0,
            days90: 0,
            days120: 0,
            days150: 0,
            days180: 0,
            days180Plus: 0,
            totalClients: 0,
        };
        const normalizedTotals = {
            wipBalance: Number(totals.wipBalance || 0),
            days30: Number(totals.days30 || 0),
            days60: Number(totals.days60 || 0),
            days90: Number(totals.days90 || 0),
            days120: Number(totals.days120 || 0),
            days150: Number(totals.days150 || 0),
            days180: Number(totals.days180 || 0),
            days180Plus: Number(totals.days180Plus || 0),
            totalClients: Number(totals.totalClients || 0),
        };
        const totalClients = normalizedTotals.totalClients || 0;

        const summary = {
            totalWIPBalance: parseFloat(normalizedTotals.wipBalance.toFixed(2)),
            current0_30Days: parseFloat(normalizedTotals.days30.toFixed(2)),
            days31_60: parseFloat(normalizedTotals.days60.toFixed(2)),
            days60Plus: parseFloat(
                (
                    normalizedTotals.days90 +
                    normalizedTotals.days120 +
                    normalizedTotals.days150 +
                    normalizedTotals.days180 +
                    normalizedTotals.days180Plus
                ).toFixed(2)
            ),
        };

        const response = {
            summary,
            clients: wipData,
            totalRow: {
                wipBalance: parseFloat(normalizedTotals.wipBalance.toFixed(2)),
                days30: parseFloat(normalizedTotals.days30.toFixed(2)),
                days60: parseFloat(normalizedTotals.days60.toFixed(2)),
                days90: parseFloat(normalizedTotals.days90.toFixed(2)),
                days120: parseFloat(normalizedTotals.days120.toFixed(2)),
                days150: parseFloat(normalizedTotals.days150.toFixed(2)),
                days180Plus: parseFloat(
                    (normalizedTotals.days180 + normalizedTotals.days180Plus).toFixed(2)
                ),
            },
            pagination: {
                currentPage: pageNumber,
                pageSize: pageSize,
                totalClients,
                totalPages: Math.ceil(totalClients / pageSize),
            },
        };

        return res.status(200).json({
            success: true,
            data: response,
        });
    } catch (error: any) {
        console.error('Error fetching WIP balance:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch WIP balance',
            error: error.message,
        });
    }
};


const attachWipTarget = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { clientId, wipTargetId, jobId, type } = req.body;
        const wipTarget = await WipTragetAmountsModel.findById(wipTargetId);
        if (!wipTarget) {
            throw new NotFoundError("WIP target not found");
        }

        switch (type) {
            case "job": {
                if (!jobId) throw new BadRequestError("Job ID is required");

                const job = await JobModel.findById(jobId);
                if (!job) throw new NotFoundError("Job not found");

                job.wipTargetId = wipTargetId;
                await job.save();
                break;
            }

            case "client": {
                if (!clientId) throw new BadRequestError("Client ID is required");

                const client = await ClientModel.findById(clientId);
                if (!client) throw new NotFoundError("Client not found");

                client.wipTargetId = wipTargetId;
                await client.save();
                break;
            }

            default:
                throw new BadRequestError("Invalid type — must be 'job' or 'client'");
        }

        return SUCCESS(res, 200, "WIP target attached successfully", { wipTarget });
    } catch (error) {
        console.log("error in addWipTarget", error);
        next(error);
    }
};

export default { workInProgress, createOpenWipBalance, wipBalance, attachWipTarget };