import mongoose, { Schema, Document } from 'mongoose';

export interface IClient extends Document {
  clientRef: string;
  clientName: string;
  businessTypeId: Schema.Types.ObjectId;
  taxNumber: string;
  croNumber?: string;
  address: string;
  contactName: string;
  email: string;
  emailNote?: string;
  phone: string;
  phoneNote?: string;
  onboardedDate: Date;
  amlCompliant: boolean;
  audit: boolean;
  status: string;
  services: Schema.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const ClientSchema: Schema = new Schema<IClient>(
  {
    clientRef: {
      type: String,
      required: true,
      trim: true,
    },
    clientName: {
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
      required: true,
      trim: true,
    },
    croNumber: {
      type: String,
      default: '',
      trim: true,
    },
    address: {
      type: String,
      required: true,
    },
    contactName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    emailNote: {
      type: String,
      default: '',
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    phoneNote: {
      type: String,
      default: '',
      trim: true,
    },
    onboardedDate: {
      type: Date,
      required: true,
    },
    amlCompliant: {
      type: Boolean,
      default: false,
    },
    audit: {
      type: Boolean,
      default: false,
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
  },
  {
    timestamps: true,
  }
);

export const ClientModel = mongoose.model<IClient>('Client', ClientSchema);
