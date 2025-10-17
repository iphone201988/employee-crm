import Joi from "joi";

const addCategoryValidation = {
    body: Joi.object({
        name: Joi.string().optional().messages({
            "string.base": "Name must be a string",
        }),
        amount: Joi.number().optional().messages({
            "number.base": "Amount must be a number",
        }),
        type: Joi.string().required().messages({
            "string.base": "Type must be a string",
            "any.required": "Type is required",
        }),
    }),
};
const deleteCategoryValidation = {
    body: Joi.object({
        id: Joi.string().required().messages({
            "string.base": "ID must be a string",
            "any.required": "ID is required",
        }),
        type: Joi.string().required().messages({
            "string.base": "Type must be a string",
            "any.required": "Type is required",
        }),
    }),
};

export default {
    addCategoryValidation,
    deleteCategoryValidation
  
};