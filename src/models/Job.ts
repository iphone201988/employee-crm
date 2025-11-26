import mongoose, { Schema, Document } from 'mongoose';

export interface IJob extends Document {
    companyId: mongoose.Types.ObjectId;
    name: string;
    clientId: mongoose.Types.ObjectId;
    jobTypeId: mongoose.Types.ObjectId;
    jobManagerId: mongoose.Types.ObjectId;
    startDate: Date;
    endDate: Date;
    jobCost: number;
    teamMembers: mongoose.Types.ObjectId[];
    status: 'queued' | 'awaitingRecords' | 'inProgress' | 'withClient' | 'forApproval' | 'completed';
    description: string;
    createdBy: mongoose.Types.ObjectId;
    priority: 'high' | 'medium' | 'low' | 'urgent';
    wipTargetId: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const JobSchema: Schema = new Schema<IJob>(
    {
        companyId: {
            type: Schema.Types.ObjectId,
            ref: 'Company',
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        clientId: {
            type: Schema.Types.ObjectId,
            ref: 'Client',
            required: true,
        },
        jobTypeId: {
            type: Schema.Types.ObjectId,
            ref: 'JobCategory',
            required: true,
        },
        jobManagerId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        startDate: {
            type: Date,
            required: true,
        },
        endDate: {
            type: Date,
            required: true,
        },
        jobCost: {
            type: Number,
            required: true,
            min: 0,
        },
        teamMembers: [{
            type: Schema.Types.ObjectId,
            ref: 'User',
        }],
        status: {
            type: String,
            enum: ['queued', 'awaitingRecords', 'inProgress', 'withClient', 'forApproval', 'completed'],
            default: 'queued',
            required: true,
        },
        description: {
            type: String,
            trim: true,
            default: '',
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        priority: {
            type: String,
            enum: ['low', 'medium', 'high', 'urgent'],
            default: 'low',
        },
        wipTargetId: {
            type: Schema.Types.ObjectId,
            ref: 'WipTragetAmounts',
        }
    },
    {
        timestamps: true,
    }
);

// Indexes for better performance
JobSchema.index({ companyId: 1 });
JobSchema.index({ clientId: 1 });
JobSchema.index({ jobManagerId: 1 });
JobSchema.index({ status: 1 });
JobSchema.index({ startDate: 1, endDate: 1 });
JobSchema.index({ teamMembers: 1 });

export const JobModel = mongoose.model<IJob>('Job', JobSchema);
