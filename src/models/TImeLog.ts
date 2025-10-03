import mongoose, { Schema, Document } from 'mongoose';

export interface ITimeLog extends Document {
    date: Date;
    clientId: Schema.Types.ObjectId;
    jobId: Schema.Types.ObjectId;
    timeCategoryId: Schema.Types.ObjectId;
    teamName: string;
    description: string;
    timePurpose: string;
    billable: boolean;
    duration: string;  // You might store this as a string or in a specific time format
    billableRate: number;
    status: 'Not Invoiced' | 'Invoiced' | 'Paid';
    createdAt: Date;
    updatedAt: Date;
}

const TimeLogSchema: Schema = new Schema<ITimeLog>(
    {
        date: {
            type: Date,
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
        teamName: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            required: true,
            trim: true,
        },
        timePurpose: {
            type: String,
            required: true,
            trim: true,
        },
        billable: {
            type: Boolean,
            required: true,
        },
        duration: {
            type: String,
            required: true, // You can change this to a time type or a specific duration format if needed
        },
        billableRate: {
            type: Number,
            required: true,
            min: 0,
        },
        status: {
            type: String,
            enum: ['Not Invoiced', 'Invoiced', 'Paid'],
            default: 'Not Invoiced',
        },
    },
    {
        timestamps: true, // Automatically adds createdAt and updatedAt fields
    }
);

export const TimeLogModel = mongoose.model<ITimeLog>('TimeLog', TimeLogSchema);
