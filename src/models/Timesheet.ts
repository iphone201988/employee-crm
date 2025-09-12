import mongoose, { Schema } from "mongoose";

const timesheetSchema = new mongoose.Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    weekstart: {
        type: Date,
        required: true,
    },
    weekend: {
        type: Date,
        required: true,
    },
    status: {
        type: String,
        required: true,
        default: "daft"
    },
    entries: [{
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
        decsription: {
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
        dailyHours: {
            monday: { type: Number, default: 0, min: 0, max: 24 },
            tuesday: { type: Number, default: 0, min: 0, max: 24 },
            wednesday: { type: Number, default: 0, min: 0, max: 24 },
            thursday: { type: Number, default: 0, min: 0, max: 24 },
            friday: { type: Number, default: 0, min: 0, max: 24 },
            saturday: { type: Number, default: 0, min: 0, max: 24 },
            sunday: { type: Number, default: 0, min: 0, max: 24 }
        },
        totalHours: { type: Number, default: 0 },
        totalAmount: { type: Number, default: 0 },
    }],
    billableHours: {
        monday: { type: Number, default: 0 },
        tuesday: { type: Number, default: 0 },
        wednesday: { type: Number, default: 0 },
        thursday: { type: Number, default: 0 },
        friday: { type: Number, default: 0 },
        saturday: { type: Number, default: 0 },
        sunday: { type: Number, default: 0 },
        total: { type: Number, default: 0 }
    },

    nonBillableHours: {
        monday: { type: Number, default: 0 },
        tuesday: { type: Number, default: 0 },
        wednesday: { type: Number, default: 0 },
        thursday: { type: Number, default: 0 },
        friday: { type: Number, default: 0 },
        saturday: { type: Number, default: 0 },
        sunday: { type: Number, default: 0 },
        total: { type: Number, default: 0 }
    },

    totalLoggedHours: {
        monday: { type: Number, default: 0 },
        tuesday: { type: Number, default: 0 },
        wednesday: { type: Number, default: 0 },
        thursday: { type: Number, default: 0 },
        friday: { type: Number, default: 0 },
        saturday: { type: Number, default: 0 },
        sunday: { type: Number, default: 0 },
        total: { type: Number, default: 0 }
    },
    variance: {
        monday: { type: Number, default: 0 },
        tuesday: { type: Number, default: 0 },
        wednesday: { type: Number, default: 0 },
        thursday: { type: Number, default: 0 },
        friday: { type: Number, default: 0 },
        saturday: { type: Number, default: 0 },
        sunday: { type: Number, default: 0 },
        total: { type: Number, default: 0 }
    },
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