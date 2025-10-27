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
                contactName: 1,
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
        const wipData = await ClientModel.aggregate([
            {
                $match: {
                    companyId: new mongoose.Types.ObjectId(companyId),
                    status: 'active'
                }
            },

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
                                                    { $eq: ['$billable', true] }
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
                                wipAmount: {
                                    $ifNull: [
                                        { $arrayElemAt: ['$wipData.wipAmount', 0] },
                                        0
                                    ]
                                },
                                wipDuration: {
                                    $ifNull: [
                                        { $arrayElemAt: ['$wipData.wipDuration', 0] },
                                        0
                                    ]
                                }
                            }
                        },
                        {
                            $lookup: {
                                from: 'wipopenbalances',
                                localField: '_id',
                                foreignField: 'jobId',
                                as: 'wipopenbalances'
                            }
                        },
                        {
                            $addFields: {
                                wipTotalOpenBalance: {
                                    $sum: '$wipopenbalances.amount'
                                }

                            }
                        },
                        {
                            $lookup:{
                                from:'wiptragetamounts',
                                localField:'wipTargetId',
                                foreignField:'_id',
                                as:'jobWipTraget'
                            }
                        },
                        {
                            $unwind: {
                                path: '$jobWipTraget',
                                preserveNullAndEmptyArrays: true
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
                                jobWipTraget:1

                            }
                        }
                    ],
                    as: 'jobs'
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
                        },
                        {
                            $group: {
                                _id: '$clientId',
                                totalExpenses: { $sum: '$totalAmount' },

                            }
                        },
                        {
                            $project: {
                                _id: 0,
                                totalExpenses: 1,
                            }
                        }

                    ],
                    as: 'expensesData'
                }
            },
            {
                $addFields: {
                    expensesData: { $arrayElemAt: ['$expensesData', 0] }
                }
            },
            {
                $lookup: {
                    from: 'wipopenbalances',
                    localField: '_id',
                    foreignField: 'clientId',
                    as: 'clientWipOpenBalance'
                }
            }, {
                $addFields: {
                    clientWipTotalOpenBalance: {
                        $sum: '$clientWipOpenBalance.amount'
                    }
                }
            },
            {
                $lookup:{
                    from:'wiptragetamounts',
                    localField:'wipTargetId',
                    foreignField:'_id',
                    as:'clientWipTraget'
                }
                
            },{
                $unwind: {
                    path: '$clientWipTraget',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    _id: 1,
                    clientRef: 1,
                    name: 1,
                    contactName: 1,
                    email: 1,
                    phone: 1,
                    jobs: 1,
                    expensesData: 1,
                    companyId: 1,
                    timelogs: 1,
                    clientWipTotalOpenBalance: 1,
                    clientWipOpenBalance: 1,
                    clientWipTraget:1

                },
            },

            {
                $sort: { clientName: 1 }
            }
        ]);
        SUCCESS(res, 200, "Work in progress data fetched successfully", { data: wipData });
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
        }: any = req.query;

        const companyId = req.user.companyId;

        const currentDate = new Date();

        // Build match conditions
        const matchConditions: any = {
            companyId: companyId,
            //   status: 'notInvoiced', // Only unbilled/not invoiced time logs
            billable: true, // Only billable hours
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

        // Aggregation pipeline to calculate WIP balance with aging
        const wipData = await TimeLogModel.aggregate([
            {
                $match: matchConditions,
            },
            {
                $addFields: {
                    // Calculate days difference from current date
                    daysOld: {
                        $divide: [
                            { $subtract: [currentDate, '$date'] },
                            1000 * 60 * 60 * 24, // Convert milliseconds to days
                        ],
                    },
                },
            },
            {
                $group: {
                    _id: '$clientId',
                    wipBalance: { $sum: '$amount' },
                    days30: {
                        $sum: {
                            $cond: [{ $lte: ['$daysOld', 30] }, '$amount', 0],
                        },
                    },
                    days60: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $gt: ['$daysOld', 30] },
                                        { $lte: ['$daysOld', 60] },
                                    ],
                                },
                                '$amount',
                                0,
                            ],
                        },
                    },
                    days90: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $gt: ['$daysOld', 60] },
                                        { $lte: ['$daysOld', 90] },
                                    ],
                                },
                                '$amount',
                                0,
                            ],
                        },
                    },
                    days120: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $gt: ['$daysOld', 90] },
                                        { $lte: ['$daysOld', 120] },
                                    ],
                                },
                                '$amount',
                                0,
                            ],
                        },
                    },
                    days150: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $gt: ['$daysOld', 120] },
                                        { $lte: ['$daysOld', 150] },
                                    ],
                                },
                                '$amount',
                                0,
                            ],
                        },
                    },
                    days180: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $gt: ['$daysOld', 150] },
                                        { $lte: ['$daysOld', 180] },
                                    ],
                                },
                                '$amount',
                                0,
                            ],
                        },
                    },
                    days180Plus: {
                        $sum: {
                            $cond: [{ $gt: ['$daysOld', 180] }, '$amount', 0],
                        },
                    },
                },
            },
            {
                $lookup: {
                    from: 'clients',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'clientInfo',
                },
            },
            {
                $unwind: '$clientInfo',
            },
            {
                $project: {
                    _id: 0,
                    clientId: '$_id',
                    clientRef: '$clientInfo.clientRef',
                    clientName: '$clientInfo.name',
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
            {
                $sort: { clientRef: 1 },
            },
        ]);

        // Calculate totals
        const totals = wipData.reduce(
            (acc, client) => {
                acc.wipBalance += client.wipBalance;
                acc.days30 += client.days30;
                acc.days60 += client.days60;
                acc.days90 += client.days90;
                acc.days120 += client.days120;
                acc.days150 += client.days150;
                acc.days180 += client.days180;
                acc.days180Plus += client.days180Plus;
                return acc;
            },
            {
                wipBalance: 0,
                days30: 0,
                days60: 0,
                days90: 0,
                days120: 0,
                days150: 0,
                days180: 0,
                days180Plus: 0,
            }
        );

        // Calculate summary cards
        const summary = {
            totalWIPBalance: parseFloat(totals.wipBalance.toFixed(2)),
            current0_30Days: parseFloat(totals.days30.toFixed(2)),
            days31_60: parseFloat(totals.days60.toFixed(2)),
            days60Plus: parseFloat(
                (
                    totals.days90 +
                    totals.days120 +
                    totals.days150 +
                    totals.days180 +
                    totals.days180Plus
                ).toFixed(2)
            ),
        };

        const response = {
            summary,
            clients: wipData,
            totalRow: {
                wipBalance: parseFloat(totals.wipBalance.toFixed(2)),
                days30: parseFloat(totals.days30.toFixed(2)),
                days60: parseFloat(totals.days60.toFixed(2)),
                days90: parseFloat(totals.days90.toFixed(2)),
                days120: parseFloat(totals.days120.toFixed(2)),
                days150: parseFloat(totals.days150.toFixed(2)),
                days180Plus: parseFloat(
                    (totals.days180 + totals.days180Plus).toFixed(2)
                ),
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
}

export default { workInProgress, createOpenWipBalance, wipBalance, attachWipTarget };