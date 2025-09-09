import mongoose, { Document, Schema } from 'mongoose';

export interface ITimeCategory extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
}

const timeCategorySchema = new Schema<ITimeCategory>({
  name: {
    type: String,
    required: true,
  }
});

export const TimeCategoryModel = mongoose.model<ITimeCategory>('TimeCategory', timeCategorySchema);
