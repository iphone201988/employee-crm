import { NextFunction, Request, Response } from "express";
import { SUCCESS } from "../utils/response";
import { ClientModel } from "../models/Client";
import { BusinessCategoryModel } from "../models/BusinessCategory";
import { ServicesCategoryModel } from "../models/ServicesCategory";
import { BadRequestError } from "../utils/errors";
import { ObjectId } from "../utils/utills";



const addClient = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        await ClientModel.create(req.body);
        SUCCESS(res, 200, "Client added successfully", { data: {} });
    } catch (error) {
        console.log("error in addClient", error);
        next(error);
    }
};
const updateClient = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { clientId } = req.params;
        await ClientModel.findByIdAndUpdate(clientId, req.body, { new: true });
        SUCCESS(res, 200, "Client updated successfully", { data: {} });
    } catch (error) {
        console.log("error in updateClient", error);
        next(error);
    }
}
const getClients = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        let { page = 1, limit = 10, search = "", businessTypeId = "", } = req.query;
        page = parseInt(page as string);
        limit = parseInt(limit as string);
        const skip = (page - 1) * limit;
        const query: any = {};

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
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
const getClientById = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { clientId } = req.params;
        const [client] = await ClientModel.aggregate([
            {
                $match: { _id: ObjectId(clientId) }
            },
            {
                $lookup: {
                    from: 'businesscategories',
                    localField: 'businessTypeId',
                    foreignField: '_id',
                    as: 'businessTypeId'
                }
            }            
        ])
        SUCCESS(res, 200, "Client fetched successfully", { data: client });
    } catch (error) {
        console.log("error in getClientById", error);
        next(error);
    }
}
const getClientServices = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        // Extract and parse query parameters
        let { page = 1, limit = 10, search = "", businessTypeId = "" } = req.query;
        page = parseInt(page as string);
        limit = parseInt(limit as string);
        const skip = (page - 1) * limit;

        // Build search query
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

        // Get all available services
        const allServices = await ServicesCategoryModel.find({}, 'name _id').lean();
        const selectedServices = allServices.map(s => s._id);

        // Build dynamic projection with service toggles
        const projection: any = {
            clientRef: 1,
            name: 1,
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

        // Add dynamic service toggle fields
        selectedServices.forEach((service: any) => {
            projection[service.toString()] = {
                $in: [service, '$serviceDetails._id']
            };
        });

        // Also add service name-based toggles for easier frontend usage
        allServices.forEach(service => {
            const fieldName = service.name.toLowerCase().replace(/\s+/g, '');
            projection[fieldName] = {
                $in: [service.name, '$serviceDetails.name']
            };
        });

        // Execute aggregation with facet for multiple operations
        const [result] = await ClientModel.aggregate([
            {
                $facet: {
                    // Get total count for pagination
                    total: [
                        { $match: query }, 
                        { $count: "count" }
                    ],
                    
                    // Get paginated client data
                    data: [
                        { $match: query },
                        { $sort: { clientName: 1 } },
                        { $skip: skip },
                        { $limit: limit },
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
                        }
                    ],
                    
                    // Service counts for filtered/searched clients
                    filteredServiceCounts: [
                        { $match: query },
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
                    ],
                    
                    // Global service counts for all clients (for UI breakdown cards)
                    globalServiceCounts: [
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
                    ]
                }
            }
        ]).allowDiskUse(true).exec();

        // Extract results from aggregation
        const clients = result.data;
        const totalClients = result.total[0]?.count || 0;
        const filteredServiceCounts = result.filteredServiceCounts;
        const globalServiceCounts = result.globalServiceCounts;

        // Create maps for efficient lookup
        const filteredCountsMap = new Map();
        filteredServiceCounts.forEach((s: any) => {
            filteredCountsMap.set(s.serviceId.toString(), s.count);
        });

        const globalCountsMap = new Map();
        globalServiceCounts.forEach((s: any) => {
            globalCountsMap.set(s.serviceId.toString(), s.count);
        });

        // Merge with all services to include zero counts
        const completeFilteredCounts = allServices.map(service => ({
            serviceId: service._id,
            serviceName: service.name,
            count: filteredCountsMap.get(service._id.toString()) || 0
        }));

        const completeGlobalCounts = allServices.map(service => ({
            serviceId: service._id,
            serviceName: service.name,
            count: globalCountsMap.get(service._id.toString()) || 0
        }));

        // Calculate pagination
        const totalPages = Math.ceil(totalClients / limit);
        const pagination = {
            currentPage: page,
            totalPages,
            totalClients,
            limit,
        };

        // Send response
        SUCCESS(res, 200, "Clients fetched successfully", {
            data: clients,
            pagination,
            breakdown: completeGlobalCounts, 
            filteredCounts: completeFilteredCounts, 
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

export default { addClient, updateClient, getClients, getClientServices, updateClientService ,getClientById};