import { NextFunction, Request, Response } from "express";

import { SUCCESS } from "../utils/response";
import { TimesheetModel } from "../models/Timesheet";
import { BadRequestError } from "../utils/errors";
import { calculateEarnings, findUserById, ObjectId } from "../utils/utills";
import { TimeEntryModel } from "../models/TimeEntry";
import { ClientModel } from "../models/Client";
import { JobModel } from "../models/Job";
import { JobCategoryModel } from "../models/JobCategory";
import { TimeLogModel } from "../models/TImeLog";
import { SettingModel } from "../models/Setting";
import { NotesModel } from "../models/Notes";

const addTimesheet = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const currentUserId = req.userId;
        const companyId = req.user.companyId;
        let { weekStart, weekEnd, timeEntries, isbillable, userId, ...otherData } = req.body;
        userId = userId || currentUserId;
        let oldTimeEntry:any;
        let timesheet = await TimesheetModel.findOne({ weekStart, weekEnd, userId });
        if (timesheet) {
            oldTimeEntry = timesheet.timeEntries || [];
            Object.assign(timesheet, otherData);
        } else {
            timesheet = await TimesheetModel.create({ weekStart, weekEnd, userId, isbillable, companyId, ...otherData });
        }
console.log("timeEntries", timeEntries);
        const timeEntriesIds: any = [];
        if (timeEntries?.length > 0) {
            for (const timeEntry of timeEntries) {
                timeEntry.timesheetId = timesheet._id;
                timeEntry.userId = timesheet?.userId || userId;
                timeEntry.companyId = timesheet?.companyId || companyId;
                const job = await JobModel.findById(timeEntry.jobId);
                const timeEntrieId = timeEntry?._id;
                // Use proper filter for upsert
                delete timeEntry._id;
                let data: any;
                if (timeEntrieId) {
                    data = await TimeEntryModel.findByIdAndUpdate(
                        timeEntrieId,
                        timeEntry,
                        {
                            upsert: true,
                            new: true
                        }

                    );
                } else {
                    data = await TimeEntryModel.findOneAndUpdate(
                        {
                            timesheetId: timesheet._id,
                            clientId: timeEntry.clientId,
                            jobId: timeEntry.jobId,
                            timeCategoryId: timeEntry.timeCategoryId
                        },
                        timeEntry,
                        {
                            upsert: true,
                            new: true
                        }

                    );
                }

                const logs = timeEntry?.logs || [];
                let totalHours= 0;
                let totalAmount = 0;
                const rate = timeEntry?.rate || 0;
                for (const log of logs) {
                    totalHours+=log.duration;
                    const addedLog = {
                        userId: timesheet?.userId || userId,
                        timeEntrieId: data._id,
                        companyId: companyId,
                        clientId: timeEntry.clientId,
                        jobId: timeEntry.jobId,
                        jobTypeId: job?.jobTypeId,
                        timeCategoryId: timeEntry.timeCategoryId,
                        date: log.date,
                        description: timeEntry.description,
                        billable: timeEntry.isbillable,
                        duration: log.duration,
                        rate: timeEntry.rate,
                        amount: calculateEarnings(log.duration, timeEntry.rate),
                    }
                    await TimeLogModel.findOneAndUpdate({
                        userId: timesheet?.userId || userId,
                        timeEntrieId: data._id,
                        clientId: timeEntry.clientId,
                        jobId: timeEntry.jobId,
                        timeCategoryId: timeEntry.timeCategoryId,
                        billable: timeEntry.isbillable,
                        date: log.date
                    }, addedLog, {
                        upsert: true,
                        new: true
                    });
                }
                totalAmount = calculateEarnings(totalHours, rate);
                if (data) {
                    data.totalHours = totalHours;
                    data.totalAmount = totalAmount;
                    await data.save();
                    timeEntriesIds.push(data._id);
                }

            }
        }

        timesheet.timeEntries = timeEntriesIds;
        await timesheet.save();

        if (oldTimeEntry?.length > 0) {
            for (const timeEntry of oldTimeEntry) {
                if (!timeEntriesIds.includes(timeEntry._id)) {
                    await TimeEntryModel.findByIdAndDelete(timeEntry._id);
                    await TimeLogModel.deleteMany({ timeEntrieId: timeEntry._id });
                }
            }
        }

        SUCCESS(res, 200, "Timesheet added successfully", { data: timesheet });
    } catch (error) {
        console.log("error in addTimesheet", error);
        next(error);
    }
};

