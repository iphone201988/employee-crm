import mongoose, { Document, Schema } from 'mongoose';

export interface ITimeCategory extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  companyId: mongoose.Types.ObjectId;
}

const timeCategorySchema = new Schema<ITimeCategory>({
  name: {
    type: String,
    required: true,
  },
  companyId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
});

export const TimeCategoryModel = mongoose.model<ITimeCategory>('TimeCategory', timeCategorySchema);
