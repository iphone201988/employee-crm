import mongoose, { Document, Schema } from 'mongoose';

export interface INotes extends Document {
    _id: mongoose.Types.ObjectId;
    timesheetId?: mongoose.Types.ObjectId;
    clientId?: mongoose.Types.ObjectId;
    jobId?: mongoose.Types.ObjectId;
    createdBy: mongoose.Types.ObjectId;
    note: string;
    createdAt: Date;
    updatedAt: Date;
}

const noteSchema = new Schema<INotes>({
    timesheetId: { type: Schema.Types.ObjectId, ref: 'Timesheet', required: false },
    clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: false },
    jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    note: {
        type: String,
        required: true,
    },
}, { timestamps: true });

noteSchema.index({ timesheetId: 1 }, { sparse: true });
noteSchema.index({ clientId: 1 }, { sparse: true });
noteSchema.index({ jobId: 1 }, { sparse: true });
noteSchema.index({ createdBy: 1 });

noteSchema.pre('validate', function(next) {
    if (!this.timesheetId && !this.clientId && !this.jobId) {
        this.invalidate('timesheetId', 'Either timesheetId, clientId, or jobId must be provided');
    }
    next();
});

export const NotesModel = mongoose.model<INotes>('Notes', noteSchema);
