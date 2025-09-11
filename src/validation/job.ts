import Joi from "joi";  
const createJobValidation = {
    body: Joi.object({
        name: Joi.string().required().messages({
            "string.base": "name must be a string",
            "any.required": "Name is required",
        }),
        description: Joi.string().required().messages({
            "string.base": "Description must be a string",
            "any.required": "Description is required",
        }),
        clientId: Joi.string().required().messages({
            "string.base": "Client ID must be a string",
            "any.required": "Client ID is required",
        }),
        jobTypeId: Joi.string().required().messages({
            "string.base": "Job type ID must be a string",
            "any.required": "Job type ID is required",
        }),
        jobManagerId: Joi.string().required().messages({
            "string.base": "Job manager ID must be a string",
            "any.required": "Job manager ID is required",
        }),
        startDate: Joi.date().required().messages({
            "date.base": "Start date must be a date",
            "any.required": "Start date is required",
        }),
        endDate: Joi.date().required().messages({
            "date.base": "End date must be a date",
            "any.required": "End date is required",
        }),
        estimatedCost: Joi.number().required().messages({
            "number.base": "Estimated cost must be a number",
            "any.required": "Estimated cost is required",
        }),
        actualCost: Joi.number().required().messages({
            "number.base": "Actual cost must be a number",
            "any.required": "Actual cost is required",
        }),
        teamMembers: Joi.array().items(Joi.string()).required().messages({
            "array.base": "Team members must be an array",
            "any.required": "Team members are required",
        }),
        status: Joi.string().valid('queued', 'inProgress', 'withClient', 'forApproval', 'completed', 'cancelled').required().messages({
            "string.base": "Status must be a string",
            "any.required": "Status is required",
        }),
        priority: Joi.string().valid('high', 'medium', 'low', 'urgent').required().messages({
            "string.base": "Priority must be a string",
            "any.required": "Priority is required",
        }),

    }),
};

export default {
    createJobValidation,
};