const getAllTimesheets = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        // Parse query parameters
        const {
            page = 1,
            limit = 10,
            search = "",
            status = "", // "draft", "submitted", "reviewed", "approved", "rejected"
            weekStart = "",
            weekEnd = "",
            userId = "",
            departmentId = ""
        } = req.query;

        const pageNum = Math.max(1, parseInt(page as string));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)));
        const skip = (pageNum - 1) * limitNum;

        // Build match query
        const matchQuery: any = {};

        // Add companyId if available in user context
        if (req.user?.companyId) {
            matchQuery.companyId = req.user.companyId;
        }

        if (status) {
            matchQuery.status = status;
        }

        if (userId) {
            matchQuery.userId = ObjectId(userId as string);
        }

        // Fix date filtering - use correct field names from schema
        if (weekStart || weekEnd) {
            matchQuery.weekStart = {};
            if (weekStart) matchQuery.weekStart.$gte = new Date(weekStart as string);
            if (weekEnd) matchQuery.weekStart.$lte = new Date(weekEnd as string);
        }

        const pipeline = [
            // Initial match (exclude search for now)
            {
                $match: Object.fromEntries(
                    Object.entries(matchQuery).filter(([key]) => key !== 'searchTerm')
                )
            },

            // Lookup user details
            {
                $lookup: {
                    from: 'users',
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'user',
                    pipeline: [
                        {
                            $project: {
                                name: 1,
                                email: 1,
                                avatar: 1,
                                departmentId: 1
                            }
                        }
                    ]
                }
            },
            { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },

            // Apply search filter after user lookup
            ...(search ? [{
                $match: {
                    $or: [
                        { 'user.name': { $regex: search, $options: 'i' } },
                        { 'user.email': { $regex: search, $options: 'i' } }
                    ]
                }
            }] : []),
            // macth department
            ...(departmentId ? [{
                $match: {
                    'user.departmentId': ObjectId(departmentId as string)
                }
            }] : []),

            // Add calculated fields based on actual schema
            {
                $addFields: {
                    // Calculate total hours from dailySummary
                    weekTotalHours: {
                        $sum: '$dailySummary.totalLogged'
                    },

                    // Calculate total billable hours
                    weekBillableHours: {
                        $sum: '$dailySummary.billable'
                    },

                    // Calculate total non-billable hours
                    weekNonBillableHours: {
                        $sum: '$dailySummary.nonBillable'
                    },

                    // Calculate total capacity
                    weekCapacity: {
                        $sum: '$dailySummary.capacity'
                    },

                    // Calculate variance
                    weekVariance: {
                        $subtract: [
                            { $sum: '$dailySummary.capacity' },
                            { $sum: '$dailySummary.totalLogged' }
                        ]
                    },

                    // // Format dates
                    // formattedWeekStart: {
                    //     $dateToString: {
                    //         format: '%d/%m/%Y',
                    //         date: '$weekStart'
                    //     }
                    // },

                    // formattedWeekEnd: {
                    //     $dateToString: {
                    //         format: '%d/%m/%Y',
                    //         date: '$weekEnd'
                    //     }
                    // },

                    // Determine submission status
                    submissionStatus: {
                        $switch: {
                            branches: [
                                { case: { $eq: ['$status', 'approved'] }, then: 'Approved' },
                                { case: { $eq: ['$status', 'autoApproved'] }, then: 'Auto Approved' },
                                { case: { $eq: ['$status', 'rejected'] }, then: 'Rejected' },
                                { case: { $eq: ['$status', 'submitted'] }, then: 'For Review' },
                                { case: { $eq: ['$status', 'reviewed'] }, then: 'For Review' },
                                { case: { $eq: ['$status', 'draft'] }, then: 'Not Submitted' }
                            ],
                            default: 'Not Submitted'
                        }
                    }
                }
            },

            // Facet for pagination and counts
            {
                $facet: {
                    // Get total count
                    total: [{ $count: "count" }],

                    // Get paginated data
                    data: [
                        { $skip: skip },
                        { $limit: limitNum },
                        {
                            $project: {
                                _id: 1,
                                userId: 1,
                                user: 1,
                                // capacity: { $ifNull: ['$user.capacity', 40] }, // Default 40 hours per week
                                weekStart: 1,
                                weekEnd: 1,
                                // formattedWeekStart: 1,
                                // formattedWeekEnd: 1,
                                status: 1,
                                submissionStatus: 1,
                                // totalHours: '$weekTotalHours',
                                // billableHours: '$weekBillableHours',
                                // nonBillableHours: '$weekNonBillableHours',
                                // totalCapacity: '$weekCapacity',
                                // variance: '$weekVariance',
                                submittedAt: 1,
                                submittedBy: 1,
                                reviewedAt: 1,
                                reviewedBy: 1,
                                approvedAt: 1,
                                approvedBy: 1,
                                rejectedAt: 1,
                                rejectedBy: 1,
                                rejectionReason: 1,
                                entriesCount: { $size: { $ifNull: ['$timeEntries', []] } },
                                // Include summary totals from schema
                                totalBillable: 1,
                                totalNonBillable: 1,
                                totalLogged: 1,
                                totalVariance: 1,
                                totalCapacity: 1
                            }
                        }
                    ],

                    // Get summary statistics
                    summary: [
                        {
                            $group: {
                                _id: '$submissionStatus',
                                count: { $sum: 1 },
                                totalHours: { $sum: '$weekTotalHours' },
                                totalBillable: { $sum: '$weekBillableHours' }
                            }
                        }
                    ]
                }
            }
        ];

        // Execute aggregation
        const [result] = await TimesheetModel.aggregate(pipeline).allowDiskUse(true);

        const timesheets = result.data || [];
        const totalTimesheets = result.total[0]?.count || 0;
        const summaryData = result.summary || [];

        // Process summary data
        const summary = {
            totalTeam: totalTimesheets,
            forReview: 0,
            rejected: 0,
            approved: 0,
            autoApproved: 0,
            draft: 0,
            totalHours: 0,
            totalBillableHours: 0
        };

        summaryData.forEach((item: any) => {
            summary.totalHours += item.totalHours || 0;
            summary.totalBillableHours += item.totalBillable || 0;

            switch (item._id) {
                case 'For Review':
                    summary.forReview = item.count;
                    break;
                case 'Rejected':
                    summary.rejected = item.count;
                    break;
                case 'Approved':
                    summary.approved = item.count;
                    break;
                case 'Auto Approved':
                    summary.autoApproved += item.count;
                case 'Not Submitted':
                    summary.draft = item.count;
                    break;
            }
        });

        // Calculate pagination
        const totalPages = Math.ceil(totalTimesheets / limitNum);

        SUCCESS(res, 200, "Timesheets fetched successfully", {
            data: timesheets,
            pagination: {
                currentPage: pageNum,
                totalPages,
                totalItems: totalTimesheets,
                limit: limitNum,
            },
            summary,
            filters: {
                search,
                status,
                weekStart,
                weekEnd,
                userId,
                departmentId,
            }
        });

    } catch (error) {
        console.error("Error in getAllTimesheets:", error);
        next(error);
    }
};

