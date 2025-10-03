import { NextFunction, Request, Response } from "express";

import { SUCCESS } from "../utils/response";
import { TimesheetModel } from "../models/Timesheet";
import { BadRequestError } from "../utils/errors";
import { findUserById, ObjectId } from "../utils/utills";
import { TimeEntryModel } from "../models/TimeEntry";
import { ClientModel } from "../models/Client";
import { JobModel } from "../models/Job";
import { JobCategoryModel } from "../models/JobCategory";

const addTimesheet = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const userId = req.userId;
        const companyId = req.user.companyId;
        const { weekStart, weekEnd, timeEntries, isbillable, ...otherData } = req.body;

        let timesheet = await TimesheetModel.findOne({ weekStart, weekEnd, userId, isbillable });
        if (timesheet) {
            Object.assign(timesheet, otherData);
        } else {
            timesheet = await TimesheetModel.create({ weekStart, weekEnd, userId, isbillable, companyId, ...otherData });
        }

        const timeEntriesIds: any = [];
        if (timeEntries?.length > 0) {
            for (const timeEntry of timeEntries) {
                timeEntry.timesheetId = timesheet._id;
                timeEntry.userId = timesheet?.userId || userId;
                timeEntry.companyId = timesheet?.companyId || companyId;

                // Use proper filter for upsert
                const data = await TimeEntryModel.findOneAndUpdate(
                    {
                        timesheetId: timesheet._id,
                        clientId: timeEntry.clientId,
                        jobId: timeEntry.jobId,
                        timeCategoryId: timeEntry.timeCategoryId
                    },
                    timeEntry,
                    {
                        upsert: true,
                        new: true // Return the updated/created document
                    }
                );

                if (data) {
                    timeEntriesIds.push(data._id);
                }
            }
        }

        timesheet.timeEntries = timeEntriesIds;
        await timesheet.save();

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
                billableRate: user?.billableRate,
            });
    } catch (error) {
        console.error("Error in getTimesheet:", error);
        next(error);
    }
};


export default { addTimesheet, getAllTimesheets, getTimesheet };