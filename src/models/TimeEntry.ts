import mongoose, { Schema } from "mongoose";

const TimeEntry = new mongoose.Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    companyId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    timesheetId: {
        type: Schema.Types.ObjectId,
        ref: 'Timesheet',
        required: true,
    },
    clientId: {
        type: Schema.Types.ObjectId,
        ref: 'Client',
        required: true,
    },
    jobId: {
        type: Schema.Types.ObjectId,
        ref: 'Job',
        required: true,
    },
    timeCategoryId: {
        type: Schema.Types.ObjectId,
        ref: 'TimeCategory',
        required: true,
    },
    description: {
        type: String,
    },
    isbillable: {
        type: Boolean,
        required: true,
        default: false
    },
    rate: {
        type: Number,
    },
    logs: [{
        date: Date,
        duration: Number
    }],
    totalHours: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },


}, { timestamps: true, });

export const TimeEntryModel = mongoose.model('TimeEntry', TimeEntry);