const getTimesheet = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { timesheetId, weekStart, weekEnd, userId } = req.query;
    const user = await findUserById(userId || req.user._id.toString());
    const query: any = {};
    if (timesheetId) {
        query._id = timesheetId;
    } else if (weekStart && weekEnd) {
        query.weekStart = new Date(weekStart as string);
        query.weekEnd = new Date(weekEnd as string);
        query.userId = userId || user?._id;
    } else {
        throw new Error("Invalid query parameters");
    };
    console.log("query", query);

    try {
        const timesheet: any = await TimesheetModel.findOne(query).populate('timeEntries').lean() || null;
        console.log("user._id", user?._id);
        const [jobs, jobCategories] = await Promise.all([
            JobModel.find(
                { companyId: user?.companyId, teamMembers: user?._id },
                { _id: 1, clientId: 1, name: 1 }
            ).lean(),
            JobCategoryModel.find({ companyId: user?.companyId }, { _id: 1, name: 1 }).lean()
        ]);
        const clientIds = jobs.map((job: any) => job.clientId);
        const clients = await ClientModel.find({ _id: { $in: clientIds } }, { _id: 1, name: 1, clientRef: 1 }).lean();

        SUCCESS(res, 200, "Timesheet fetched successfully",
            {
                data: timesheet,
                dropdoenOptionals: { clients, jobs, jobCategories },
                rate: user?.billableRate,
                name: user?.name,
                avatarUrl: user?.avatarUrl
            });
    } catch (error) {
        console.error("Error in getTimesheet:", error);
        next(error);
    }
};
const getAllTimeLogs = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        // Extract query parameters with proper typing
        const {
            page = 1,
            limit = 10,
            sortBy = 'date',
            sortOrder = 'desc',
            clientId,
            jobId,
            timeCategoryId,
            userId,
            jobTypeId,
            billable,
            invoiceStatus,
            startDate,
            endDate,
            search,
            groupBy = 'none' // none, clientName, teamName, jobType, jobName, category
        } = req.query;

        // Build filter object
        const filter: any = { companyId: req.user.companyId };

        // Basic filters
        if (clientId) {
            filter.clientId ={ $in: (clientId as string).split(',').map((id: string) => ObjectId(id)) };
        }

        if (jobId) {
            filter.jobId = { $in: (jobId as string).split(',').map((id: string) => ObjectId(id)) };
        }

        if (timeCategoryId) {
            filter.timeCategoryId = { $in: (timeCategoryId as string).split(',').map((id: string) => ObjectId(id)) };
        }

        if (userId) {
            filter.userId = { $in: (userId as string).split(',').map((id: string) => ObjectId(id)) };
        }
        if (jobTypeId) {
            filter.jobTypeId = { $in: (jobTypeId as string).split(',').map((id: string) => ObjectId(id)) };
        }

        // Boolean filter for billable
        if (billable !== undefined) {
            filter.billable = billable === 'true';
        }

        // Enum filter for invoice status
        if (invoiceStatus) {
            filter.invoiceStatus = invoiceStatus;
        }

        // Date range filter
        if (startDate || endDate) {
            filter.date = {};
            if (startDate) {
                filter.date.$gte = new Date(startDate as string);
            }
            if (endDate) {
                filter.date.$lte = new Date(endDate as string);
            }
        }

        // Search functionality
        if (search) {
            filter.description = {
                $regex: search,
                $options: 'i' // case insensitive
            };
        }

        // Pagination setup
        const pageNum = parseInt(page as string) || 1;
        const limitNum = parseInt(limit as string) || 10;
        const skip = (pageNum - 1) * limitNum;

        // Sort setup
        const sortObj: any = {};
        sortObj[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

        // Base aggregation pipeline
        let pipeline: any[] = [
            { $match: filter },
            {
                $lookup: {
                    from: 'clients',
                    localField: 'clientId',
                    foreignField: '_id',
                    as: 'client',
                    pipeline: [
                        { $project: { _id: 1, name: 1, clientRef: 1 } }
                    ]
                }
            },
            {
                $lookup: {
                    from: 'jobs',
                    localField: 'jobId',
                    foreignField: '_id',
                    as: 'job',
                    pipeline: [
                        { $project: { _id: 1, name: 1, jobTypeId: 1 } }
                    ]
                }
            },
            {
                $lookup: {
                    from: 'jobcategories',
                    localField: 'jobTypeId',
                    foreignField: '_id',
                    as: 'jobCategory',
                    pipeline: [
                        { $project: { _id: 1, name: 1, } }
                    ]
                }
            },
            {
                $lookup: {
                    from: 'timecategories',
                    localField: 'timeCategoryId',
                    foreignField: '_id',
                    as: 'timeCategory',
                    pipeline: [
                        { $project: { _id: 1, name: 1 } }
                    ]
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'user',
                    pipeline: [
                        { $project: { _id: 1, name: 1, avatarUrl: 1 } }
                    ]
                }
            },
            {
                $lookup: {
                    from: 'timeentries',
                    localField: 'timeEntrieId',
                    foreignField: '_id',
                    as: 'timeEntry'
                }
            },
            {
                $addFields: {
                    client: { $arrayElemAt: ['$client', 0] },
                    job: { $arrayElemAt: ['$job', 0] },
                    jobCategory: { $arrayElemAt: ['$jobCategory', 0] },
                    timeCategory: { $arrayElemAt: ['$timeCategory', 0] },
                    user: { $arrayElemAt: ['$user', 0] },
                    timeEntry: { $arrayElemAt: ['$timeEntry', 0] },
                    // Convert duration from minutes to hours for display
                    // durationHours: { $divide: ['$duration', 60] }
                }
            }
        ];

        // Group by logic based on query parameter
        if (groupBy !== 'none') {
            let groupKey: any = {};

            switch (groupBy) {
                case 'clientName':
                    groupKey = {
                        clientId: '$clientId',
                        clientName: '$client.name'
                    };
                    break;
                case 'teamName':
                    groupKey = {
                        teamId: '$user.teamId',
                        teamName: '$user.teamName'
                    };
                    break;
                case 'jobType':
                    groupKey = {
                        jobType: '$job.type',
                        jobTypeName: '$job.typeName'
                    };
                    break;
                case 'jobName':
                    groupKey = {
                        jobId: '$jobId',
                        jobName: '$job.name'
                    };
                    break;
                case 'category':
                    groupKey = {
                        categoryId: '$timeCategoryId',
                        categoryName: '$timeCategory.name'
                    };
                    break;
            }

            pipeline.push({
                $group: {
                    _id: groupKey,
                    totalHours: { $sum: '$durationHours' },
                    totalBillableHours: {
                        $sum: {
                            $cond: ['$billable', '$durationHours', 0]
                        }
                    },
                    totalNonBillableHours: {
                        $sum: {
                            $cond: ['$billable', 0, '$durationHours']
                        }
                    },
                    totalAmount: { $sum: '$amount' },
                    logCount: { $sum: 1 },
                    logs: { $push: '$$ROOT' }
                }
            });
        }

        // Get total count for pagination
        const countPipeline = [...pipeline];
        countPipeline.push({ $count: 'total' });

        const countResult = await TimeLogModel.aggregate(countPipeline);
        const totalRecords = countResult[0]?.total || 0;

        // Add pagination and sorting to main pipeline
        if (groupBy === 'none') {
            pipeline.push(
                { $sort: sortObj },
                { $skip: skip },
                { $limit: limitNum }
            );
        } else {
            pipeline.push(
                { $sort: { totalHours: -1 } }, // Sort groups by total hours
                { $skip: skip },
                { $limit: limitNum }
            );
        }

        // Execute main query
        const timeLogs = await TimeLogModel.aggregate(pipeline);

        // Calculate summary statistics
        const summaryPipeline = [
            { $match: filter },
            {
                $group: {
                    _id: null,
                    totalHours: { $sum: { $divide: ['$duration', 60] } },
                    totalBillableHours: {
                        $sum: {
                            $cond: ['$billable', { $divide: ['$duration', 60] }, 0]
                        }
                    },
                    totalAmount: { $sum: '$amount' },
                    uniqueClients: { $addToSet: '$clientId' },
                    uniqueJobs: { $addToSet: '$jobId' },
                    totalLogs: { $sum: 1 }
                }
            },
            {
                $addFields: {
                    uniqueClientsCount: { $size: '$uniqueClients' },
                    uniqueJobsCount: { $size: '$uniqueJobs' },
                    totalNonBillableHours: { $subtract: ['$totalHours', '$totalBillableHours'] }
                }
            }
        ];

        const summaryResult = await TimeLogModel.aggregate(summaryPipeline);
        const summary = summaryResult[0] || {
            totalHours: 0,
            totalBillableHours: 0,
            totalNonBillableHours: 0,
            totalAmount: 0,
            uniqueClientsCount: 0,
            uniqueJobsCount: 0,
            totalLogs: 0
        };

        // Calculate pagination info
        const totalPages = Math.ceil(totalRecords / limitNum);



        SUCCESS(res, 200, "Time logs fetched successfully", {
            timeLogs,
            summary: {
                totalHours: parseFloat(summary.totalHours.toFixed(2)),
                totalAmount: parseFloat(summary.totalAmount.toFixed(2)),
                uniqueClients: summary.uniqueClientsCount,
                uniqueJobs: summary.uniqueJobsCount,
                totalLogs: summary.totalLogs,
                billableHours: parseFloat(summary.totalBillableHours.toFixed(2)),
                nonBillableHours: parseFloat(summary.totalNonBillableHours.toFixed(2))
            },
            pagination: {
                currentPage: pageNum,
                totalPages,
                totalRecords,
                limit: limitNum,
            },
            filters: {
                appliedFilters: filter,
                groupBy,
                sortBy,
                sortOrder
            }
        },);

    } catch (error) {
        console.error("Error in getAllTimeLogs:", error);
        next(error);
    }
};

