import Joi, { allow } from "joi";



const loginValidation = {
  body: Joi.object({
     email: Joi.string().email().required().messages({
      "string.base": "Email must be a string",
      "string.email": "Invalid email format",
      "any.required": "Email is required",
    }),
    password: Joi.string().required().messages({
      "string.base": "Password must be a string",
      "any.required": "Password is required",
    }),
    deviceType: Joi.number().optional().messages({
      "number.base": "Device type must be a number",
    }),
    deviceToken: Joi.string().optional().messages({
      "string.base": "Device token must be a string",
    }),
  }),
};


export default {
  loginValidation,
  
};
