import mongoose, { Document, Schema } from 'mongoose';

export interface IJobCategory extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
}

const serviceSchema = new Schema<IJobCategory>({
  name: {
    type: String,
    required: true,
  }
});

export const JobCategoryModel = mongoose.model<IJobCategory>('JobCategory', serviceSchema);
