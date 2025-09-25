import mongoose, { Document, Schema } from 'mongoose';

export interface IBusinessCategory extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  companyId: mongoose.Types.ObjectId;

}

const businessCategorySchema = new Schema<IBusinessCategory>({
  name: {
    type: String,
    required: true,
  },
  companyId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
});

export const BusinessCategoryModel = mongoose.model<IBusinessCategory>('BusinessCategory', businessCategorySchema);
