import { NextFunction, Request, Response } from "express";
import { SUCCESS } from "../utils/response";
import { ClientModel } from "../models/Client";



const addClient = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        await ClientModel.create(req.body);
        SUCCESS(res, 200, "Client added successfully", { data: {} });
    } catch (error) {
        console.log("error in addClient", error);
        next(error);
    }
};
const getClients = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        let { page = 1, limit = 10 } = req.query;
        page = parseInt(page as string);
        limit = parseInt(limit as string);
        const skip = (page - 1) * limit;
        const clients = await ClientModel.find({}).skip(skip).limit(limit);
        SUCCESS(res, 200, "Clients fetched successfully", { data: clients });
    } catch (error) {
        console.log("error in getClients", error);
        next(error);
    }
};
export default { addClient, getClients };