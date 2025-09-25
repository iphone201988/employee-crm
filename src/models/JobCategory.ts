import mongoose, { Document, Schema } from 'mongoose';

export interface IJobCategory extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  companyId: mongoose.Types.ObjectId;
}

const serviceSchema = new Schema<IJobCategory>({
  name: {
    type: String,
    required: true,
  },
  companyId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
});

export const JobCategoryModel = mongoose.model<IJobCategory>('JobCategory', serviceSchema);
