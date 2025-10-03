import mongoose, { Document, Schema } from 'mongoose';

export interface INotes extends Document {
    _id: mongoose.Types.ObjectId;
    timesheetId: mongoose.Types.ObjectId;
    note: string;
    createdAt: Date;
    updatedAt: Date;
}

const noteSchema = new Schema<INotes>({
    timesheetId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    note: {
        type: String,
        required: true,
    },
}, { timestamps: true });

export const NotesModel = mongoose.model<INotes>('Notes', noteSchema);
