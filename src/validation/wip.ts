import Joi from 'joi';

const createInvoiceValidation = {
    body: Joi.object({
        invoiceNo: Joi.string().optional(),
        date: Joi.date().required(),
        clientId: Joi.string().required(),
        jobId: Joi.string().optional(),
        scope: Joi.string().valid('client', 'job').optional(),
        netAmount: Joi.number().min(0).required(),
        vatPercentage: Joi.number().min(0).required(),
        vatAmount: Joi.number().min(0).required(),
        expenseAmount: Joi.number().min(0).required(),
        totalAmount: Joi.number().min(0).required(),
        source: Joi.string().valid('system', 'manual').optional(),
        attachmentUrl: Joi.string().allow('').optional(),
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
        writeOffData: Joi.object({
            reason: Joi.string().allow(''),
            logic: Joi.string().valid('proportionally', 'manually').optional(),
            writeOffBalance: Joi.number().min(0).optional(),
            timeLogs: Joi.array().items(
                Joi.object({
                    timeLogId: Joi.string().required(),
                    writeOffAmount: Joi.number().min(0).required(),
                    writeOffPercentage: Joi.number().min(0).required(),
                    originalAmount: Joi.number().min(0).required(),
                    duration: Joi.number().min(0).required(),
                    clientId: Joi.string().required(),
                    jobId: Joi.string().required(),
                    userId: Joi.string().required(),
                    jobCategoryId: Joi.string().required(),
                })
            ).optional()
        }).optional(),
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
};

const createWriteOffValidation = {
    body: Joi.object({
        invoiceNo: Joi.string().required(),
        amount: Joi.number().min(0).required(),
        date: Joi.date().required(),
        writeOffData: Joi.object({
            timeLogs: Joi.array().items(
                Joi.object({
                    timeLogId: Joi.string().required(),
                    writeOffAmount: Joi.number().min(0).required(),
                    writeOffPercentage: Joi.number().min(0).required(),
                    originalAmount: Joi.number().min(0).required(),
                    duration: Joi.number().min(0).required(),
                    clientId: Joi.string().required(),
                    jobId: Joi.string().required(),
                    userId: Joi.string().required(),
                    jobCategoryId: Joi.string().required(),
                })
            ),
            reason: Joi.string().required(),
            logic: Joi.string().valid('proportionally', 'manually').required(),
        })
    }),
}
const getInvoiceTimeLogsValidation = {
    body: Joi.object({
        timeLogIds: Joi.array().items(Joi.string().required()).min(1).required(),
    }),
};
export default {
    createInvoiceValidation,
    createInvoiceLogValidation,
    updateInvoiceStatusValidation,
    createWriteOffValidation,
    getInvoiceTimeLogsValidation
};
