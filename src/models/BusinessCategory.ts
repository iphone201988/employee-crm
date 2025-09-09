import mongoose, { Document, Schema } from 'mongoose';

export interface IBusinessCategory extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
}

const businessCategorySchema = new Schema<IBusinessCategory>({
  name: {
    type: String,
    required: true,
  }
});

export const BusinessCategoryModel = mongoose.model<IBusinessCategory>('BusinessCategory', businessCategorySchema);
