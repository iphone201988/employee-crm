import mongoose, { Document, Schema } from 'mongoose';
const settingSchema = new Schema({
    companyId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    autoApproveTimesheets: {
        type: Boolean,
        default: false,
    },
    wipWarningPercentage: {
        type: Number,
        default: 50
    }
});

export const SettingModel = mongoose.model('Setting', settingSchema);
