import { NextFunction, Request, Response } from "express";
import { SUCCESS } from "../utils/response";
import { ClientModel } from "../models/Client";
import { BusinessCategoryModel } from "../models/BusinessCategory";
import { ServicesCategoryModel } from "../models/ServicesCategory";
import { BadRequestError } from "../utils/errors";
import { ObjectId } from "../utils/utills";
import { JobCategoryModel } from "../models/JobCategory";
import { TimeLogModel } from "../models/TImeLog";
import { JobModel } from "../models/Job";
import { ExpensesModel } from "../models/Expenses";
import { UserModel } from "../models/User";
import job from "./job";
import { InvoiceModel } from "../models/Invoice";
import { InvoiceLogModel } from "../models/InvoiceLog";

/**
 * Parse date consistently to avoid timezone shifts
 * Handles:
 * - Excel serial date numbers (e.g., 44927)
 * - Date objects (from XLSX library)
 * - DD/MM/YYYY format strings (for Excel imports)
 * - ISO date strings (for manual creation)
 * Returns UTC date at midnight to ensure date doesn't change
 */
const parseDateSafely = (dateValue: any): Date | undefined => {
    // Handle null, undefined, empty values, and 0 (which Excel might return for empty cells)
    // Also handle falsy values and empty strings/whitespace
    if (dateValue === null || 
        dateValue === undefined || 
        dateValue === '' || 
        dateValue === 0 || 
        dateValue === '0' ||
        (typeof dateValue === 'string' && dateValue.trim() === '') ||
        (typeof dateValue === 'string' && dateValue.trim().toLowerCase() === 'null') ||
        (typeof dateValue === 'string' && dateValue.trim().toLowerCase() === 'undefined') ||
        (typeof dateValue === 'string' && dateValue.trim().toLowerCase() === 'nan') ||
        (typeof dateValue === 'string' && dateValue.trim() === '-') ||
        (typeof dateValue === 'string' && dateValue.trim() === 'N/A') ||
        (typeof dateValue === 'string' && dateValue.trim() === 'n/a')) {
        return undefined;
    }

    // Handle Date objects (from XLSX library when it converts dates)
    if (dateValue instanceof Date) {
        if (isNaN(dateValue.getTime())) {
            return undefined; // Invalid date
        }
        // Extract year, month, day first to check validity
        const year = dateValue.getFullYear();
        const month = dateValue.getMonth();
        const day = dateValue.getDate();
        
        // Validate it's a reasonable date (not 1970 from invalid parsing)
        // Also reject dates that are exactly 1970-01-01 as it's likely from invalid parsing
        // Reject any date from 1970 as it's likely from empty/invalid parsing
        if (year < 1900 || year > 2100 || year === 1970) {
            return undefined; // Reject dates outside reasonable range or epoch year
        }
        
        return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
    }

    // Handle numbers (Excel serial date numbers)
    // Excel serial date: days since January 1, 1900
    // Excel incorrectly treats 1900 as a leap year
    if (typeof dateValue === 'number') {
        // Check if it's a reasonable Excel serial date (between 1 and ~100000)
        // Dates before 1900 or after 2174 would be outside this range
        // Also reject 0 or negative numbers, and very small numbers that might be timestamps
        // Excel serial date 1 = 1900-01-01, so we need at least 1
        if (dateValue > 0 && dateValue < 100000 && dateValue >= 1) {
            // Convert Excel serial date to JavaScript date
            // Excel epoch is 1900-01-01, but Excel treats 1900 as leap year
            // Standard conversion: (excelSerial - 25569) * 86400000
            // But accounting for Excel's bug: use Dec 30, 1899 as base
            const excelEpoch = new Date(Date.UTC(1899, 11, 30)); // Dec 30, 1899 (day 0 in Excel)
            const jsDate = new Date(excelEpoch.getTime() + (dateValue - 1) * 86400000);
            
            if (!isNaN(jsDate.getTime())) {
                const year = jsDate.getUTCFullYear();
                const month = jsDate.getUTCMonth();
                const day = jsDate.getUTCDate();
                
                // Explicitly reject 1970-01-01 as it's likely from invalid conversion
                if (year === 1970 && month === 0 && day === 1) {
                    return undefined;
                }
                
                // Validate it's a reasonable date (not 1970 from invalid conversion)
                if (year >= 1900 && year <= 2100) {
                    // Extract year, month, day and create UTC date at midnight
                    return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
                }
            }
        }
        // If it's a very large number, it might be a timestamp in milliseconds
        // But we'll skip this to avoid confusion with Excel serial dates
        return undefined;
    }

    // Handle strings
    const dateStr = dateValue.toString().trim();
    if (!dateStr || dateStr === '' || dateStr === 'null' || dateStr === 'undefined' || dateStr === 'NaN' || dateStr === '0') {
        return undefined;
    }

    // Try DD/MM/YYYY format first (for Excel imports as strings)
    const ddmmyyyyMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (ddmmyyyyMatch) {
        const day = parseInt(ddmmyyyyMatch[1], 10);
        const month = parseInt(ddmmyyyyMatch[2], 10) - 1; // Month is 0-indexed
        const year = parseInt(ddmmyyyyMatch[3], 10);
        
        // Validate day and month ranges
        if (day < 1 || day > 31 || month < 0 || month > 11) {
            return undefined;
        }
        
        // Create UTC date at midnight to avoid timezone shifts
        const parsedDate = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
        
        // Validate the date (check if it's a valid date and matches input)
        if (!isNaN(parsedDate.getTime()) && 
            parsedDate.getUTCDate() === day && 
            parsedDate.getUTCMonth() === month && 
            parsedDate.getUTCFullYear() === year) {
            return parsedDate;
        }
    }

    // Try parsing as ISO date string or standard Date format
    const parsedDate = new Date(dateStr);
    if (!isNaN(parsedDate.getTime())) {
        // Check if it's a reasonable date (not epoch 1970-01-01 from invalid parsing)
        const year = parsedDate.getFullYear();
        const month = parsedDate.getMonth();
        const day = parsedDate.getDate();
        
        // Explicitly reject 1970-01-01 as it's likely from invalid parsing
        if (year === 1970 && month === 0 && day === 1) {
            return undefined;
        }
        
        if (year >= 1900 && year <= 2100) {
            // Convert to UTC at midnight to avoid timezone shifts
            const utcYear = parsedDate.getUTCFullYear();
            const utcMonth = parsedDate.getUTCMonth();
            const utcDay = parsedDate.getUTCDate();
            
            // Double-check the UTC date is not 1970-01-01
            if (utcYear === 1970 && utcMonth === 0 && utcDay === 1) {
                return undefined;
            }
            
            return new Date(Date.UTC(utcYear, utcMonth, utcDay, 0, 0, 0, 0));
        }
    }

    return undefined;
};

