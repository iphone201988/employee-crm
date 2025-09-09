import Joi from "joi";
const addClientValidation = {
    body: Joi.object({
        clientRef: Joi.string().required().messages({
            "string.base": "Client ref must be a string",
            "any.required": "Client ref is required",
        }),
        clientName: Joi.string().required().messages({
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
        phoneNote: Joi.string().optional().messages({
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

export default {addClientValidation};