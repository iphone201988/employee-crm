import { NextFunction, Request, Response } from "express";
import { SUCCESS } from "../utils/response";
import { ClientModel } from "../models/Client";
import { BusinessCategoryModel } from "../models/BusinessCategory";
import { ServicesCategoryModel } from "../models/ServicesCategory";
import { BadRequestError } from "../utils/errors";



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
                { clientRef: { $regex: search, $options: 'i' } },
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
const getClientServices = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        // Get all services with name and _id
        let { page = 1, limit = 10, search = "", businessTypeId = "", } = req.query;
        page = parseInt(page as string);
        limit = parseInt(limit as string);
        const skip = (page - 1) * limit;
        const query: any = {};
        if (search) {
            query.$or = [
                { clientName: { $regex: search, $options: 'i' } },
                { clientRef: { $regex: search, $options: 'i' } },
            ];
        }
        if (businessTypeId) {
            query.businessTypeId = businessTypeId;
        }
        const allServices = await ServicesCategoryModel.find({}, 'name _id').lean();
        const selectedServices = allServices.map(s => s._id);

        // Build dynamic projection
        const projection: any = {
            clientRef: 1,
            clientName: 1,
            businessTypeId: 1,
            businessType: { $arrayElemAt: ['$businessType.name', 0] },
            serviceDetails: {
                $map: {
                    input: '$serviceDetails',
                    as: 'service',
                    in: {
                        _id: '$$service._id',
                        name: '$$service.name'
                    }
                }
            }
        };

        selectedServices.forEach((service:any) => {
            // const fieldName = service;
            projection[service] = {
                $in: [service, '$serviceDetails._id']
            };
        });

        const clients = await ClientModel.aggregate([
            { $match: query },
            {
                $lookup: {
                    from: 'businesscategories',
                    localField: 'businessTypeId',
                    foreignField: '_id',
                    as: 'businessType'
                }
            },
            {
                $lookup: {
                    from: 'servicescategories',
                    localField: 'services',
                    foreignField: '_id',
                    as: 'serviceDetails'
                }
            },
            {
                $project: projection
            },
            { $sort: { clientRef: 1 } }
        ]);

        // Get actual service counts (only for assigned services)
        const assignedServiceCounts = await ClientModel.aggregate([
            { $unwind: '$services' },
            {
                $group: {
                    _id: '$services',
                    count: { $sum: 1 }
                }
            },
            {
                $lookup: {
                    from: 'servicescategories',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'serviceInfo'
                }
            },
            { $unwind: '$serviceInfo' },
            {
                $project: {
                    serviceId: '$_id',
                    serviceName: '$serviceInfo.name',
                    count: 1,
                    _id: 0
                }
            },
            { $sort: { count: -1 } }
        ]);

        // Create a map of assigned service counts
        const countsMap = new Map();
        assignedServiceCounts.forEach(s => {
            countsMap.set(s.serviceId.toString(), s.count);
        });

        // Merge with all services to include zero counts
        const completeServiceCounts = allServices.map(service => ({
            serviceId: service._id,
            serviceName: service.name,
            count: countsMap.get(service._id.toString()) || 0
        }));

        const totalPages = Math.ceil(clients.length / limit);
        const pagination = {
            currentPage: page,
            totalPages,
            totalClients: clients.length,
            limit
        }

        SUCCESS(res, 200, "Clients fetched successfully", {
            data: clients,
            pagination,
            breakdown: completeServiceCounts
        });
    } catch (error) {
        console.log("error in getClientServices", error);
        next(error);
    }
};
const updateClientService = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { clientServices } = req.body;
        for (const service of clientServices) {
            const { clientId, servicesTds } = service;
            await ClientModel.findByIdAndUpdate(clientId, { services: servicesTds }, { new: true });

        }
        SUCCESS(res, 200, "Client updated successfully", {});
    } catch (error) {
        console.log("error in updateClientService", error);
        next(error);
    }
};

export default { addClient, getClients, getClientServices, updateClientService };