const addTimeLog = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        req.body.userId = req.body.userId || req.userId;
        req.body.companyId = req.user.companyId;
        if (req.body.duration && req.body.rate) req.body.amount = calculateEarnings(req.body.duration, req.body.rate);
        await TimeLogModel.create(req.body);
        SUCCESS(res, 200, "Time log added successfully", { data: {} });
    } catch (error) {
        console.log("error in addTimeLog", error);
        next(error);
    }
};
const updateTimeLog = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { timeLogId } = req.params;
        if (req.body.duration && req.body.rate) req.body.amount = calculateEarnings(req.body.duration, req.body.rate);
        await TimeLogModel.findByIdAndUpdate(timeLogId, req.body, { new: true });
        SUCCESS(res, 200, "Time log updated successfully", { data: {} });
    } catch (error) {
        console.log("error in updateTimeLog", error);
        next(error);
    }
};
const deleteTimeLog = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { timeLogIds } = req.body;
    try {
        await TimeLogModel.deleteMany({ _id: { $in: timeLogIds } });
        SUCCESS(res, 200, "Time log deleted successfully", { data: {} });
    } catch (error) {
        console.log("error in deleteTimeLog", error);
        next(error);
    }
};
const chanegTimeSheetStatus = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { timeSheetId, status } = req.body;
        const update: any = {};
        console.log("status", status, timeSheetId);
        if (status == "reviewed") {
            update.status = "reviewed";
            update.reviewedAt = new Date().toISOString().slice(0, 10);
            update.submittedAt = new Date().toISOString().slice(0, 10);
            update.reviewedBy = req.userId
            update.submittedBy = req.userId
            const setting = await SettingModel.findOne({ companyId: req.user.companyId });
            if (setting && setting?.autoApproveTimesheets) {
                update.status = "autoApproved";
                update.autoApprovedAt = new Date().toISOString().slice(0, 10);
            }
        } else if (status == "approved") {
            update.status = "approved";
            update.approvedBy = req.userId
            update.approvedAt = new Date().toISOString().slice(0, 10);
        } else if (status == "rejected") {
            update.status = "rejected";
            update.rejectedAt = new Date().toISOString().slice(0, 10);
            update.rejectedBy = req.userId
        }
        await TimesheetModel.findByIdAndUpdate(timeSheetId, update, { new: true });
        SUCCESS(res, 200, "Time log updated successfully", { data: {} });
    } catch (error) {
        console.log("error in updateTimeLog", error);
        next(error);
    }
};

const addNote = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const note = await NotesModel.create(req.body);
        SUCCESS(res, 200, "Time log updated successfully", { data: {} });
    } catch (error) {
        console.log("error in updateTimeLog", error);
        next(error);
    }
};
const updateNote = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { noteId } = req.params;
        await NotesModel.findByIdAndUpdate(noteId, req.body, { new: true });
        SUCCESS(res, 200, "Time log updated successfully", { data: {} });
    } catch (error) {
        console.log("error in updateTimeLog", error);
        next(error);
    }
};
const deleteNote = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { noteId } = req.params;
        await NotesModel.findByIdAndDelete(noteId);
        SUCCESS(res, 200, "Time log updated successfully", { data: {} });
    } catch (error) {
        console.log("error in updateTimeLog", error);
        next(error);
    }
};

export default { addTimesheet, getAllTimesheets, getTimesheet, getAllTimeLogs, addTimeLog, updateTimeLog, deleteTimeLog, chanegTimeSheetStatus, addNote, updateNote, deleteNote };