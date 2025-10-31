import Joi from 'joi';

const createInvoiceValidation = {
    body: Joi.object({
        date: Joi.date().required(),
        clientId: Joi.string().required(),
        netAmount: Joi.number().min(0).required(),
        vatPercentage: Joi.number().min(0).required(),
        vatAmount: Joi.number().min(0).required(),
        expenseAmount: Joi.number().min(0).required(),
        totalAmount: Joi.number().min(0).required(),
        timeLogIds: Joi.array().items(Joi.string()).optional(),
        expenseIds: Joi.array().items(Joi.string()).optional(),
        wipOpenBalanceIds: Joi.array().items(Joi.string()).optional(),
        newExpenses: Joi.array().items(
            Joi.object({
                description: Joi.string().allow(''),
                netAmount: Joi.number().min(0).required(),
                vatPercentage: Joi.number().min(0).required(),
                vatAmount: Joi.number().min(0).required(),
                totalAmount: Joi.number().min(0).required(),
            })
        ).optional(),
    }),
};
const createInvoiceLogValidation = {
    body: Joi.object({
        invoiceId: Joi.string().required(),
        action: Joi.string().required(),
        amount: Joi.number().min(0).required(),
        date: Joi.date().required(),
    }),
};
 const updateInvoiceStatusValidation = {
     body: Joi.object({
         invoiceId: Joi.string().required(),
         status: Joi.string().required(),
     }),
 }
export default {
    createInvoiceValidation,
    createInvoiceLogValidation,
    updateInvoiceStatusValidation
};
