import mongoose, { Schema, Document } from 'mongoose';

export interface ITimeLog extends Document {
    date: Date;
    companyId: Schema.Types.ObjectId;
    timeEntrieId: Schema.Types.ObjectId;
    clientId: Schema.Types.ObjectId;
    jobId: Schema.Types.ObjectId;
    jobTypeId: Schema.Types.ObjectId;
    timeCategoryId: Schema.Types.ObjectId;
    userId: Schema.Types.ObjectId; 
    description: string;
    billable: boolean;
    duration: number;  
    rate: number;
    status: string;
    amount: number;
    createdAt: Date;
    updatedAt: Date;
}

const TimeLogSchema: Schema = new Schema<ITimeLog>(
    {
        date: {
            type: Date,
            required: true,
        },
        timeEntrieId: {
            type: Schema.Types.ObjectId,
            ref: 'TimeEntry',
        },
        companyId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
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
        jobTypeId: {
            type: Schema.Types.ObjectId,
            ref: 'JobCategory',
        },
        timeCategoryId: {
            type: Schema.Types.ObjectId,
            ref: 'TimeCategory',
            required: true,
        },
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        description: {
            type: String,
            trim: true,
        },
        billable: {
            type: Boolean,
            required: true,
        },
        duration: {
            type: Number,
            required: true, 
        },
        rate: {
            type: Number,
            required: true,
            min: 0,
        },
        amount: {
            type: Number,
            min: 0,
            default: 0

        },
        status: {
            type: String,
            enum: ['notInvoiced', 'invoiced', 'paid'],
            default: 'notInvoiced',
        },
    },
    {
        timestamps: true, 
    }
);

export const TimeLogModel = mongoose.model<ITimeLog>('TimeLog', TimeLogSchema);
