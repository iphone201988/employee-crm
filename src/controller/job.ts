import { NextFunction, Request, Response } from "express";

import { BadRequestError } from "../utils/errors";
import { SUCCESS } from "../utils/response";
import { JobModel } from "../models/Job";

export const addJob = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        await JobModel.create(req.body);
        SUCCESS(res, 200, "Job added successfully", { data: {} });
    } catch (error) {
        console.log("error in addJob", error);
        next(error);
    }
};