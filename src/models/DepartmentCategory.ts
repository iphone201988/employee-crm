import mongoose, { Document, Schema } from 'mongoose';

export interface IDepartmentCategory extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  companyId: mongoose.Types.ObjectId;
}

const departmentSchema = new Schema<IDepartmentCategory>({
  name: {
    type: String,
    required: true,
  },
  companyId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
});

export const DepartmentCategoryModel = mongoose.model<IDepartmentCategory>('departmentcategory', departmentSchema);
