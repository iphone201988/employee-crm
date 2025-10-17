import { JobModel } from '../models/Job';
import { ClientModel } from '../models/Client';
import { TimeEntryModel } from '../models/TimeEntry';
import { ExpensesModel } from '../models/Expenses';
import { ObjectId } from '../utils/utills';




import mongoose from 'mongoose';
import { SUCCESS } from '../utils/response';
import { NextFunction, Request, Response } from 'express';

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
                            $project: {
                                _id: 1,
                                name: 1,
                                jobCost: 1,
                                status: 1,
                                startDate: 1,
                                endDate: 1,
                                priority: 1,
                                wipAmount: 1,
                                wipDuration: 1
                            }
                        }
                    ],
                    as: 'jobs'
                }
            },


            // {
            //     $lookup: {
            //         from: 'timelogs',
            //         let: { clientId: '$_id', companyId: '$companyId' },
            //         pipeline: [
            //             {
            //                 $match: {
            //                     $expr: {
            //                         $and: [
            //                             { $eq: ['$clientId', '$$clientId'] },
            //                             { $eq: ['$companyId', '$$companyId'] },
            //                             { $eq: ['$billable', true] }
            //                         ]
            //                     }
            //                 }
            //             },

            //             {
            //                 $group: {
            //                     _id: '$jobId',
            //                     totalAmount: { $sum: '$amount' },
            //                     totalHours: { $sum: '$duration' },
            //                 }
            //             }
            //         ],
            //         as: 'timelogs'
            //     }
            // },
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
                    timelogs: 1
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
}


export default { workInProgress };