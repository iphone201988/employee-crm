import mongoose, { Document, Schema } from 'mongoose';

export interface INotes extends Document {
    _id: mongoose.Types.ObjectId;
    timesheetId: mongoose.Types.ObjectId;
    createdBy: mongoose.Types.ObjectId;
    note: string;
    createdAt: Date;
    updatedAt: Date;
}

const noteSchema = new Schema<INotes>({
    timesheetId: { type: Schema.Types.ObjectId, ref: 'Timesheet', required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    note: {
        type: String,
        required: true,
    },
}, { timestamps: true });
noteSchema.index({ timesheetId: 1, createdBy: 1 });

export const NotesModel = mongoose.model<INotes>('Notes', noteSchema);
