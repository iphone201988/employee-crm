import Joi from "joi";
const addClientValidation = {
    body: Joi.object({
        companyId: Joi.string().allow(null).optional(),
        clientRef: Joi.string().required().messages({
            "string.base": "Client ref must be a string",
            "any.required": "Client ref is required",
        }),
        name: Joi.string().required().messages({
            "string.base": "Client name must be a string",
            "any.required": "Client name is required",
        }),
        businessTypeId: Joi.string().required().messages({
            "string.base": "Business type ID must be a string",
            "any.required": "Business type ID is required",
        }),
        taxNumber: Joi.string().optional().allow('', null, 'N/A').messages({
            "string.base": "Tax number must be a string",
        }),
        croNumber: Joi.string().optional().messages({
            "string.base": "CRO number must be a string",
        }),
        croLink: Joi.string().optional().allow('', null).messages({
            "string.base": "CRO link must be a string",
        }),
        clientManagerId: Joi.string().optional().allow('', null).pattern(/^[0-9a-fA-F]{24}$/).messages({
            "string.base": "Client manager must be a string",
            "string.pattern.base": "Client manager must be a valid ID",
        }),
        address: Joi.string().required().messages({
            "string.base": "Address must be a string",
            "any.required": "Address is required",
        }),
        email: Joi.string().email().optional().allow('N/A', null).messages({
            "string.base": "Email must be a string",
            "string.email": "Invalid email format",
        }),
        emailNote: Joi.string().optional().messages({
            "string.base": "Email note must be a string",
        }),
        phone: Joi.string().required().messages({
            "string.base": "Phone must be a string",
            "any.required": "Phone is required",
        }),
        phoneNote: Joi.string().optional().allow("",null).messages({
            "string.base": "Phone note must be a string",
        }),
        onboardedDate: Joi.date().optional().allow(null).messages({
            "date.base": "Onboarded date must be a date",
        }),
        amlCompliant: Joi.boolean().optional().messages({
            "boolean.base": "AML compliant must be a boolean",
        }),
        audit: Joi.boolean().optional().messages({
            "boolean.base": "Audit must be a boolean",
        }),
        clientStatus: Joi.string().valid('Prospect', 'Current', 'Archived').optional().messages({
            "string.base": "Client status must be a string",
            "any.only": "Client status must be one of: Prospect, Current, Archived",
        }),
        yearEnd: Joi.string().optional().allow('', null).messages({
            "string.base": "Year end must be a string",
        }),
        arDate: Joi.date().optional().allow(null).messages({
            "date.base": "AR date must be a date",
        }),
    }),
};
const updateClientValidation = {
    params: Joi.object({
        clientId: Joi.string().required().messages({
            "string.base": "Client ID must be a string",
            "any.required": "Client ID is required",
        }),
    }),
    body: Joi.object({
        clientRef: Joi.string().optional().messages({
            "string.base": "Client ref must be a string",
        }),
        name: Joi.string().optional().messages({
            "string.base": "Client name must be a string",
        }),
        businessTypeId: Joi.string().optional().messages({
            "string.base": "Business type ID must be a string",
        }),
        taxNumber: Joi.string().optional().messages({
            "string.base": "Tax number must be a string",
        }),
        croNumber: Joi.string().optional().messages({
            "string.base": "CRO number must be a string",
        }),
        croLink: Joi.string().optional().allow('', null).messages({
            "string.base": "CRO link must be a string",
        }),
        clientManagerId: Joi.string().optional().allow('', null).pattern(/^[0-9a-fA-F]{24}$/).messages({
            "string.base": "Client manager must be a string",
            "string.pattern.base": "Client manager must be a valid ID",
        }),
        address: Joi.string().optional().messages({
            "string.base": "Address must be a string",
        }),
        email: Joi.string().email().optional().messages({
            "string.base": "Email must be a string",
            "string.email": "Invalid email format",
        }),
        emailNote: Joi.string().optional().messages({
            "string.base": "Email note must be a string",
        }),
        phone: Joi.string().optional().messages({
            "string.base": "Phone must be a string",
        }),
        phoneNote: Joi.string().optional().allow("",null).messages({
            "string.base": "Phone note must be a string",
        }),
        onboardedDate: Joi.date().optional().messages({
            "date.base": "Onboarded date must be a date",
        }),
        amlCompliant: Joi.boolean().optional().messages({
            "boolean.base": "AML compliant must be a boolean",
        }),
        audit: Joi.boolean().optional().messages({
            "boolean.base": "Audit must be a boolean",
        }),
        clientStatus: Joi.string().valid('Prospect', 'Current', 'Archived').optional().messages({
            "string.base": "Client status must be a string",
            "any.only": "Client status must be one of: Prospect, Current, Archived",
        }),
        yearEnd: Joi.string().optional().allow('', null).messages({
            "string.base": "Year end must be a string",
        }),
        arDate: Joi.date().optional().allow(null).messages({
            "date.base": "AR date must be a date",
        }),
    }),
};
const updateClientServiceValidation = {
    body: Joi.object({
       clientServices: Joi.array().items(Joi.object({
           clientId: Joi.string().required().messages({
               "string.base": "Client ID must be a string",
               "any.required": "Client ID is required",
           }),
           servicesTds: Joi.array().items(Joi.string()).required().messages({
               "array.base": "Services TDS must be an array",
               "any.required": "Services TDS is required",
           })
       })).messages({
           "array.base": "Client services must be an array",
       }),
       clientJobCategories: Joi.array().items(Joi.object({
           clientId: Joi.string().required().messages({
               "string.base": "Client ID must be a string",
               "any.required": "Client ID is required",
           }),
           jobCategoriesIds: Joi.array().items(Joi.string()).required().messages({
               "array.base": "Job categories IDs must be an array",
               "any.required": "Job categories IDs is required",
           })
       })).messages({
           "array.base": "Client job categories must be an array",
       })
    }),
};
const getClientByIdValidation = {
    params: Joi.object({
        clientId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required().messages({
            "string.base": "Client ID must be a string",
            "any.required": "Client ID is required",
            "string.pattern.base": "Client ID is not valid",
        }),
    }),
};

export default {addClientValidation, updateClientValidation, updateClientServiceValidation, getClientByIdValidation};