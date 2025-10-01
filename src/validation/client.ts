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
        taxNumber: Joi.string().required().messages({
            "string.base": "Tax number must be a string",
            "any.required": "Tax number is required",
        }),
        croNumber: Joi.string().optional().messages({
            "string.base": "CRO number must be a string",
        }),
        address: Joi.string().required().messages({
            "string.base": "Address must be a string",
            "any.required": "Address is required",
        }),
        contactName: Joi.string().required().messages({
            "string.base": "Contact name must be a string",
            "any.required": "Contact name is required",
        }),
        email: Joi.string().email().required().messages({
            "string.base": "Email must be a string",
            "string.email": "Invalid email format",
            "any.required": "Email is required",
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
        onboardedDate: Joi.date().required().messages({
            "date.base": "Onboarded date must be a date",
            "any.required": "Onboarded date is required",
        }),
        amlCompliant: Joi.boolean().optional().messages({
            "boolean.base": "AML compliant must be a boolean",
        }),
        audit: Joi.boolean().optional().messages({
            "boolean.base": "Audit must be a boolean",
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
        address: Joi.string().optional().messages({
            "string.base": "Address must be a string",
        }),
        contactName: Joi.string().optional().messages({
            "string.base": "Contact name must be a string",
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