import mongoose, { Document, Schema } from 'mongoose';

export interface INotification extends Document {
    _id: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    companyId: mongoose.Types.ObjectId;
    type: 'timesheet_rejected' | 'timesheet_approved' | 'other';
    title: string;
    message: string;
    timesheetId?: mongoose.Types.ObjectId;
    weekStart?: Date;
    weekEnd?: Date;
    isRead: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const notificationSchema = new Schema<INotification>({
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
    type: {
        type: String,
        enum: ['timesheet_rejected', 'timesheet_approved', 'other'],
        required: true,
    },
    title: {
        type: String,
        required: true,
    },
    message: {
        type: String,
        required: true,
    },
    timesheetId: {
        type: Schema.Types.ObjectId,
        ref: 'Timesheet',
    },
    weekStart: {
        type: Date,
    },
    weekEnd: {
        type: Date,
    },
    isRead: {
        type: Boolean,
        default: false,
    },
}, {
    timestamps: true,
});

notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ companyId: 1 });

export const NotificationModel = mongoose.model<INotification>('Notification', notificationSchema);

