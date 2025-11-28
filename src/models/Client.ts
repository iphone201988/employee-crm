import mongoose, { Schema, Document } from 'mongoose';

export interface IClient extends Document {
  companyId: Schema.Types.ObjectId;
  clientRef: string;
  name: string;
  businessTypeId: Schema.Types.ObjectId;
  taxNumber?: string;
  croNumber?: string;
  croLink?: string;
  clientManagerId?: Schema.Types.ObjectId;
  address: string;
  email?: string;
  emailNote?: string;
  phone: string;
  phoneNote?: string;
  onboardedDate: Date;
  amlCompliant: boolean;
  audit: boolean;
  clientStatus: string;
  yearEnd?: string;
  arDate?: Date;
  status: string;
  services: Schema.Types.ObjectId[];
  jobCategories: Schema.Types.ObjectId[];
  wipTargetId: Schema.Types.ObjectId;
  wipBalance?: number;
  importedWipDate?: Date | null;
  debtorsBalance?: number;
  debtorsDate?: Date | null;
  createdAt: Date;
  updatedAt: Date;

}

const ClientSchema: Schema = new Schema<IClient>(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
    },
    clientRef: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    businessTypeId: {
      type: Schema.Types.ObjectId,
      ref: 'BusinessCategory',
    },
    taxNumber: {
      type: String,
      trim: true,
      default: '',
    },
    croNumber: {
      type: String,
      default: '',
      trim: true,
    },
    croLink: {
      type: String,
      default: '',
      trim: true,
    },
    clientManagerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    address: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: false,
      lowercase: true,
      trim: true,
      default: '',
    },
    emailNote: {
      type: String,
      default: '',
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    phoneNote: {
      type: String,
      default: '',
      trim: true,
    },
    onboardedDate: {
      type: Date,
      required: false,
      default: null,
    },
    amlCompliant: {
      type: Boolean,
      default: false,
    },
    audit: {
      type: Boolean,
      default: false,
    },
    clientStatus: {
      type: String,
      enum: ['Prospect', 'Current', 'Archived'],
      default: 'Current',
    },
    yearEnd: {
      type: String,
      default: '',
      trim: true,
    },
    arDate: {
      type: Date,
    },
    status: {
      type: String,
      default: 'active',
    },
    services: [
      {
        type: Schema.Types.ObjectId,
        ref: 'servicesCategory',
      },
    ],
    jobCategories: [
      {
        type: Schema.Types.ObjectId,
        ref: 'JobCategory',
      },
    ],
    wipTargetId: {
      type: Schema.Types.ObjectId,
      ref: 'WipTragetAmounts',
    },
    wipBalance: {
      type: Number,
      default: 0,
    },
    importedWipDate: {
      type: Date,
      default: null,
    },
    debtorsBalance: {
      type: Number,
      default: 0,
    },
    debtorsDate: {
      type: Date,
      default: null,
    }
  },
  {
    timestamps: true,
  }
);
ClientSchema.index({ companyId: 1 });
export const ClientModel = mongoose.model<IClient>('Client', ClientSchema);
