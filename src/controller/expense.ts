import { NextFunction, Request, Response } from "express";
import { SUCCESS } from "../utils/response";
import { BadRequestError } from "../utils/errors";
import { ExpensesModel } from "../models/Expenses";
import { escapeRegex, ObjectId } from "../utils/utills";


const createExpense = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {


        let { type, userId, vatPercentage, vatAccount, totalAmount, } = req.body;
        if ((req.files as any)?.length) {
            req.body.attachments =
                (req.files as any)?.map((file: any) => `/uploads/${file.filename}`);
        }
        req.body.companyId = req.user.companyId;
        req.body.submittedBy = req.userId;
        req.body.netAccount = Number(req.body.netAccount) || 0;
        req.body.vatPercentage = Number(vatPercentage) || 5;
        req.body.vatAccount = Number(vatAccount) || (req.body.netAccount * (req.body.vatPercentage / 100));
        req.body.totalAmount = Number(totalAmount) || (req.body.netAccount + req.body.vatAccount);
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
        req.body.netAccount = Number(req.body.netAccount) || expense.netAccount;
        req.body.vatPercentage = Number(req.body.vatPercentage) || expense.vatPercentage;
        req.body.vatAccount = Number(req.body.vatAccount) || (req.body.netAccount * (req.body.vatPercentage / 100));
        req.body.totalAmount = Number(req.body.totalAmount) || (req.body.netAccount + req.body.vatAccount);
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
                },
            },
            { $unwind: { path: "$client", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "users",
                    localField: "userId",
                    foreignField: "_id",
                    as: "user",
                },
            },
            { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
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
                data: [{ $skip: skip }, { $limit: limit }],
                count: [{ $count: "count" }],
            },
        });

        // Execute aggregation
        const expenses = await ExpensesModel.aggregate(pipeline);

        const data = expenses[0]?.data || [];
        const totalExpenses = expenses[0]?.count[0]?.count || 0;

        const pagination = {
            page,
            limit,
            total: totalExpenses,
        };

        SUCCESS(res, 200, "Expenses found successfully", { data: { data, pagination } });
    } catch (error) {
        console.log("error in getExpense", error);
        next(error);
    }
};

export default { createExpense, updateExpense, deleteExpense, getExpenses };