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
        const { weekStart, weekEnd, timeEntries, ...otherData } = req.body;

        let timesheet = await TimesheetModel.findOne({ weekStart, weekEnd, userId });
        if (timesheet) {
            Object.assign(timesheet, otherData);
            await timesheet.save();
        } else {
            timesheet = await TimesheetModel.create({ weekStart, weekEnd, userId, ...otherData });
        }

        const timeEntriesIds: any = [];
        if (timeEntries?.length > 0) {
            for (const timeEntry of timeEntries) {
                timeEntry.timesheetId = timesheet._id;
                timeEntry.userId = timesheet?.userId || userId;

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

const updateTimesheet = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { timesheetId } = req.params;
        await TimesheetModel.findByIdAndUpdate(timesheetId, req.body, { new: true });
        SUCCESS(res, 200, "Timesheet updated successfully", { data: {} });
    } catch (error) {
        console.log("error in updateTimesheet", error);
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
            status = "", // "Not Submitted", "For Review", "Rejected", "Approved"
            weekStart = "",
            weekEnd = "",
            userId = "",
        } = req.query;

        const pageNum = Math.max(1, parseInt(page as string));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)));
        const skip = (pageNum - 1) * limitNum;

        // Build match query
        const matchQuery: any = {};

        if (search) {
            // Search in user name - will be handled in lookup pipeline
            matchQuery.searchTerm = search;
        }

        if (status) {
            matchQuery.status = status;
        }

        if (userId) {
            matchQuery.userId = ObjectId(userId);
        }

        if (weekStart || weekEnd) {
            matchQuery.weekstart = {};
            if (weekStart) matchQuery.weekstart.$gte = new Date(weekStart as string);
            if (weekEnd) matchQuery.weekstart.$lte = new Date(weekEnd as string);
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
                                capacity: 1, // Assuming user has capacity field
                                avatar: 1
                            }
                        }
                    ]
                }
            },
            { $unwind: '$user' },

            // Apply search filter after user lookup
            ...(search ? [{
                $match: {
                    $or: [
                        { 'user.name': { $regex: search, $options: 'i' } },
                        { 'user.email': { $regex: search, $options: 'i' } }
                    ]
                }
            }] : []),

            // Add calculated fields
            {
                $addFields: {
                    // Calculate total hours for the week
                    weekTotalHours: {
                        $add: [
                            '$totalLoggedHours.monday',
                            '$totalLoggedHours.tuesday',
                            '$totalLoggedHours.wednesday',
                            '$totalLoggedHours.thursday',
                            '$totalLoggedHours.friday',
                            '$totalLoggedHours.saturday',
                            '$totalLoggedHours.sunday'
                        ]
                    },

                    // Calculate variance (difference between capacity and logged hours)
                    weekVariance: {
                        $subtract: [
                            '$totalLoggedHours.total',
                            { $ifNull: ['$user.capacity', 35] } // Default capacity 35 hours
                        ]
                    },

                    // Format dates
                    formattedWeekStart: {
                        $dateToString: {
                            format: '%d/%m/%Y',
                            date: '$weekstart'
                        }
                    },

                    // Determine submission status
                    submissionStatus: {
                        $switch: {
                            branches: [
                                { case: { $eq: ['$status', 'approved'] }, then: 'Approved' },
                                { case: { $eq: ['$status', 'rejected'] }, then: 'Rejected' },
                                { case: { $eq: ['$status', 'submitted'] }, then: 'For Review' },
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
                                userName: '$user.name',
                                userEmail: '$user.email',
                                userAvatar: '$user.avatar',
                                capacity: { $ifNull: ['$user.capacity', 35] },
                                weekstart: 1,
                                weekend: 1,
                                formattedWeekStart: 1,
                                status: 1,
                                submissionStatus: 1,
                                totalHours: '$weekTotalHours',
                                variance: '$weekVariance',
                                billableHours: '$billableHours.total',
                                nonBillableHours: '$nonBillableHours.total',
                                submittedAt: 1,
                                approvedAt: 1,
                                rejectedAt: 1,
                                entries: { $size: { $ifNull: ['$entries', []] } } // Count of entries
                            }
                        }
                    ],

                    // Get summary statistics
                    summary: [
                        {
                            $group: {
                                _id: '$submissionStatus',
                                count: { $sum: 1 }
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
            notSubmitted: 0
        };

        summaryData.forEach((item: any) => {
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
                    summary.notSubmitted = item.count;
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
                hasNextPage: pageNum < totalPages,
                hasPrevPage: pageNum > 1
            },
            summary,
            filters: {
                search,
                status,
                weekStart,
                weekEnd,
            }
        });

    } catch (error) {
        console.error("Error in getTimesheets:", error);
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


export default { addTimesheet, updateTimesheet, getAllTimesheets, getTimesheet };