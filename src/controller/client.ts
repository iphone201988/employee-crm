import { NextFunction, Request, Response } from "express";
import { SUCCESS } from "../utils/response";
import { ClientModel } from "../models/Client";
import { BusinessCategoryModel } from "../models/BusinessCategory";



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
        let { page = 1, limit = 10, search = "", businessTypeId = "", } = req.query;
        page = parseInt(page as string);
        limit = parseInt(limit as string);
        const skip = (page - 1) * limit;
        const query: any = {};

        if (search) {
            query.$or = [
                { clientName: { $regex: search, $options: 'i' } },
                { contactName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { clientRef: { $regex: search, $options: 'i' } },
                { taxNumber: { $regex: search, $options: 'i' } }
            ];
        }

        // Filter by businessTypeId (ObjectId)
        if (businessTypeId) {
            query.businessTypeId = businessTypeId;
        }

        // Execute queries in parallel
        const [clients, totalClients, breakdown, businessTypes] = await Promise.all([
            ClientModel
                .find(query)
                .skip(skip)
                .limit(limit)
                .populate('businessTypeId')
                .select('-__v'),

            ClientModel.countDocuments(query),

            ClientModel.aggregate([
                {
                    $lookup: {
                        from: 'businesscategories',
                        localField: 'businessTypeId',
                        foreignField: '_id',
                        as: 'businessTypeInfo'
                    }
                },
                {
                    $unwind: '$businessTypeInfo'
                },
                {
                    $group: {
                        _id: '$businessTypeInfo.name',
                        count: { $sum: 1 }
                    }
                }
            ]),

            BusinessCategoryModel.find({}).select('name')
        ]);

        let breakdownData: any = { totalClients };

        businessTypes.forEach(bt => {
            console.log(bt);
            const key = bt.name.replace(/\s+/g, '').toLowerCase();
            breakdownData[key] = 0;
        });
        console.log(breakdown);
        breakdown.forEach(item => {
            console.log(item);
            const key = item._id.replace(/\s+/g, '').toLowerCase();
            breakdownData[key] = item.count;
        });
        breakdownData = Object.entries(breakdownData).map(([key, count]) => ({
            name: key,
            count
        }));

        const totalPages = Math.ceil(totalClients / limit);
        const pagination = {
            currentPage: page,
            totalPages,
            totalClients,
            limit
        }
        const response = {
            clients,
            pagination,
            breakdown: breakdownData,
        };

        SUCCESS(res, 200, "Clients fetched successfully", { data: response });
    } catch (error) {
        console.log("error in getClients", error);
        next(error);
    }
};
export default { addClient, getClients };