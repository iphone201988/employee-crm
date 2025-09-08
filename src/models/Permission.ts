import mongoose, { Document, Schema } from 'mongoose';

export interface IPermission extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  approveTimesheets: boolean;
  editServices: boolean;
  editJobBuilder: boolean;
  editJobTemplates: boolean;
}

const permissionSchema = new Schema<IPermission>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  approveTimesheets: {
    type: Boolean,
    default: false,
  },
  editServices	: {
    type: Boolean,
    default: false,
  },
  editJobBuilder	: {
    type: Boolean,
    default: false,
  },
  editJobTemplates: {
    type: Boolean,
    default: false,
  },
});

export const PermissionModel = mongoose.model<IPermission>('Permission', permissionSchema);
