import { NextFunction, Request, Response } from "express";
import { SUCCESS } from "../utils/response";
import { BadRequestError } from "../utils/errors";
import { InvoiceModel } from "../models/Invoice";
import { escapeRegex, generateOtp, ObjectId } from "../utils/utills";
import { TimeLogModel } from "../models/TImeLog";
import { ExpensesModel } from "../models/Expenses";
import { WipOpenBalanceModel } from "../models/wipOpenBalance";
import { InvoiceLogModel } from "../models/InvoiceLog";
import { ClientModel } from "../models/Client";
import { JobModel } from "../models/Job";
import { WriteOffModel } from "../models/WriteOff";
const createInvoice = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        let { date, clientId, timeLogIds = [], expenseIds = [], wipOpenBalanceIds = [], newExpenses = [], invoiceNo, source, attachmentUrl, writeOffData, jobId, scope } = req.body;
        req.body.companyId = req.user.companyId;
        req.body.invoiceCreatedBy = req.userId;
        const generatedInvoiceNo = invoiceNo || `INV-${generateOtp(6)}`;
        req.body.invoiceNo = generatedInvoiceNo;
        req.body.status = 'issued';
        req.body.originalNetAmount = req.body.netAmount || 0;
        req.body.source = source || 'system';
        if (attachmentUrl) {
            req.body.attachmentUrl = attachmentUrl;
        }
        if (jobId) {
            req.body.jobId = jobId;
        }
        if (scope) {
            req.body.scope = scope;
        }
        const newInvoice = await InvoiceModel.create(req.body);
        if (timeLogIds?.length) {
            await TimeLogModel.updateMany({ _id: { $in: timeLogIds } }, { status: 'invoiced' });
        }
        if (expenseIds?.length) {
            await ExpensesModel.updateMany({ _id: { $in: expenseIds } }, { status: 'yes' });
        }
        if (wipOpenBalanceIds?.length) {
            await WipOpenBalanceModel.updateMany({ _id: { $in: wipOpenBalanceIds } }, { status: 'invoiced' });
        }
        for (let exp of newExpenses || []) {
            exp.companyId = req.user.companyId;
            exp.submittedBy = req.userId;
            exp.clientId = ObjectId(clientId);
            exp.status = 'yes';
            exp.type = 'client'
            exp.date = date || new Date();
            const expense = await ExpensesModel.create(exp);
            expenseIds.push(expense._id);
        }
        await InvoiceLogModel.create({
            invoiceId: newInvoice._id,
            action: 'generated',
            amount: newInvoice.totalAmount,
            companyId: req.user.companyId,
            date: date || new Date(),
            performedBy: req.userId
        });
        if (writeOffData && writeOffData.writeOffBalance > 0) {
            const hasTimeLogs = Array.isArray(writeOffData.timeLogs) && writeOffData.timeLogs.length > 0;
            const writeOffAmount = Number(writeOffData.writeOffBalance || 0);
            
            // Create write-off payload (timeLogs can be empty if no time logs exist)
            const writeOffPayload: any = {
                invoiceId: newInvoice._id,
                timeLogs: hasTimeLogs ? writeOffData.timeLogs.map((log: any) => ({
                    timeLogId: ObjectId(log.timeLogId),
                    writeOffAmount: Number(log.writeOffAmount || 0),
                    writeOffPercentage: Number(log.writeOffPercentage || 0),
                    originalAmount: Number(log.originalAmount || 0),
                    duration: Number(log.duration || 0),
                    clientId: ObjectId(log.clientId || clientId),
                    jobId: ObjectId(log.jobId || jobId),
                    userId: ObjectId(log.userId),
                    jobCategoryId: ObjectId(log.jobCategoryId),
                })) : [], // Empty array if no time logs
                reason: writeOffData.reason || '',
                logic: writeOffData.logic || 'proportionally',
                performedBy: req.userId,
                companyId: req.user.companyId,
                totalWriteOffAmount: writeOffAmount,
                totalOriginalAmount: hasTimeLogs 
                    ? writeOffData.timeLogs.reduce((sum: number, log: any) => sum + Number(log.originalAmount || 0), 0)
                    : 0,
                totalDuration: hasTimeLogs
                    ? writeOffData.timeLogs.reduce((sum: number, log: any) => sum + Number(log.duration || 0), 0)
                    : 0,
            };

            const writeOff = await WriteOffModel.create(writeOffPayload);
            
            // Update time logs status if time logs exist
            if (hasTimeLogs && writeOff?.timeLogs?.length) {
                await TimeLogModel.updateMany(
                    { _id: { $in: writeOff.timeLogs.map((log: any) => log.timeLogId) } },
                    { status: 'writeOff' }
                );
            }
            
            // If no time logs, reduce client's imported WIP balance
            if (!hasTimeLogs && clientId) {
                const clientDoc = await ClientModel.findById(clientId).select('wipBalance');
                if (clientDoc) {
                    const currentBalance = Number(clientDoc.wipBalance || 0);
                    clientDoc.wipBalance = Math.max(0, currentBalance - writeOffAmount);
                    await clientDoc.save();
                }
                
                // Also update WipOpenBalance entries if they exist
                if (wipOpenBalanceIds?.length) {
                    await WipOpenBalanceModel.updateMany(
                        { _id: { $in: wipOpenBalanceIds.map((id: string) => ObjectId(id)) } },
                        { status: 'writeOff' }
                    );
                }
            }
            
            await InvoiceLogModel.create({
                invoiceId: newInvoice._id,
                action: 'writeOff',
                amount: writeOff.totalWriteOffAmount,
                companyId: req.user.companyId,
                date: date || new Date(),
                performedBy: req.userId
            });
        }

        const invoiceNetAmount = Number(req.body.netAmount || 0);
        let timeLogsAmount = 0;
        let openBalanceAmount = 0;
        const newExpensesNet = (newExpenses || []).reduce((sum: number, exp: any) => sum + Number(exp.netAmount || 0), 0);

        if (timeLogIds?.length) {
            const timeLogSum = await TimeLogModel.aggregate([
                { $match: { _id: { $in: timeLogIds.map((id: string) => ObjectId(id)) }, companyId: req.user.companyId } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]);
            timeLogsAmount = Number(timeLogSum[0]?.total || 0);
        }

        if (wipOpenBalanceIds?.length) {
            const openBalanceSum = await WipOpenBalanceModel.aggregate([
                { $match: { _id: { $in: wipOpenBalanceIds.map((id: string) => ObjectId(id)) }, companyId: req.user.companyId } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]);
            openBalanceAmount = Number(openBalanceSum[0]?.total || 0);
        }

        const importedPortion = Math.max(0, invoiceNetAmount - timeLogsAmount - openBalanceAmount - newExpensesNet);
       
            const clientDoc = await ClientModel.findById(clientId).select('wipBalance');
            if (clientDoc) {
               
                clientDoc.wipBalance = 0
                await clientDoc.save();
            }
        

        SUCCESS(res, 200, "Invoice created successfully", { data: newInvoice });
    } catch (error) {
        console.log("error in createInvoice", error);
        next(error);
    }
};
const getInvoices = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        let { page = 1, limit = 10, clientId, status, startDate,
            endDate, } = req.query;
        page = parseInt(page as string);
        limit = parseInt(limit as string);
        const skip = (page - 1) * limit;
        const query: any = { companyId: req.user.companyId };
        if (clientId) {
            query.clientId = ObjectId(clientId);
        }
        if (status) {
            query.status = status;
        }
        // Date filtering
        if (startDate || endDate) {
            query.date = {};
            if (startDate) {
                query.date.$gte = new Date(startDate as string);
            }
            if (endDate) {
                query.date.$lte = new Date(endDate as string);
            }
        }
        const invoices = await InvoiceModel.aggregate([
            { $match: query },
            { $sort: { updatedAt: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
                $lookup: {
                    from: 'clients',
                    localField: 'clientId',
                    foreignField: '_id',
                    as: 'client',
                },
            },
            {
                $unwind: {
                    path: '$client',
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $lookup: {
                    from: 'timelogs',
                    localField: 'timeLogIds',
                    foreignField: '_id',
                    as: 'timeLogs',
                    pipeline: [
                        {
                            $lookup: {
                                from: 'clients',
                                localField: 'clientId',
                                foreignField: '_id',
                                as: 'client',
                                pipeline: [{ $project: { name: 1, _id: 1 } }],
                            }
                        },
                        { $unwind: { path: '$client', preserveNullAndEmptyArrays: true } },
                        {
                            $lookup: {
                                from: 'users',
                                localField: 'userId',
                                foreignField: '_id',
                                as: 'user',
                                pipeline: [{ $project: { _id: 1, name: 1, avatarUrl: 1 } }],
                            }
                        },
                        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
                        {
                            $lookup: {
                                from: 'jobs',
                                localField: 'jobId',
                                foreignField: '_id',
                                as: 'job',
                                pipeline: [{ $project: { name: 1, _id: 1 } }],
                            }
                        },
                        { $unwind: { path: '$job', preserveNullAndEmptyArrays: true } },
                        {
                            $lookup: {
                                from: 'timecategories',
                                localField: 'timeCategoryId',
                                foreignField: '_id',
                                as: 'timeCategory',
                            }
                        },
                        { $unwind: { path: '$timeCategory', preserveNullAndEmptyArrays: true } },
                        {
                            $lookup: {
                                from: 'jobcategories',
                                localField: 'jobTypeId',
                                foreignField: '_id',
                                as: 'jobCategory',
                            }
                        }, {
                            $unwind: {
                                path: '$jobCategory',
                                preserveNullAndEmptyArrays: true,
                            },
                        }

                    ]
                }
            },
            {
                $lookup: {
                    from: 'invoicelogs',
                    localField: '_id',
                    foreignField: 'invoiceId',
                    as: 'invoiceLogs',
                },
            }
        ]);
        // Get total count for pagination
        const totalCount = await InvoiceModel.countDocuments(query);

        // Calculate summary statistics
        const summaryPipeline = await InvoiceModel.aggregate([
            { $match: query },
            {
                $group: {
                    _id: null,
                    totalInvoiced: { $sum: '$totalAmount' },
                    totalPaid: { $sum: '$paidAmount' },
                    totalPartial: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $gt: ['$paidAmount', 0] },
                                        { $lt: ['$paidAmount', '$totalAmount'] }
                                    ]
                                },
                                { $subtract: ['$totalAmount', '$paidAmount'] },
                                0
                            ]
                        }
                    },
                    totalOutstanding: {
                        $sum: { $subtract: ['$totalAmount', '$paidAmount'] }
                    }
                }
            }
        ]);

        const summary = summaryPipeline[0] || {
            totalInvoiced: 0,
            totalPaid: 0,
            totalPartial: 0,
            totalOutstanding: 0,
        };
        const pagination = {
            currentPage: page,
            pageSize: limit,
            total: totalCount,
        }
        SUCCESS(res, 200, "Invoices fetched successfully", { data: invoices, pagination, summary });
    } catch (error) {
        console.log("error in getInvoices", error);
        next(error);
    }
};
const getInvoiceById = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        let { invoiceId, } = req.params;

        const query: any = { _id: ObjectId(invoiceId), };

        const [invoices] = await InvoiceModel.aggregate([
            { $match: query },
            {
                $lookup: {
                    from: 'clients',
                    localField: 'clientId',
                    foreignField: '_id',
                    as: 'client',
                },
            },
            {
                $unwind: {
                    path: '$client',
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $lookup: {
                    from: 'timelogs',
                    localField: 'timeLogIds',
                    foreignField: '_id',
                    as: 'timeLogs',
                    pipeline: [
                        {
                            $lookup: {
                                from: 'clients',
                                localField: 'clientId',
                                foreignField: '_id',
                                as: 'client',
                                pipeline: [{ $project: { name: 1, _id: 1 } }],
                            }
                        },
                        { $unwind: { path: '$client', preserveNullAndEmptyArrays: true } },
                        {
                            $lookup: {
                                from: 'users',
                                localField: 'userId',
                                foreignField: '_id',
                                as: 'user',
                                pipeline: [{ $project: { _id: 1, name: 1, avatarUrl: 1 } }],
                            }
                        },
                        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
                        {
                            $lookup: {
                                from: 'jobs',
                                localField: 'jobId',
                                foreignField: '_id',
                                as: 'job',
                                pipeline: [{ $project: { name: 1, _id: 1 } }],
                            }
                        },
                        { $unwind: { path: '$job', preserveNullAndEmptyArrays: true } },
                        {
                            $lookup: {
                                from: 'timecategories',
                                localField: 'timeCategoryId',
                                foreignField: '_id',
                                as: 'timeCategory',
                            }
                        },
                        { $unwind: { path: '$timeCategory', preserveNullAndEmptyArrays: true } },
                    ]
                }
            },
            {
                $lookup: {
                    from: 'invoicelogs',
                    localField: '_id',
                    foreignField: 'invoiceId',
                    as: 'invoiceLogs',
                },
            }
        ]);
        SUCCESS(res, 200, "Invoices fetched successfully", { data: invoices });
    } catch (error) {
        console.log("error in getInvoices", error);
        next(error);
    }
}

