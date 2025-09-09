import mongoose, { Document, Schema } from 'mongoose';

export interface IDepartmentCategory extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
}

const departmentSchema = new Schema<IDepartmentCategory>({
  name: {
    type: String,
    required: true,
  }
});

export const DepartmentCategoryModel = mongoose.model<IDepartmentCategory>('departmentcategory', departmentSchema);
