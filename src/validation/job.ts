import Joi from "joi";
const createJobValidation = {
    body: Joi.object({
        companyId: Joi.string().allow(null).optional(),
        name: Joi.string().required().messages({
            "string.base": "name must be a string",
            "any.required": "Name is required",
        }),
        description: Joi.string().allow('').optional().messages({
            "string.base": "Description must be a string",
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
        jobCost: Joi.number().min(0).required().messages({
            "number.base": "Job fee must be a number",
            "number.min": "Job fee must be 0 or greater",
            "any.required": "Job fee is required",
        }),
        teamMembers: Joi.array().items(Joi.string()).min(1).required().messages({
            "array.base": "Team members must be an array",
            "array.min": "At least one team member is required",
            "any.required": "Team members are required",
        }),
        status: Joi.string().valid('queued', 'awaitingRecords', 'inProgress', 'withClient', 'forApproval', 'completed').required().messages({
            "string.base": "Status must be a string",
            "any.required": "Status is required",
        }),
        priority: Joi.string().valid('high', 'medium', 'low', 'urgent').required().messages({
            "string.base": "Priority must be a string",
            "any.required": "Priority is required",
        }),

    }),
};
const updateJobValidation = {
    params: Joi.object({
        jobId: Joi.string().required().messages({
            "string.base": "Job ID must be a string",
            "any.required": "Job ID is required",
        }),
    }),
    body: Joi.object({
        name: Joi.string().optional(),
        description: Joi.string().allow('', null).optional(),
        clientId: Joi.string().optional(),
        jobTypeId: Joi.string().optional(),
        jobManagerId: Joi.string().optional(),
        startDate: Joi.date().optional(),
        endDate: Joi.date().optional(),
        jobCost: Joi.number().optional(),
        teamMembers: Joi.array().items(Joi.string()).optional(),
        status: Joi.string().valid('queued', 'awaitingRecords', 'inProgress', 'withClient', 'forApproval', 'completed').optional(),
        priority: Joi.string().valid('high', 'medium', 'low', 'urgent').optional(),
    }),
};
const getJobByIdValidation = {
    params: Joi.object({
        jobId: Joi.string().required().messages({
            "string.base": "Job ID must be a string",
            "any.required": "Job ID is required",
        }),
    }),
};

export default {
    createJobValidation,
    updateJobValidation,
    getJobByIdValidation
};