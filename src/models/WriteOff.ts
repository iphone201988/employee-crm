import mongoose, { Schema } from "mongoose";

const WriteOffTimeLogSchema = new Schema(
    {
        timeLogId: {
            type: Schema.Types.ObjectId,
            ref: 'TimeLog',
            required: true,
            index: true
        },
        writeOffAmount: {
            type: Number,
            required: true,
            min: 0
        },
        writeOffPercentage: {
            type: Number,
            required: true,
            min: 0
        },
        originalAmount: {
            type: Number,
            required: true,
            min: 0
        },
        duration: {
            type: Number,
            required: true,
            min: 0
        },
        clientId: {
            type: Schema.Types.ObjectId,
            ref: 'Client',
            required: true,
            index: true
        },
        jobId: {
            type: Schema.Types.ObjectId,
            ref: 'Job',
            required: true,
            index: true
        },
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        jobCategoryId: {
            type: Schema.Types.ObjectId,
            ref: 'JobCategory',
            required: true
        },
    },
    { _id: false } // No separate _id for embedded documents
);
const WriteOffSchema = new Schema({
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true },
    timeLogs: {
        type: [WriteOffTimeLogSchema],
        required: true,
    },
    totalWriteOffAmount: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    },
    totalOriginalAmount: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    },
    totalDuration: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    },
    reason: {
        type: String,
    },
    logic: {
        type: String,
        enum: ['proportionally', 'manually'],
        required: true,
        default: 'manually'
    },
    performedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

WriteOffSchema.index({ companyId: 1, createdAt: -1 });
WriteOffSchema.index({ companyId: 1, status: 1 });
WriteOffSchema.index({ 'timeLogs.timeLogId': 1 });
WriteOffSchema.index({ 'timeLogs.clientId': 1, createdAt: -1 });
WriteOffSchema.index({ 'timeLogs.jobId': 1, createdAt: -1 });
WriteOffSchema.index({ 'timeLogs.userId': 1, createdAt: -1 });

WriteOffSchema.pre('save', function (next) {
    if (this.timeLogs && this.timeLogs.length > 0) {
        this.totalWriteOffAmount = this.timeLogs.reduce(
            (sum, log) => sum + log.writeOffAmount,
            0
        );
        this.totalOriginalAmount = this.timeLogs.reduce(
            (sum, log) => sum + log.originalAmount,
            0
        );
        this.totalDuration = this.timeLogs.reduce(
            (sum, log) => sum + log.duration,
            0
        );
    }
    next();
});

export const WriteOffModel = mongoose.model('WriteOff', WriteOffSchema);