const createInvoiceLog = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        let { invoiceId, action, amount, date } = req.body;
        const invoice = await InvoiceModel.findOne({ _id: invoiceId });
        if (!invoice) {
            throw new BadRequestError("Invoice not found");
        }
        const invoiceLog = await InvoiceLogModel.create({ invoiceId, action, amount, date, companyId: req.user.companyId, performedBy: req.userId });
        invoice.paidAmount += amount;
        await invoice.save();


        SUCCESS(res, 200, "Invoice log created successfully", { data: invoiceLog });
    } catch (error) {
        console.log("error in createInvoiceLog", error);
        next(error);
    }
};

const getInvoiceTimeLogs = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { timeLogIds = [] } = req.body;
        if (!Array.isArray(timeLogIds) || timeLogIds.length === 0) {
            throw new BadRequestError("timeLogIds are required");
        }

        const ids = timeLogIds.map((id: string) => ObjectId(id));
        const timeLogs = await TimeLogModel.find({
            _id: { $in: ids },
            companyId: req.user.companyId
        })
            .populate('userId', 'name')
            .populate('jobId', 'name clientId jobTypeId')
            .populate('jobTypeId', 'name')
            .lean();

        const formatted = timeLogs.map((log: any) => ({
            timeLogId: log._id,
            description: log.description,
            date: log.date,
            duration: log.duration,
            rate: log.rate,
            amount: log.amount,
            clientId: log.clientId,
            jobId: log.jobId?._id || log.jobId,
            jobName: log.jobId?.name,
            userId: log.userId?._id || log.userId,
            userName: log.userId?.name,
            jobCategoryId: log.jobTypeId?._id || log.jobTypeId,
        }));

        SUCCESS(res, 200, "Invoice time logs fetched successfully", { data: formatted });
    } catch (error) {
        console.log("error in getInvoiceTimeLogs", error);
        next(error);
    }
};
const invoiceStatusChange = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        let { invoiceId, status, } = req.body;
        const invoice = await InvoiceModel.findOneAndUpdate({ _id: invoiceId }, { status }, { new: true });
        if (status === 'paid') {
            await TimeLogModel.updateMany({ _id: { $in: invoice?.timeLogIds } }, { status: 'paid' });
        }
        SUCCESS(res, 200, "Invoice status changed successfully", { data: invoice });
    } catch (error) {
        console.log("error in invoiceStatusChange", error);
        next(error);
    }
};

