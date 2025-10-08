import Joi from "joi";

const addExpenseValidation = {
    body: Joi.object({
        netAmount: Joi.number().required().messages({
            "number.base": "Account must be a number",
            "any.required": "Amount is required",
        }),
        date: Joi.date().required().messages({
            "date.base": "Date must be a date",
            "any.required": "Date is required",
        }),
        description: Joi.string().required().messages({
            "string.base": "Description must be a string",
            "any.required": "Description is required",
        }),
        type: Joi.string().required().valid('client', 'team').messages({
            "string.base": "Type must be a string",
            "any.required": "Type is required",
            "any.only": "Type must be one of: client, team"
        }),
        clientId: Joi.string().optional().pattern(/^[0-9a-fA-F]{24}$/).messages({
            'string.pattern': 'clientId must be a valid MongoDB ObjectId',            
        }),
        userId: Joi.string().optional().pattern(/^[0-9a-fA-F]{24}$/).messages({
            'string.pattern': 'userId must be a valid MongoDB ObjectId',
        }),
        expreseCategory: Joi.string().required().messages({
            "string.base": "Expense category must be a string",
            "any.required": "Expense category is required",
        }),
        vatPercentage: Joi.number().optional().messages({
            "number.base": "VAT percentage must be a number",
        }),
        vatAmount: Joi.number().optional().messages({
            "number.base": "VAT account must be a number",
        }),
        totalAmount: Joi.number().optional().messages({
            "number.base": "Total amount must be a number",
        }),
        status: Joi.string().valid('yes', 'no').required().messages({
            "string.base": "Status must be a string",
            "any.required": "Status is required",
            "any.only": "Status must be one of: yes, no"
        }),
    }),
};
const updateExpenseValidation ={
    params: Joi.object({
        expenseId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required()
            .messages({
                'string.pattern': 'expenseId must be a valid MongoDB ObjectId',
                'any.required': 'expenseId is required'
            }),
    }),
    body: Joi.object({
        netAmount: Joi.number().optional().messages({
            "number.base": "Account must be a number",
        }),
        date: Joi.date().optional().messages({
            "date.base": "Date must be a date",
        }),
        description: Joi.string().optional().messages({
            "string.base": "Description must be a string",
        }),
        type: Joi.string().optional().valid('client', 'team').messages({
            "string.base": "Type must be a string",
            "any.only": "Type must be one of: client, team"
        }),
        clientId: Joi.string().optional().pattern(/^[0-9a-fA-F]{24}$/).messages({
            'string.pattern': 'clientId must be a valid MongoDB ObjectId',            
        }),
        userId: Joi.string().optional().pattern(/^[0-9a-fA-F]{24}$/).messages({
            'string.pattern': 'userId must be a valid MongoDB ObjectId',
        }),
        expreseCategory: Joi.string().optional().messages({
            "string.base": "Expense category must be a string",
        }),
        vatPercentage: Joi.number().optional().messages({
            "number.base": "VAT percentage must be a number",
        }),
        vatAmount: Joi.number().optional().messages({
            "number.base": "VAT account must be a number",
        }),
        totalAmount: Joi.number().optional().messages({
            "number.base": "Total amount must be a number",
        }),
        status: Joi.string().optional().valid('yes', 'no').messages({
            "string.base": "Status must be a string",
            "any.only": "Status must be one of: yes, no"
        }),
    }),
}

export default { addExpenseValidation, updateExpenseValidation };