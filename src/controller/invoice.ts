import { NextFunction, Request, Response } from "express";
import { SUCCESS } from "../utils/response";
import { BadRequestError } from "../utils/errors";
import { InvoiceModel } from "../models/Invoice";
import { escapeRegex, generateOtp, ObjectId } from "../utils/utills";
import { TimeLogModel } from "../models/TImeLog";
import { ExpensesModel } from "../models/Expenses";
import { WipOpenBalanceModel } from "../models/wipOpenBalance";
import { InvoiceLogModel } from "../models/InvoiceLog";
const createInvoice = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        let { date, clientId, timeLogIds, expenseIds, wipOpenBalanceIds, newExpenses } = req.body;
        req.body.companyId = req.user.companyId;
        req.body.invoiceCreatedBy = req.userId;
        let invoiceNo = `INV-${generateOtp(6)}`;
        req.body.invoiceNo = invoiceNo;
        const newInvoice = await InvoiceModel.create(req.body);
        await TimeLogModel.updateMany({ _id: { $in: timeLogIds } }, { status: 'invoice' });
        await ExpensesModel.updateMany({ _id: { $in: expenseIds } }, { status: 'yes' });
        await WipOpenBalanceModel.updateMany({ _id: { $in: wipOpenBalanceIds } }, { status: 'invoiced' });
        for (let exp of newExpenses || []) {
            exp.companyId = req.user.companyId;
            exp.submittedBy = req.userId;
            exp.clientId = ObjectId(clientId);
            exp.status = 'yes';
            exp.type = 'client'
            exp.Date = date || new Date();
            const expense = await ExpensesModel.create(exp);
            expenseIds.push(expense._id);
        }
        await InvoiceLogModel.create({
            invoiceId: newInvoice._id,
            action: 'generated',
            amount: newInvoice.totalAmount,
            companyId: req.user.companyId,
            date: date || new Date(),
        });
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

export default {
    createInvoice,
    getInvoices,
    createInvoiceLog,
    invoiceStatusChange,
    getInvoiceById,
};