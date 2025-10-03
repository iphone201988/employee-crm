import mongoose, { Schema } from "mongoose";

const timesheetSchema = new mongoose.Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    weekStart: {
        type: Date,
        required: true,
    },
    weekEnd: {
        type: Date,
        required: true,
    },
    status: {
        type: String,
        required: true,
        default: "daft"
    },
    timeEntries: [{ type: Schema.Types.ObjectId, ref: 'TimeEntry' }],
    dailySummary: [{
        date: Date,
        billable: Number,         // in minutes
        nonBillable: Number,      // in minutes
        totalLogged: Number,      // billable + nonBillable
        capacity: Number,         // e.g. 480 minutes (8h)
        variance: Number          // capacity - totalLogged
    }],
    totalBillable: Number,
    totalNonBillable: Number,
    totalLogged: Number,
    totalCapacity: Number,
    totalVariance: Number,
    submittedAt: Date,
    submittedBy: { type: Schema.Types.ObjectId, ref: 'User' },

    reviewedAt: Date,
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },

    approvedAt: Date,
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },

    rejectedAt: Date,
    rejectedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: String,
}, { timestamps: true, });

export const TimesheetModel = mongoose.model('Timesheet', timesheetSchema);