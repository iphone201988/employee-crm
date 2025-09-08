import { Response, NextFunction, Request } from "express";
import Joi from "joi";
import { ValidationError } from "../utils/errors";

export const validate = (schema: Record<string, Joi.Schema>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
  Object.entries(schema).map(([key, joiSchema]) => {
        console.log(req[key as keyof Request]);
      const { error } = joiSchema.validate(req[key as keyof Request], { abortEarly: true, allowUnknown: false, });
      if (error) {
        return next(new ValidationError(error.message.replace(/"/g, "")));
      }
    });
    next();
  };
};