const getAgedDebtors = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const {
            startDate,
            endDate,
            clientId,
            page = '1',
            limit = '10',
        }: any = req.query;

        const companyId = req.user.companyId;
        const currentDate = new Date();

        const pageNumber = parseInt(page, 10);
        const pageSize = parseInt(limit, 10);
        const skipCount = (pageNumber - 1) * pageSize;

        // Build match conditions - only invoices with outstanding balance
        const matchConditions: any = {
            companyId: ObjectId(companyId),
            $expr: { $gt: [{ $subtract: ['$totalAmount', '$paidAmount'] }, 0] }, // Only unpaid/partially paid
        };

        if (clientId) {
            matchConditions.clientId = ObjectId(clientId);
        }

        if (startDate || endDate) {
            matchConditions.date = {};
            if (startDate) {
                matchConditions.date.$gte = new Date(startDate);
            }
            if (endDate) {
                matchConditions.date.$lte = new Date(endDate);
            }
        }

        // Aggregation pipeline for aged debtors with pagination
        const pipeline = [
            { $match: matchConditions },
            {
                $addFields: {
                    // Calculate outstanding balance
                    balance: { $subtract: ['$totalAmount', '$paidAmount'] },
                    // Calculate days since invoice date
                    daysOld: {
                        $floor: {
                            $divide: [
                                { $subtract: [currentDate, '$date'] },
                                1000 * 60 * 60 * 24,
                            ],
                        },
                    },
                },
            },
            {
                $group: {
                    _id: '$clientId',
                    clientRef: { $first: '$clientId' },
                    totalBalance: { $sum: '$balance' },

                    // Aging buckets based on invoice date
                    days30: {
                        $sum: {
                            $cond: [{ $lte: ['$daysOld', 30] }, '$balance', 0],
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
                                '$balance',
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
                                '$balance',
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
                                '$balance',
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
                                '$balance',
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
                                '$balance',
                                0,
                            ],
                        },
                    },
                    days180Plus: {
                        $sum: {
                            $cond: [{ $gt: ['$daysOld', 180] }, '$balance', 0],
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
                $unwind: {
                    path: '$clientInfo',
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $project: {
                    _id: 0,
                    clientId: '$_id',
                    clientRef: '$clientInfo.clientRef',
                    clientName: '$clientInfo.name',
                    balance: { $round: ['$totalBalance', 2] },
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
        ];

        // Execute paginated query
        const paginatedPipeline: any = [
            ...pipeline,
            { $skip: skipCount },
            { $limit: pageSize },
        ];

        const agedDebtorsData = await InvoiceModel.aggregate(paginatedPipeline);

        // Get total count for pagination
        const countPipeline = [
            { $match: matchConditions },
            {
                $group: {
                    _id: '$clientId',
                },
            },
            {
                $count: 'totalClients',
            },
        ];
        const countResult = await InvoiceModel.aggregate(countPipeline);
        const totalClients = countResult.length > 0 ? countResult[0].totalClients : 0;

        // Calculate totals from all data (not just current page)
        const totalsPipeline: any = [
            ...pipeline,
            {
                $group: {
                    _id: null,
                    totalBalance: { $sum: '$balance' },
                    total30Days: { $sum: '$days30' },
                    total60Days: { $sum: '$days60' },
                    total90Days: { $sum: '$days90' },
                    total120Days: { $sum: '$days120' },
                    total150Days: { $sum: '$days150' },
                    total180Days: { $sum: '$days180' },
                    total180Plus: { $sum: '$days180Plus' },
                },
            },
        ];

        const totalsResult = await InvoiceModel.aggregate(totalsPipeline);
        const totals = totalsResult[0] || {
            totalBalance: 0,
            total30Days: 0,
            total60Days: 0,
            total90Days: 0,
            total120Days: 0,
            total150Days: 0,
            total180Days: 0,
            total180Plus: 0,
        };

        // Calculate summary cards (same as totals for aged debtors)
        const summary = {
            days30: parseFloat(totals.total30Days.toFixed(2)),
            days60: parseFloat(totals.total60Days.toFixed(2)),
            days90Plus: parseFloat(
                (
                    totals.total90Days +
                    totals.total120Days +
                    totals.total150Days +
                    totals.total180Days +
                    totals.total180Plus
                ).toFixed(2)
            ),
            days150Plus: parseFloat(
                (totals.total150Days + totals.total180Days + totals.total180Plus).toFixed(2)
            ),
        };

        const response = {
            summary,
            clients: agedDebtorsData,
            totals: {
                balance: parseFloat(totals.totalBalance.toFixed(2)),
                days30: parseFloat(totals.total30Days.toFixed(2)),
                days60: parseFloat(totals.total60Days.toFixed(2)),
                days90: parseFloat(totals.total90Days.toFixed(2)),
                days120: parseFloat(totals.total120Days.toFixed(2)),
                days150: parseFloat(totals.total150Days.toFixed(2)),
                days180: parseFloat(totals.total180Days.toFixed(2)),
                days180Plus: parseFloat(totals.total180Plus.toFixed(2)),
            },
            pagination: {
                currentPage: pageNumber,
                pageSize,
                totals: totalClients,
            },
        };

        return res.status(200).json({
            success: true,
            message: 'Aged debtors report fetched successfully',
            data: response,
        });
    } catch (error: any) {
        console.error('Error fetching aged debtors:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch aged debtors report',
            error: error.message,
        });
    }
};
const getInvoiceByInvoiceNo = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { invoiceNo } = req.params;
        const invoice:any = await InvoiceModel.findOne({ invoiceNo }).populate({
            path: 'timeLogIds',
            populate: [
                {
                    path: 'userId',
                    select: 'name avatarUrl'
                },
                {
                    path: 'clientId',
                    select: 'name clientRef'
                },
                {
                    path: 'jobId',
                    select: 'name'
                }
            ]
        }).lean();
        if (!invoice) {
            throw new BadRequestError("Invoice not found");
        }
        invoice.totalLogAmount = invoice.timeLogIds.reduce((total: number, log: any) => total + log.amount, 0);
        SUCCESS(res, 200, "Invoice fetched successfully", { data: invoice });
    } catch (error) {
        console.log("error in getInvoiceByInvoiceNumber", error);
        next(error);
    }
};


export default {
    createInvoice,
    getInvoices,
    createInvoiceLog,
    invoiceStatusChange,
    getInvoiceById,
    getAgedDebtors,
    getInvoiceByInvoiceNo,
    getInvoiceTimeLogs,
};