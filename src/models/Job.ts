import mongoose, { Schema, Document } from 'mongoose';

export interface IJob extends Document {
    name: string;
    clientId: mongoose.Types.ObjectId;
    jobTypeId: mongoose.Types.ObjectId;
    jobManagerId: mongoose.Types.ObjectId;
    startDate: Date;
    endDate: Date;
    estimatedCost: number;
    actualCost: number;
    teamMembers: mongoose.Types.ObjectId[];
    status: 'queued' | 'inProgress' | 'withClient' | 'forApproval' | 'completed' | 'cancelled';
    description: string;
    createdBy: mongoose.Types.ObjectId;
    priority: 'high' | 'medium' | 'low' | 'urgent';
    createdAt: Date;
    updatedAt: Date;
}

const JobSchema: Schema = new Schema<IJob>(
    {
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
        estimatedCost: {
            type: Number,
            required: true,
            min: 0,
        },
        actualCost: {
            type: Number,
            default: 0,
            min: 0,
        },
        teamMembers: [{
            type: Schema.Types.ObjectId,
            ref: 'User',
        }],
        status: {
            type: String,
            enum: ['queued', 'inProgress', 'withClient', 'forApproval', 'completed', 'cancelled'],
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
        }
    },
    {
        timestamps: true,
    }
);

// Indexes for better performance
JobSchema.index({ clientId: 1 });
JobSchema.index({ jobManagerId: 1 });
JobSchema.index({ status: 1 });
JobSchema.index({ startDate: 1, endDate: 1 });
JobSchema.index({ teamMembers: 1 });

export const JobModel = mongoose.model<IJob>('Job', JobSchema);
