import mongoose, { Document, Schema } from 'mongoose';

export interface IServicesCategory extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  companyId: mongoose.Types.ObjectId;
}

const serviceSchema = new Schema<IServicesCategory>({
  name: {
    type: String,
    required: true,
  },
   companyId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
});

export const ServicesCategoryModel = mongoose.model<IServicesCategory>('servicesCategory', serviceSchema);
