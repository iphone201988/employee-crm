import mongoose, { Document, Schema } from 'mongoose';

export interface IServicesCategory extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
}

const serviceSchema = new Schema<IServicesCategory>({
  name: {
    type: String,
    required: true,
  }
});

export const ServicesCategoryModel = mongoose.model<IServicesCategory>('servicesCategory', serviceSchema);
