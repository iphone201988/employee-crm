import { NextFunction, Request, Response } from "express";
import { SUCCESS } from "../utils/response";
import { BadRequestError } from "../utils/errors";
import { ExpensesModel } from "../models/Expenses";
import { escapeRegex, ObjectId } from "../utils/utills";


const createExpense = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {


        let { type, userId, vatPercentage, vatAmount, totalAmount, } = req.body;
        if ((req.files as any)?.length) {
            req.body.attachments =
                (req.files as any)?.map((file: any) => `/uploads/${file.filename}`);
        }
        req.body.companyId = req.user.companyId;
        req.body.submittedBy = req.userId;
        req.body.netAmount = Number(req.body.netAmount) || 0;
        req.body.vatPercentage = Number(vatPercentage) || 0;
        req.body.vatAmount = Number(vatAmount) || (req.body.netAmount * (req.body.vatPercentage / 100));
        req.body.totalAmount = Number(totalAmount) || (req.body.netAmount + req.body.vatAmount);
        if (type == 'team') {
            req.body.userId = userId || req.userId;
        }
        const newExpense = await ExpensesModel.create(req.body);
        SUCCESS(res, 200, "Expense created successfully", { data: newExpense });
    } catch (error) {
        console.log("error in createExpense", error);
        next(error);

    }
};
const updateExpense = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { expenseId } = req.params;
        const expense = await ExpensesModel.findById(expenseId);
        if (!expense) {
            throw new BadRequestError("Expense not found");
        }
        if ((req.files as any)?.length) {
            req.body.attachments =
                (req.files as any)?.map((file: any) => `/uploads/${file.filename}`);
        }
        req.body.netAmount = Number(req.body.netAmount) || expense.netAmount;
        req.body.vatPercentage = Number(req.body.vatPercentage) || expense.vatPercentage;
        req.body.vatAmount = Number(req.body.vatAmount) || (req.body.netAmount * (req.body.vatPercentage / 100));
        req.body.totalAmount = Number(req.body.totalAmount) || (req.body.netAmount + req.body.vatAmount);
        const newExpense = await ExpensesModel.findByIdAndUpdate(expenseId, req.body, { new: true });
        SUCCESS(res, 200, "Expense updated successfully", { data: newExpense });
    } catch (error) {
        console.log("error in updateExpense", error);
        next(error);
    }
};

const deleteExpense = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { expenseId } = req.params;
        const expense = await ExpensesModel.findById(expenseId);
        if (!expense) {
            throw new BadRequestError("Expense not found");
        }
        await ExpensesModel.findByIdAndDelete(expenseId);
        SUCCESS(res, 200, "Expense deleted successfully", { data: {} });
    } catch (error) {
        console.log("error in deleteExpense", error);
        next(error);
    }
};
const getExpenses = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        let { status, search = '', type = 'client', page = 1, limit = 10 } = req.query;

        const searchRegex = new RegExp(`^${escapeRegex(search as string)}`, 'i');

        page = parseInt(page as string);
        limit = parseInt(limit as string);
        const skip = (page - 1) * limit;

        const matchQuery: any = {
            companyId: req.user.companyId
        };
        if (status) {
            matchQuery.status = status;
        }
        if (type) {
            matchQuery.type = type;
        }

        // Start building the aggregation pipeline
        const pipeline: any[] = [
            { $match: matchQuery },
            {
                $lookup: {
                    from: "clients",
                    localField: "clientId",
                    foreignField: "_id",
                    as: "client",
                    pipeline: [{ $project: { name: 1, _id: 1, } }],
                },
            },
            { $unwind: { path: "$client", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "users",
                    localField: "userId",
                    foreignField: "_id",
                    as: "user",
                    pipeline: [{ $project: { name: 1, _id: 1, avatarUrl: 1 } }],
                },
            },
            { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
            {
                $addFields: {
                    
                }
            }
        ];

        // Conditionally add search stage
        if (search && typeof search === 'string' && search.trim() !== "") {
            if (type === 'client') {
                pipeline.push({ $match: { "client.name": searchRegex } });
            } else if (type === 'team') {
                pipeline.push({ $match: { "user.name": searchRegex } });
            }
        }

        // Add pagination facet
        pipeline.push({
            $facet: {
                data: [{ $skip: skip }, {
                    $limit: limit,
                },
                    {
                        $lookup: {
                            from: "users",
                            localField: "submittedBy",
                            foreignField: "_id",
                            as: "submittedDetails",
                            pipeline: [{ $project: { name: 1, _id: 1, } }],
                        }
                    },
                    {
                        $unwind: { path: "$submittedDetails", preserveNullAndEmptyArrays: true }
                    },

                ],
                count: [{ $count: "count" }],
                statistics: [
                    {
                        $group: {
                            _id: null,
                            // Total counts
                            totalExpenses: { $sum: 1 },
                            totalStatusYesExpenses: {
                                $sum: { $cond: [{ $eq: ["$status", "yes"] }, 1, 0] }
                            },
                            totalStatusNoExpenses: {
                                $sum: { $cond: [{ $eq: ["$status", "no"] }, 1, 0] }
                            },
                            
                            // Amount totals
                            totalAmount: { $sum: "$totalAmount" },
                            
                            // Approved amounts (status = 'yes')
                            approvedTotalAmount: {
                                $sum: { $cond: [{ $eq: ["$status", "yes"] }, "$totalAmount", 0] }
                            },
                            
                            // Pending amounts (status = 'no')
                            pendingTotalAmount: {
                                $sum: { $cond: [{ $eq: ["$status", "no"] }, "$totalAmount", 0] }
                            },
                            
                            // Additional statistics
                            averageExpenseAmount: { $avg: "$totalAmount" },
                            maxExpenseAmount: { $max: "$totalAmount" },
                            minExpenseAmount: { $min: "$totalAmount" },
                            
                        }
                    },
                    {
                        $project: {
                            _id: 0,
                        }
                    }
                ]
            },
        });

        // Execute aggregation
        const expenses = await ExpensesModel.aggregate(pipeline);

        const data = expenses[0]?.data || [];
        const totalExpenses = expenses[0]?.count[0]?.count || 0;
        const statistics = expenses[0]?.statistics[0]|| {};

        const pagination = {
            page,
            limit,
            total: totalExpenses,
        };

        SUCCESS(res, 200, "Expenses found successfully", { data: { expenses: data, pagination, statistics } });
    } catch (error) {
        console.log("error in getExpense", error);
        next(error);
    }
};

export default { createExpense, updateExpense, deleteExpense, getExpenses };