const addClient = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        if (req.user.role !== "superAdmin") {
            req.body.companyId = req.user.companyId;
        }
        
        // Parse dates consistently to avoid timezone shifts
        const clientData: any = { ...req.body };
        if (clientData.onboardedDate !== undefined && clientData.onboardedDate !== null) {
            const parsedDate = parseDateSafely(clientData.onboardedDate);
            if (parsedDate !== undefined) {
                clientData.onboardedDate = parsedDate;
            } else {
                delete clientData.onboardedDate; // Remove if invalid
            }
        }
        if (clientData.arDate !== undefined && clientData.arDate !== null) {
            const parsedDate = parseDateSafely(clientData.arDate);
            if (parsedDate !== undefined) {
                clientData.arDate = parsedDate;
            } else {
                delete clientData.arDate; // Remove if invalid
            }
        }
        
        await ClientModel.create(clientData);
        SUCCESS(res, 200, "Client added successfully", { data: {} });
    } catch (error) {
        console.log("error in addClient", error);
        next(error);
    }
};
const updateClient = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { clientId } = req.params;
        
        // Parse dates consistently to avoid timezone shifts
        const clientData: any = { ...req.body };
        if (clientData.onboardedDate !== undefined && clientData.onboardedDate !== null) {
            const parsedDate = parseDateSafely(clientData.onboardedDate);
            if (parsedDate !== undefined) {
                clientData.onboardedDate = parsedDate;
            } else {
                // If date is invalid, set to null to clear it
                clientData.onboardedDate = null;
            }
        }
        if (clientData.arDate !== undefined && clientData.arDate !== null) {
            const parsedDate = parseDateSafely(clientData.arDate);
            if (parsedDate !== undefined) {
                clientData.arDate = parsedDate;
            } else {
                // If date is invalid, set to null to clear it
                clientData.arDate = null;
            }
        }
        
        await ClientModel.findByIdAndUpdate(clientId, clientData, { new: true });
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
        const parseArrayParam = (value: any): string[] => {
            if (!value) return [];
            if (Array.isArray(value)) {
                return value.map((item) => String(item).trim()).filter(Boolean);
            }
            if (typeof value === 'string') {
                return value.split(',').map(item => item.trim()).filter(Boolean);
            }
            return [];
        };
        const isValidObjectId = (value: string) => /^[0-9a-fA-F]{24}$/.test(value);

        const query: any = { status: "active" };
        if (req.user.role !== "superAdmin") {
            query.companyId = req.user.companyId;
        }

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { clientRef: { $regex: search, $options: 'i' } },
            ];
        }

        const businessTypeIdsParam = parseArrayParam(req.query.businessTypeIds);
        if (businessTypeId && typeof businessTypeId === 'string' && businessTypeId.trim()) {
            businessTypeIdsParam.push(businessTypeId as string);
        }
        const businessTypeObjectIds = businessTypeIdsParam
            .filter(isValidObjectId)
            .map((id) => ObjectId(id));
        if (businessTypeObjectIds.length === 1) {
            query.businessTypeId = businessTypeObjectIds[0];
        } else if (businessTypeObjectIds.length > 1) {
            query.businessTypeId = { $in: businessTypeObjectIds };
        }

        const statusesFilter = parseArrayParam(req.query.statuses);
        if (statusesFilter.length === 1) {
            query.clientStatus = statusesFilter[0];
        } else if (statusesFilter.length > 1) {
            query.clientStatus = { $in: statusesFilter };
        }

        const auditSelections = parseArrayParam(req.query.audit).map(value => value.toLowerCase());
        const auditValues: boolean[] = [];
        if (auditSelections.includes('yes')) auditValues.push(true);
        if (auditSelections.includes('no')) auditValues.push(false);
        if (auditValues.length === 1) {
            query.audit = auditValues[0];
        }

        const amlSelections = parseArrayParam(req.query.aml).map(value => value.toLowerCase());
        const amlValues: boolean[] = [];
        if (amlSelections.includes('yes')) amlValues.push(true);
        if (amlSelections.includes('no')) amlValues.push(false);
        if (amlValues.length === 1) {
            query.amlCompliant = amlValues[0];
        }

        const yearEndsFilter = parseArrayParam(req.query.yearEnds);
        if (yearEndsFilter.length === 1) {
            query.yearEnd = yearEndsFilter[0];
        } else if (yearEndsFilter.length > 1) {
            query.yearEnd = { $in: yearEndsFilter };
        }

        // Execute queries in parallel
        // Reuse the query filters for the breakdown aggregation (shallow copy to avoid mutation)
        const breakdownMatchQuery = { ...query };

        const [clientsDocs, totalClients, breakdown, businessTypes] = await Promise.all([
            ClientModel
                .find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('businessTypeId')
                .populate({
                    path: 'clientManagerId',
                    select: 'name',
                })
                .select('-__v'),

            ClientModel.countDocuments(query),

            ClientModel.aggregate([
                { $match: breakdownMatchQuery },
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
        const normalizedClients = clientsDocs.map((client: any) => {
            const clientObj = client.toObject();
            const managerData = clientObj.clientManagerId;
            let managerName = '';
            let managerId: string | null = null;

            if (managerData && typeof managerData === 'object' && managerData !== null) {
                managerName = managerData.name || '';
                managerId = managerData._id ? String(managerData._id) : null;
            } else if (typeof managerData === 'string') {
                managerId = managerData;
            }

            return {
                ...clientObj,
            clientManagerId: managerId || '',
                clientManager: managerName,
            };
        });

        const response = {
            clients: normalizedClients,
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
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'clientManagerId',
                    foreignField: '_id',
                    as: 'clientManagerData'
                }
            },
            {
                $unwind: {
                    path: '$clientManagerData',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $lookup: {
                    from: 'timelogs',
                    localField: '_id',
                    foreignField: 'clientId',
                    as: 'timeLogs',
                    pipeline: [
                        {
                            $lookup: {
                                from: "users",
                                localField: "userId",
                                foreignField: "_id",
                                as: "user",
                                pipeline: [{ $project: { _id: 1, name: 1, avatarUrl: 1 } }]
                            }
                        },
                        { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
                        {
                            $lookup: {
                                from: "timecategories",
                                localField: "timeCategoryId",
                                foreignField: "_id",
                                as: "timeLogCategory",
                                pipeline: [{ $project: { _id: 1, name: 1 } }]
                            }
                        }, {
                            $unwind: { path: "$timeLogCategory", preserveNullAndEmptyArrays: true }
                        },
                        {
                            $lookup: {
                                from: "clients",
                                localField: "clientId",
                                foreignField: "_id",
                                as: "client",
                                pipeline: [{ $project: { _id: 1, name: 1, clientRef: 1 } }]
                            }
                        },
                        { $unwind: { path: "$client", preserveNullAndEmptyArrays: true } },
                        {
                            $lookup: {
                                from: "jobs",
                                localField: "jobId",
                                foreignField: "_id",
                                as: "job",
                                pipeline: [{ $project: { _id: 1, name: 1 } }]
                            }
                        },
                        { $unwind: { path: "$job", preserveNullAndEmptyArrays: true } },
                        {
                            $lookup: {
                                from: "jobcategories",
                                localField: "jobTypeId",
                                foreignField: "_id",
                                as: "jobCategory",
                                pipeline: [{ $project: { _id: 1, name: 1 } }]
                            }
                        },
                        { $unwind: { path: "$jobCategory", preserveNullAndEmptyArrays: true } },
                        {
                            $project: {
                                _id: 1,
                                date: 1,
                                // clientId: 1,
                                // timeCategoryId: 1,
                                // jobId: 1,
                                // userId: 1,
                                // jobTypeId: 1,
                                client: 1,
                                timeLogCategory: 1,
                                user: 1,
                                job: 1,
                                jobCategory: 1,
                                status: 1,
                                duration: 1,
                                amount: 1,
                                rate: 1,
                                description: 1,
                                billable: 1

                            }
                        }
                    ]
                }
            },
            {
                $lookup: {
                    from: 'jobs',
                    localField: '_id',
                    foreignField: 'clientId',
                    as: 'jobs',
                    pipeline: [
                        {
                            $lookup: {
                                from: "timelogs",
                                localField: "_id",
                                foreignField: "jobId",
                                as: "timeLogs",
                                pipeline: [{
                                    $lookup: {
                                        from: "timecategories",
                                        localField: "timeCategoryId",
                                        foreignField: "_id",
                                        as: "timeLogCategory",
                                        pipeline: [{ $project: { _id: 1, name: 1 } }]
                                    }
                                }, {
                                    $unwind: {
                                        path: "$timeLogCategory", preserveNullAndEmptyArrays: true
                                    },
                                },
                                {
                                    $lookup: {
                                        from: "users",
                                        localField: "userId",
                                        foreignField: "_id",
                                        as: "user",
                                        pipeline: [{ $project: { _id: 1, name: 1, avatarUrl: 1 } }]
                                    }
                                },
                                { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
                                {
                                    $project: {
                                        user: 1,
                                        timeLogCategory: 1,
                                        duration: 1,
                                        amount: 1,
                                        rate: 1,
                                        status: 1
                                    }
                                }
                                ]
                            }
                        },
                        {
                            $addFields: {
                                totalTimeLogHours: { $sum: "$timeLogs.duration" },
                                amount: { $sum: "$timeLogs.amount" }
                            }
                        }
                    ]
                }
            },
            {
                $lookup:{
                    from: 'expenses',
                    localField: '_id',
                    foreignField: 'clientId',
                    as: 'expenses',
                    pipeline: [
                        {
                            $project: {
                                _id: 1,
                                totalAmount: 1,
                                date: 1,
                                description: 1,
                                expreseCategory: 1,
                                status: 1
                            }
                        }
                    ]
                }
            },
            {
                $lookup: {
                    from: 'writeoffs',
                    let: { clientId: '$_id', companyId: ObjectId(req.user.companyId) },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ['$companyId', '$$companyId'] }
                            }
                        },
                        { $unwind: '$timeLogs' },
                        {
                            $match: {
                                $expr: { $eq: ['$timeLogs.clientId', '$$clientId'] }
                            }
                        },
                        {
                            $lookup: {
                                from: 'jobs',
                                localField: 'timeLogs.jobId',
                                foreignField: '_id',
                                as: 'jobDetails',
                                pipeline: [{ $project: { _id: 1, name: 1 } }]
                            }
                        },
                        { $unwind: { path: '$jobDetails', preserveNullAndEmptyArrays: true } },
                        {
                            $lookup: {
                                from: 'users',
                                localField: 'performedBy',
                                foreignField: '_id',
                                as: 'performedByDetails',
                                pipeline: [{ $project: { _id: 1, name: 1 } }]
                            }
                        },
                        { $unwind: { path: '$performedByDetails', preserveNullAndEmptyArrays: true } },
                        // First group by write-off document ID and jobId to identify unique occasions per job
                        {
                            $group: {
                                _id: {
                                    writeOffId: '$_id',
                                    jobId: '$timeLogs.jobId'
                                },
                                writeOffId: { $first: '$_id' },
                                jobId: { $first: '$timeLogs.jobId' },
                                jobName: { $first: '$jobDetails.name' },
                                writeOffAmount: { $sum: '$timeLogs.writeOffAmount' },
                                createdAt: { $first: '$createdAt' },
                                reason: { $first: '$reason' },
                                logic: { $first: '$logic' },
                                by: { $first: '$performedByDetails.name' }
                            }
                        },
                        // Then group by jobId to aggregate occasions and amounts
                        {
                            $group: {
                                _id: '$jobId',
                                jobId: { $first: '$jobId' },
                                jobName: { $first: '$jobName' },
                                writeOffOccasions: { $sum: 1 },
                                totalWriteOffAmount: { $sum: '$writeOffAmount' },
                                occasionDetails: {
                                    $push: {
                                        writeOffId: { $toString: { $ifNull: ['$writeOffId', ''] } },
                                        amount: '$writeOffAmount',
                                        date: { $ifNull: ['$createdAt', null] },
                                        reason: { $ifNull: ['$reason', ''] },
                                        logic: { $ifNull: ['$logic', ''] },
                                        by: { $ifNull: ['$by', 'N/A'] }
                                    }
                                }
                            }
                        }
                    ],
                    as: 'writeOffLogs'
                }
            },
            // Lookup notes for this client
            {
                $lookup: {
                    from: 'notes',
                    let: { clientId: '$_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ['$clientId', '$$clientId'] }
                            }
                        },
                        {
                            $lookup: {
                                from: 'users',
                                localField: 'createdBy',
                                foreignField: '_id',
                                as: 'createdBy',
                                pipeline: [{ $project: { _id: 1, name: 1, avatarUrl: 1 } }]
                            }
                        },
                        { $unwind: { path: '$createdBy', preserveNullAndEmptyArrays: true } },
                        {
                            $project: {
                                _id: 1,
                                note: 1,
                                createdAt: 1,
                                updatedAt: 1,
                                createdBy: 1
                            }
                        },
                        { $sort: { createdAt: -1 } }
                    ],
                    as: 'notes'
                }
            }

        ]);

        if (!client) {
            return SUCCESS(res, 200, "Client fetched successfully", { data: null });
        }

        const managerData: any = client.clientManagerData || null;
        let managerId: string | null = null;
        let managerName = '';

        if (managerData && typeof managerData === 'object') {
            managerId = managerData._id ? String(managerData._id) : null;
            managerName = managerData.name || '';
        } else if (client.clientManagerId) {
            managerId = String(client.clientManagerId);
        }

        const normalizedClient = {
            ...client,
            clientManagerId: managerId || '',
            clientManager: managerName,
        };
        delete (normalizedClient as any).clientManagerData;

        SUCCESS(res, 200, "Client fetched successfully", { data: normalizedClient, });
    } catch (error) {
        console.log("error in getClientById", error);
        next(error);
    }
}
const deleteClient = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { clientId } = req.params;
        await ClientModel.findByIdAndUpdate(clientId, { status: "inActive" }, { new: true });
        SUCCESS(res, 200, "Client deleted successfully", { data: {} });
    } catch (error) {
        console.log("error in deleteClient", error);
        next(error);
    }
};
const getClientServices = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        // Extract and parse query parameters
        let { page = 1, limit = 10, search = "", businessTypeId = "" } = req.query;
        page = parseInt(page as string);
        limit = parseInt(limit as string);
        const skip = (page - 1) * limit;
        const companyId = req.user.companyId;
        const parseArrayParam = (value: any): string[] => {
            if (!value) return [];
            if (Array.isArray(value)) {
                return value.map((item) => String(item).trim()).filter(Boolean);
            }
            if (typeof value === 'string') {
                return value.split(',').map(item => item.trim()).filter(Boolean);
            }
            return [];
        };
        const isValidObjectId = (value: string) => /^[0-9a-fA-F]{24}$/.test(value);
        // Build search query
        const query: any = { status: "active", companyId };
        if (search) {
            query.$or = [
                { clientName: { $regex: search, $options: 'i' } },
                { clientRef: { $regex: search, $options: 'i' } },
            ];
        }
        const businessTypeIdsParam = parseArrayParam(req.query.businessTypeIds);
        if (businessTypeId && typeof businessTypeId === 'string' && businessTypeId.trim()) {
            businessTypeIdsParam.push(businessTypeId as string);
        }
        const businessTypeObjectIds = businessTypeIdsParam
            .filter(isValidObjectId)
            .map((id) => ObjectId(id));
        if (businessTypeObjectIds.length === 1) {
            query.businessTypeId = businessTypeObjectIds[0];
        } else if (businessTypeObjectIds.length > 1) {
            query.businessTypeId = { $in: businessTypeObjectIds };
        }

        // Get all available job categories
        const allJobCategories = await JobCategoryModel.find({ companyId }, 'name _id').lean();
        const selectedJobCategories = allJobCategories.map(s => s._id);

        // Build dynamic projection with job category toggles
        const projection: any = {
            clientRef: 1,
            name: 1,
            businessTypeId: 1,
            businessType: { $arrayElemAt: ['$businessType.name', 0] },
            jobCategories: {
                $map: {
                    input: '$jobCategories',
                    as: 'job',
                    in: {
                        _id: '$$job._id',
                        name: '$$job.name'
                    }
                }
            }
        };

        // Add dynamic job category toggle fields
        selectedJobCategories.forEach((service: any) => {
            projection[service.toString()] = {
                $in: [service, '$jobCategories._id']
            };
        });

        // Also add job category name-based toggles for easier frontend usage
        allJobCategories.forEach(service => {
            const fieldName = service.name.toLowerCase().replace(/\s+/g, '');
            projection[fieldName] = {
                $in: [service.name, '$jobCategories.name']
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
                            $lookup: {
                                from: 'jobcategories',
                                localField: 'jobCategories',
                                foreignField: '_id',
                                as: 'jobCategories'
                            }
                        },
                        {
                            $project: projection
                        }
                    ],

                    // Filtered job category counts for filtered/searched clients
                    filteredJobCategoriesCounts: [
                        { $match: query },
                        { $unwind: '$jobCategories' },
                        {
                            $group: {
                                _id: '$jobCategories',
                                count: { $sum: 1 }
                            }
                        },
                        {
                            $lookup: {
                                from: 'jobcategories',
                                localField: '_id',
                                foreignField: '_id',
                                as: 'jobCategoryInfo'
                            }
                        },
                        { $unwind: '$jobCategoryInfo' },
                        {
                            $project: {
                                serviceId: '$_id',
                                serviceName: '$jobCategoryInfo.name',
                                count: 1,
                                _id: 0
                            }
                        },
                        { $sort: { count: -1 } }
                    ],

                    // Global job category counts for all clients (for UI breakdown cards)
                    globalJobCategoriesCounts: [
                        { $match: { status: "active", companyId } },
                        { $unwind: '$jobCategories' },
                        {
                            $group: {
                                _id: '$jobCategories',
                                count: { $sum: 1 }
                            }
                        },
                        {
                            $lookup: {
                                from: 'jobcategories',
                                localField: '_id',
                                foreignField: '_id',
                                as: 'jobCategoryInfo'
                            }
                        },
                        { $unwind: '$jobCategoryInfo' },
                        {
                            $project: {
                                serviceId: '$_id',
                                serviceName: '$jobCategoryInfo.name',
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
        const filteredJobCategoriesCounts = result.filteredJobCategoriesCounts;
        const globalJobCategoriesCounts = result.globalJobCategoriesCounts;

        // Create maps for efficient lookup
        const filteredCountsMap = new Map();
        filteredJobCategoriesCounts.forEach((s: any) => {
            filteredCountsMap.set(s.serviceId.toString(), s.count);
        });

        console.log("globalJobCategoriesCounts", globalJobCategoriesCounts,);
        const globalCountsMap = new Map();
        globalJobCategoriesCounts.forEach((s: any) => {
            globalCountsMap.set(s.serviceId.toString(), s.count);
        });

        // Merge with all services to include zero counts
        const completeFilteredCounts = allJobCategories.map(service => ({
            jobCategoryId: service._id,
            jobCategoryName: service.name,
            count: filteredCountsMap.get(service._id.toString()) || 0
        }));

        const completeGlobalCounts = allJobCategories.map(service => ({
            jobCategoryId: service._id,
            jobCategoryName: service.name,
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
        const { clientJobCategories } = req.body;
        for (const jobCategory of clientJobCategories) {
            const { clientId, jobCategoriesIds } = jobCategory;
            await ClientModel.findByIdAndUpdate(clientId, { jobCategories: jobCategoriesIds }, { new: true });

        }
        SUCCESS(res, 200, "Client updated successfully", {});
    } catch (error) {
        console.log("error in updateClientService", error);
        next(error);
    }
};


const getClientBreakdown = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const companyId = req.user.companyId;

        // Pagination params
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;
        const search = req.query.search as string || '';

        // Base client match condition
        const baseMatch: any = {
            companyId: ObjectId(companyId),
            status: 'active'
        };

        if (search) {
            const searchRegex = new RegExp(search, 'i');
            baseMatch.$or = [
                { name: { $regex: searchRegex } },
                { clientRef: { $regex: searchRegex } }
            ];
        }

        // Main aggregation pipeline
        const pipeline: any[] = [
            { $match: baseMatch },

            // Lookup jobs for this client
            {
                $lookup: {
                    from: 'jobs',
                    let: { clientId: '$_id', companyId: '$companyId' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$clientId', '$$clientId'] },
                                        { $eq: ['$companyId', '$$companyId'] }
                                    ]
                                }
                            }
                        },
                        {
                            $lookup: {
                                from: 'timelogs',
                                let: { jobId: '$_id' },
                                pipeline: [
                                    {
                                        $match: {
                                            $expr: {
                                                $and: [
                                                    { $eq: ['$jobId', '$$jobId'] },
                                                    { $eq: ['$billable', true] }
                                                ]
                                            }
                                        }
                                    },
                                    {
                                        $lookup: {
                                            from: 'users',
                                            localField: 'userId',
                                            foreignField: '_id',
                                            as: 'user',
                                            pipeline: [{ $project: { _id: 1, name: 1, avatarUrl: 1 } }]
                                        }
                                    },
                                    {$unwind: { path: '$user' , preserveNullAndEmptyArrays: true } },
                                    {$lookup: {
                                        from: 'timecategories',
                                        localField: 'timeCategoryId',
                                        foreignField: '_id',
                                        as: 'timeCategory',
                                        pipeline: [{ $project: { _id: 1, name: 1 } }]
                                    }},
                                    {$unwind: { path: '$timeCategory' , preserveNullAndEmptyArrays: true } },
                                  
                                ],
                                as: 'timeLogs'
                            }
                        },
                        {
                            $addFields: {
                                totalLogDuration: { $sum: '$timeLogs.duration' }
                            }
                        },
                        {
                            $project: {
                                _id: 1,
                                name: 1,
                                status: 1,
                                timeLogs: 1,
                                totalLogDuration: 1
                            }
                        }
                    ],
                    as: 'allJobs'
                }
            },

            // Lookup WIP (unbilled time logs)
            {
                $lookup: {
                    from: 'timelogs',
                    let: { clientId: '$_id', companyId: '$companyId' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$clientId', '$$clientId'] },
                                        { $eq: ['$companyId', '$$companyId'] },
                                        { $eq: ['$billable', true] },
                                        { $eq: ['$status', 'notInvoiced'] }
                                    ]
                                }
                            }
                        },
                        {
                            $group: {
                                _id: null,
                                totalWipAmount: { $sum: '$amount' },
                                totalWipDuration: { $sum: '$duration' }
                            }
                        }
                    ],
                    as: 'wipData'
                }
            },
            {
                $addFields: {
                    wipAmount: {
                        $ifNull: [{ $arrayElemAt: ['$wipData.totalWipAmount', 0] }, 0]
                    },
                    wipDuration: {
                        $ifNull: [{ $arrayElemAt: ['$wipData.totalWipDuration', 0] }, 0]
                    }
                }
            },

            // Lookup invoices for this client
            {
                $lookup: {
                    from: 'invoices',
                    let: { clientId: '$_id', companyId: '$companyId' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$clientId', '$$clientId'] },
                                        { $eq: ['$companyId', '$$companyId'] }
                                    ]
                                }
                            }
                        },
                        {
                            $addFields: {
                                balance: { $subtract: ['$totalAmount', '$paidAmount'] }
                            }
                        },
                        {
                            $group: {
                                _id: null,
                                totalInvoices: { $sum: 1 },
                                totalInvoiceAmount: { $sum: '$totalAmount' },
                                totalOutstanding: { $sum: '$balance' },
                                totalPaid: { $sum: '$paidAmount' },
                            }
                        }
                    ],
                    as: 'invoiceData'
                }
            },
            {
                $addFields: {
                    totalInvoices: {
                        $ifNull: [{ $arrayElemAt: ['$invoiceData.totalInvoices', 0] }, 0]
                    },
                    totalOutstanding: {
                        $ifNull: [{ $arrayElemAt: ['$invoiceData.totalOutstanding', 0] }, 0]
                    },
                    totalPaid: {
                        $ifNull: [{ $arrayElemAt: ['$invoiceData.totalPaid', 0] }, 0]
                    },
                    totalInvoiceAmount: {
                        $ifNull: [{ $arrayElemAt: ['$invoiceData.totalInvoiceAmount', 0] }, 0]
                    }
                }
            },

            // Lookup expenses for this client
            {
                $lookup: {
                    from: 'expenses',
                    let: { clientId: '$_id', companyId: '$companyId' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$clientId', '$$clientId'] },
                                        { $eq: ['$companyId', '$$companyId'] }
                                    ]
                                }
                            }
                        },
                        {
                            $group: {
                                _id: null,
                                totalExpenses: { $sum: '$totalAmount' }
                            }
                        }
                    ],
                    as: 'expenseData'
                }
            },
            {
                $addFields: {
                    totalExpenses: {
                        $ifNull: [{ $arrayElemAt: ['$expenseData.totalExpenses', 0] }, 0]
                    }
                }
            },

            // Lookup write-offs for this client
            {
                $lookup: {
                    from: 'writeoffs',
                    let: { clientId: '$_id', companyId: '$companyId' },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ['$companyId', '$$companyId'] }
                            }
                        },
                        { $unwind: '$timeLogs' },
                        {
                            $match: {
                                $expr: { $eq: ['$timeLogs.clientId', '$$clientId'] }
                            }
                        },
                        {
                            $group: {
                                _id: null,
                                totalWriteOffAmount: { $sum: '$timeLogs.writeOffAmount' }
                            }
                        }
                    ],
                    as: 'writeOffData'
                }
            },
            {
                $addFields: {
                    totalWriteOffAmount: {
                        $ifNull: [{ $arrayElemAt: ['$writeOffData.totalWriteOffAmount', 0] }, 0]
                    }
                }
            },

            // Lookup notes for this client
            {
                $lookup: {
                    from: 'notes',
                    let: { clientId: '$_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ['$clientId', '$$clientId'] }
                            }
                        },
                        {
                            $lookup: {
                                from: 'users',
                                localField: 'createdBy',
                                foreignField: '_id',
                                as: 'createdBy',
                                pipeline: [{ $project: { _id: 1, name: 1, avatarUrl: 1 } }]
                            }
                        },
                        { $unwind: { path: '$createdBy', preserveNullAndEmptyArrays: true } },
                        {
                            $project: {
                                _id: 1,
                                note: 1,
                                createdAt: 1,
                                updatedAt: 1,
                                createdBy: 1
                            }
                        },
                        { $sort: { createdAt: -1 } }
                    ],
                    as: 'notes'
                }
            },
            // jobCategory
            {
                $lookup: {
                    from: 'jobcategories',
                    localField: 'jobCategories',
                    foreignField: '_id',
                    as: 'jobCategory'
                }
            },

            // Calculate derived fields
            {
                $addFields: {
                    // WIP + Outstanding 
                    wipPlusOutstanding: { $add: ['$wipAmount', '$totalOutstanding'] },
                    // Average Balance
                    averageBalance: {
                        $cond: [
                            { $gt: ['$totalInvoices', 0] },
                            { $divide: ['$totalOutstanding', '$totalInvoices'] },
                            0
                        ]
                    },

                    totalLogDuration: { $sum: '$allJobs.totalLogDuration' }
                }
            },


            // Project final fields
            {
                $project: {
                    _id: 1,
                    clientRef: 1,
                    name: 1,
                    email: 1,
                    phone: 1,
                    status: 1,
                    allJobs: 1,
                    totalLogDuration: 1,
                    jobCategory: 1,
                    totalOutstanding: { $round: ['$totalOutstanding', 2] },
                    wipAmount: { $round: ['$wipAmount', 2] },
                    totalInvoices: 1,
                    totalInvoiceAmount: { $round: ['$totalInvoiceAmount', 2] },
                    totalPaid: { $round: ['$totalPaid', 2] },
                    wipPlusOutstanding: { $round: ['$wipPlusOutstanding', 2] },
                    averageBalance: { $round: ['$averageBalance', 2] },
                    totalExpenses: { $round: ['$totalExpenses', 2] },
                    totalWriteOffAmount: { $round: ['$totalWriteOffAmount', 2] },
                    notes: 1,
                    createdAt: 1
                }
            },

            // Sort by client name
            { $sort: { name: 1 } },

            // Facet for pagination and total count
            {
                $facet: {
                    data: [
                        { $skip: skip },
                        { $limit: limit }
                    ],
                    totalCount: [{ $count: 'count' }]
                }
            }
        ];

        // Execute aggregation
        const result = await ClientModel.aggregate(pipeline).collation({ locale: "en", strength: 2 });
        const clientBreakdown = result[0].data;
        const totalCount = result[0].totalCount[0]?.count || 0;

        // Calculate summary totals
        const summaryPipeline = [
            { $match: baseMatch },
            {
                $lookup: {
                    from: 'jobs',
                    let: { clientId: '$_id', companyId: '$companyId' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$clientId', '$$clientId'] },
                                        { $eq: ['$companyId', '$$companyId'] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: 'jobs'
                }
            },
            {
                $lookup: {
                    from: 'timelogs',
                    let: { clientId: '$_id', companyId: '$companyId' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$clientId', '$$clientId'] },
                                        { $eq: ['$companyId', '$$companyId'] },
                                        { $eq: ['$billable', true] },
                                        { $eq: ['$status', 'notInvoiced'] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: 'wipLogs'
                }
            },
            {
                $lookup: {
                    from: 'invoices',
                    let: { clientId: '$_id', companyId: '$companyId' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$clientId', '$$clientId'] },
                                        { $eq: ['$companyId', '$$companyId'] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: 'invoices'
                }
            },
            {
                $lookup: {
                    from: 'expenses',
                    let: { clientId: '$_id', companyId: '$companyId' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$clientId', '$$clientId'] },
                                        { $eq: ['$companyId', '$$companyId'] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: 'expenses'
                }
            },
            {
                $lookup: {
                    from: 'writeoffs',
                    let: { clientId: '$_id', companyId: '$companyId' },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ['$companyId', '$$companyId'] }
                            }
                        },
                        { $unwind: '$timeLogs' },
                        {
                            $match: {
                                $expr: { $eq: ['$timeLogs.clientId', '$$clientId'] }
                            }
                        },
                        {
                            $group: {
                                _id: null,
                                totalWriteOffAmount: { $sum: '$timeLogs.writeOffAmount' }
                            }
                        }
                    ],
                    as: 'writeOffs'
                }
            },
            {
                $addFields: {
                    wipAmount: { $sum: '$wipLogs.amount' },
                    totalOutstanding: {
                        $sum: {
                            $map: {
                                input: '$invoices',
                                as: 'inv',
                                in: { $subtract: ['$$inv.totalAmount', '$$inv.paidAmount'] }
                            }
                        }
                    },
                    totalWriteOffAmount: {
                        $ifNull: [{ $arrayElemAt: ['$writeOffs.totalWriteOffAmount', 0] }, 0]
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    totalClients: { $sum: 1 },
                    totalJobs: { $sum: { $size: '$jobs' } },
                    totalOutstanding: { $sum: '$totalOutstanding' },
                    totalWipAmount: { $sum: '$wipAmount' },
                    totalInvoices: { $sum: { $size: '$invoices' } },
                    totalExpenses: { $sum: { $sum: '$expenses.totalAmount' } },
                    totalWriteOffAmount: { $sum: '$totalWriteOffAmount' }
                }
            }
        ];

        const summaryResult = await ClientModel.aggregate(summaryPipeline);
        const summary = summaryResult[0] || {
            totalClients: 0,
            totalJobs: 0,
            totalOutstanding: 0,
            totalWipAmount: 0,
            totalInvoices: 0,
            totalExpenses: 0,
            totalWriteOffAmount: 0
        };



        return res.status(200).json({
            success: true,
            message: "Client breakdown fetched successfully",
            data: {
                clients: clientBreakdown,

                summary: {
                    totalClients: summary.totalClients,
                    totalJobs: summary.totalJobs,
                    totalOutstanding: parseFloat(summary.totalOutstanding.toFixed(2)),
                    totalWipAmount: parseFloat(summary.totalWipAmount.toFixed(2)),
                    totalInvoices: summary.totalInvoices,
                    totalExpenses: parseFloat(summary.totalExpenses.toFixed(2)),
                    totalWriteOffAmount: parseFloat((summary.totalWriteOffAmount || 0).toFixed(2))
                },
                pagination: {
                    page,
                    limit,
                    totalCount,
                    totalPages: Math.ceil(totalCount / limit),
                }
            }
        });
    } catch (error) {
        console.log("error in getClientBreakdown", error);
        next(error);
    }
};

const importClients = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { clients } = req.body;
        const companyId = req.user.companyId;

        if (!Array.isArray(clients) || clients.length === 0) {
            throw new BadRequestError("Clients array is required and must not be empty");
        }

        // Get all business types and team members for the company to map names to IDs
        const [businessTypes, teamMembers] = await Promise.all([
            BusinessCategoryModel.find({ companyId }).lean(),
            UserModel.find({ companyId, role: { $ne: 'superadmin' } }).lean()
        ]);

        // Create maps for quick lookup (using Map that can be updated during import)
        const businessTypeMap = new Map(businessTypes.map((bt: any) => [bt.name.toLowerCase().trim(), { id: bt._id, name: bt.name }]));
        const teamMemberMap = new Map(teamMembers.map((tm: any) => [tm.name.toLowerCase().trim(), tm._id]));

        const importedClients = [];
        const errors = [];

        // Helper function to get or create business type
        const getOrCreateBusinessType = async (businessTypeName: string): Promise<any> => {
            if (!businessTypeName) return null;
            
            const businessTypeKey = businessTypeName.toLowerCase().trim();
            const existing = businessTypeMap.get(businessTypeKey);
            
            if (existing) {
                return existing.id;
            }
            
            // Create new business type
            try {
                const newBusinessType = await BusinessCategoryModel.create({
                    name: businessTypeName.trim(),
                    companyId: companyId
                });
                
                // Update map for future lookups
                businessTypeMap.set(businessTypeKey, { id: newBusinessType._id, name: newBusinessType.name });
                
                return newBusinessType._id;
            } catch (error: any) {
                console.error(`Error creating business type "${businessTypeName}":`, error);
                throw new Error(`Failed to create business type "${businessTypeName}": ${error.message}`);
            }
        };

        for (let i = 0; i < clients.length; i++) {
            const clientData = clients[i];
            try {
                // Map Excel columns to client fields
                const clientRefRaw = (clientData['CLIENT REF.'] || clientData['CLIENT REF'] || '').toString().trim();
                const clientRef = clientRefRaw || `CLIENT-${Date.now()}-${i}`;
                const rawName = (clientData['CLIENT NAME'] || '').toString().trim();
                const clientManagerName = (clientData['CLIENT MANAGER'] || '').toString().trim();
                const clientStatus = (clientData['CLIENT STATUS'] || 'Current').toString().trim();
                const businessTypeName = (clientData['BUSINESS TYPE'] || '').toString().trim();
                const taxNumber = (clientData['TAX/PPS NO.'] || clientData['TAX/PPS NO'] || '').toString().trim();
                const yearEnd = (clientData['YEAR END'] || '').toString().trim();
                const audit = (clientData['IN AUDIT'] || '').toString().trim().toLowerCase();
                const croNumber = (clientData['CRO NO.'] || clientData['CRO NO'] || '').toString().trim() || '';
                const croLink = (clientData['CRO LINK'] || '').toString().trim() || '';
                // Extract date values - handle undefined, null, empty strings consistently
                const arDateStr = clientData['AR DATE'] !== undefined && clientData['AR DATE'] !== null && clientData['AR DATE'] !== '' 
                    ? clientData['AR DATE'] 
                    : undefined;
                const address = (clientData['ADDRESS'] || '').toString().trim() || 'N/A';
                const phone = (clientData['PHONE'] || '').toString().trim() || 'N/A';
                const phoneNote = (clientData['PHONE NOTE'] || '').toString().trim() || 'N/A';
                const email = (clientData['EMAIL'] || '').toString().trim() || '';
                const emailNote = (clientData['EMAIL NOTE'] || '').toString().trim() || 'N/A';
                // Extract date values - handle undefined, null, empty strings consistently (same as AR DATE)
                const onboardedDateStr = clientData['ONBOARDED DATE'] !== undefined && clientData['ONBOARDED DATE'] !== null && clientData['ONBOARDED DATE'] !== '' 
                    ? clientData['ONBOARDED DATE'] 
                    : undefined;
                const amlCompliant = (clientData['AML COMPLAINT'] || clientData['AML COMPLAINT'] || '').toString().trim().toLowerCase();
                const wipBalance = parseFloat(clientData['WIP BALANCE'] || clientData['WIP BALANCE'] || '0') || 0;
                const debtorsBalance = parseFloat(clientData['DEBTORS BALANCE'] || clientData['DEBTORS BALA'] || '0') || 0;
                const importedWipDateStr = clientData['WIP DATE'] !== undefined && clientData['WIP DATE'] !== null && clientData['WIP DATE'] !== ''
                    ? clientData['WIP DATE']
                    : undefined;

                // Get or create business type
                let businessTypeId = null;
                if (businessTypeName) {
                    try {
                        businessTypeId = await getOrCreateBusinessType(businessTypeName);
                    } catch (error: any) {
                        errors.push({ row: i + 2, error: `Row ${i + 2}: ${error.message}` });
                        continue;
                    }
                }

                // Map client manager name to ID
                let clientManagerId = null;
                if (clientManagerName) {
                    const managerKey = clientManagerName.toLowerCase().trim();
                    clientManagerId = teamMemberMap.get(managerKey);
                    // Don't error if manager not found, just skip it
                }

                // Parse dates consistently using the same utility function
                const onboardedDate = parseDateSafely(onboardedDateStr);
                const arDate = parseDateSafely(arDateStr);

                // Convert boolean fields
                const auditValue = audit === 'yes' || audit === 'true' || audit === '1';
                const amlCompliantValue = amlCompliant === 'yes' || amlCompliant === 'true' || amlCompliant === '1';

                // Validate client status
                const validStatuses = ['Prospect', 'Current', 'Archived'];
                const finalClientStatus = validStatuses.includes(clientStatus) ? clientStatus : 'Current';

                // Create client object
                const clientToCreate: any = {
                    companyId,
                    clientRef,
                    name: rawName || clientRef || `Imported Client ${i + 1}`,
                    businessTypeId,
                    taxNumber,
                    croNumber: croNumber || '',
                    croLink: croLink || '',
                    clientManagerId: clientManagerId || undefined,
                    address: address || 'N/A',
                    email: email || '',
                    emailNote: emailNote || 'N/A',
                    phone: phone || 'N/A',
                    phoneNote: phoneNote || 'N/A',
                    amlCompliant: amlCompliantValue,
                    audit: auditValue,
                    clientStatus: finalClientStatus,
                    yearEnd: yearEnd || '',
                    status: 'active',
                    services: [],
                    jobCategories: [],
                    wipBalance: wipBalance || 0,
                    debtorsBalance: debtorsBalance || 0,
                };
                
                // Only include dates if they're defined (not empty) and not from 1970
                // Both dates are handled identically to ensure consistent behavior
                if (onboardedDate !== undefined && onboardedDate !== null) {
                    // Final validation: reject any 1970 dates (likely from empty/invalid parsing)
                    const year = onboardedDate.getUTCFullYear();
                    if (year !== 1970 && year >= 1900 && year <= 2100) {
                        clientToCreate.onboardedDate = onboardedDate;
                    }
                }
                if (arDate !== undefined && arDate !== null) {
                    // Final validation: reject any 1970 dates (likely from empty/invalid parsing)
                    const year = arDate.getUTCFullYear();
                    if (year !== 1970 && year >= 1900 && year <= 2100) {
                        clientToCreate.arDate = arDate;
                    }
                }

                if (wipBalance) {
                    const importedWipDate = parseDateSafely(importedWipDateStr) || new Date();
                    const year = importedWipDate.getUTCFullYear();
                    if (year !== 1970 && year >= 1900 && year <= 2100) {
                        clientToCreate.importedWipDate = importedWipDate;
                    } else {
                        clientToCreate.importedWipDate = new Date();
                    }
                }

                const createdClient = await ClientModel.create(clientToCreate);
                importedClients.push({ row: i + 2, clientId: createdClient._id, name: createdClient.name });
            } catch (error: any) {
                errors.push({ row: i + 2, error: `Row ${i + 2}: ${error.message || 'Failed to import client'}` });
            }
        }

        SUCCESS(res, 200, "Clients imported successfully", {
            data: {
                imported: importedClients.length,
                failed: errors.length,
                importedClients,
                errors: errors.length > 0 ? errors : undefined
            }
        });
    } catch (error) {
        console.log("error in importClients", error);
        next(error);
    }
};

const getClientDebtorsLog = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { clientId } = req.params;
        if (!clientId) {
            throw new BadRequestError("Client ID is required");
        }

        const clientObjectId = ObjectId(clientId);
        const companyId = req.user.companyId;

        const client = await ClientModel.findOne({ _id: clientObjectId, companyId })
            .select('name debtorsBalance createdAt')
            .lean();

        if (!client) {
            throw new BadRequestError("Client not found");
        }

        const invoices = await InvoiceModel.find({ clientId: clientObjectId, companyId })
            .select('_id invoiceNo totalAmount date status jobId scope source createdAt')
            .sort({ date: 1, createdAt: 1 })
            .lean();

        const invoiceIds = invoices.map(inv => inv._id);
        const invoiceLogs = invoiceIds.length > 0
            ? await InvoiceLogModel.find({ invoiceId: { $in: invoiceIds } })
                .sort({ date: 1, createdAt: 1 })
                .lean()
            : [];

        const jobIds = invoices
            .map(inv => inv.jobId)
            .filter((id): id is typeof invoices[0]['jobId'] => Boolean(id));

        const jobs = jobIds.length > 0
            ? await JobModel.find({ _id: { $in: jobIds } })
                .select('_id name')
                .lean()
            : [];

        const jobNameMap = new Map<string, string>();
        jobs.forEach(job => jobNameMap.set(job._id.toString(), job.name));

        const logMap = new Map<string, any[]>();
        invoiceLogs.forEach(log => {
            const key = log.invoiceId?.toString();
            if (!key) return;
            if (!logMap.has(key)) {
                logMap.set(key, []);
            }
            logMap.get(key)?.push(log);
        });

        const creditActions = new Set(['partialPayment', 'payment', 'compeleted', 'completed', 'writeOff', 'creditNote']);
        const actionLabelMap: Record<string, string> = {
            partialPayment: 'Receipt',
            payment: 'Receipt',
            compeleted: 'Payment Completed',
            completed: 'Payment Completed',
            writeOff: 'Write Off',
            creditNote: 'Credit Note'
        };

        const currency = (value: number) => Number((value || 0).toFixed(2));
        const normalizeDate = (value?: Date | string | null) => {
            if (!value) return new Date();
            const dateValue = value instanceof Date ? value : new Date(value);
            if (isNaN(dateValue.getTime())) {
                return new Date();
            }
            return dateValue;
        };

        const entries: any[] = [];
        let runningBalance = 0;

        const pushEntry = (entry: any) => {
            entries.push({
                id: `${clientId}-${entries.length + 1}`,
                ...entry,
                date: normalizeDate(entry.date).toISOString(),
                debit: currency(entry.debit),
                credit: currency(entry.credit),
                allocated: currency(entry.allocated),
                outstanding: currency(entry.outstanding),
                balance: currency(entry.balance),
            });
        };

        const openingBalance = currency(Number(client.debtorsBalance || 0));
        const agingBuckets: Record<string, number> = {
            current: 0,
            days30: 0,
            days60: 0,
            days90: 0,
            unallocated: 0,
        };
        const addToAging = (amount: number, dateValue?: any | string | null) => {
            if (amount <= 0) return;
            const now = new Date();
            const entryDate = normalizeDate(dateValue);
            const diffDays = Math.floor((now.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));

            if (diffDays <= 30) {
                agingBuckets.current += amount;
            } else if (diffDays <= 60) {
                agingBuckets.days30 += amount;
            } else if (diffDays <= 90) {
                agingBuckets.days60 += amount;
            } else {
                agingBuckets.days90 += amount;
            }
        };

        if (openingBalance !== 0) {
            runningBalance += openingBalance;
            pushEntry({
                type: 'Opening Balance',
                referenceNumber: 'Imported',
                docNo: '-',
                jobName: undefined,
                debit: openingBalance > 0 ? openingBalance : 0,
                credit: openingBalance < 0 ? Math.abs(openingBalance) : 0,
                allocated: 0,
                outstanding: runningBalance,
                balance: runningBalance,
                date: client.createdAt || new Date(),
            });
            if (openingBalance > 0) {
                addToAging(openingBalance, client.createdAt);
            }
        }

        for (const invoice of invoices) {
            const invoiceId = invoice?._id?.toString();
            const invoiceDate = invoice.date || invoice.createdAt || new Date();
            const invoiceAmount = currency(Number(invoice.totalAmount || 0));
            let invoiceOutstanding = invoiceAmount;

            runningBalance += invoiceAmount;
            pushEntry({
                type: 'Invoice',
                referenceNumber: invoice.invoiceNo || 'Invoice',
                docNo: invoice.invoiceNo || 'INV',
                jobName: invoice.jobId ? jobNameMap.get(invoice.jobId.toString()) : undefined,
                debit: invoiceAmount,
                credit: 0,
                allocated: 0,
                outstanding: invoiceOutstanding,
                balance: runningBalance,
                date: invoiceDate,
            });

            const logsForInvoice = (logMap.get(invoiceId || '') || []).sort((a, b) => {
                const aDate = normalizeDate(a.date || a.createdAt).getTime();
                const bDate = normalizeDate(b.date || b.createdAt).getTime();
                return aDate - bDate;
            });

            let creditedAmountForInvoice = 0;       

            for (const log of logsForInvoice) {
                if (!creditActions.has(log.action)) {
                    continue;
                }
                const creditAmount = currency(Number(log.amount || 0));
                if (creditAmount <= 0) {
                    continue;
                }
                creditedAmountForInvoice += creditAmount;
                invoiceOutstanding = Math.max(invoiceOutstanding - creditAmount, 0);
                runningBalance = Math.max(runningBalance - creditAmount, 0);

                pushEntry({
                    type: actionLabelMap[log.action] || 'Receipt',
                    referenceNumber: invoice.invoiceNo || 'Invoice',
                    docNo: invoice.invoiceNo || 'INV',
                    jobName: invoice.jobId ? jobNameMap.get(invoice.jobId.toString()) : undefined,
                    debit: 0,
                    credit: creditAmount,
                    allocated: creditAmount,
                    outstanding: invoiceOutstanding,
                    balance: runningBalance,
                    date: log.date || log.createdAt || invoiceDate,
                });
            }

            const outstandingAfterCredits = Math.max(invoiceAmount - creditedAmountForInvoice, 0);
            if (outstandingAfterCredits > 0) {
                addToAging(outstandingAfterCredits, invoiceDate);
            }
        }

        const totalDebit = entries.reduce((sum, entry) => sum + entry.debit, 0);
        const totalCredit = entries.reduce((sum, entry) => sum + entry.credit, 0);
        const outstandingBalance = Math.max(runningBalance, 0);

        const summary = {
            totalDebit: currency(totalDebit),
            totalCredit: currency(totalCredit),
            totalOutstanding: currency(outstandingBalance),
            transactionCount: entries.length,
        };

        Object.keys(agingBuckets).forEach(key => {
            agingBuckets[key] = currency(agingBuckets[key]);
        });

        SUCCESS(res, 200, "Client debtors log fetched successfully", {
            data: {
                client: {
                    id: clientId,
                    name: client.name,
                },
                entries,
                summary,
                aging: agingBuckets,
                openingBalance,
            }
        });
    } catch (error) {
        console.log("error in getClientDebtorsLog", error);
        next(error);
    }
};

export default { addClient, updateClient, getClients, getClientServices, updateClientService, getClientById, deleteClient, getClientBreakdown, importClients, getClientDebtorsLog };