import mongoose, { Document, Schema } from 'mongoose';

export interface IDebtorsOpenBalance extends Document {
  amount: number;
  clientId: Schema.Types.ObjectId;
  jobId?: Schema.Types.ObjectId;
  type: string;
  companyId: Schema.Types.ObjectId;
  status: 'outstanding' | 'paid' | 'writtenOff';
  referenceNumber?: string;
  notes?: string;
  createdAt: Date;
  performedBy: Schema.Types.ObjectId;
}

const debtorsOpenBalanceSchema = new Schema<IDebtorsOpenBalance>({
  amount: {
    type: Number,
    required: true,
  },
  clientId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Client',
    required: true,
  },
  jobId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Job',
  },
  type: { 
    type: String, 
    required: true,
    enum: ['debit', 'credit', 'adjustment'],
    default: 'debit',
  },
  companyId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Company', 
    required: true 
  },
  status: {
    type: String,
    enum: ['outstanding', 'paid', 'writtenOff'],
    default: 'outstanding',
  },
  referenceNumber: {
    type: String,
    trim: true,
  },
  notes: {
    type: String,
    trim: true,
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  performedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
});

// Indexes for better performance
debtorsOpenBalanceSchema.index({ companyId: 1 });
debtorsOpenBalanceSchema.index({ clientId: 1 });
debtorsOpenBalanceSchema.index({ status: 1 });
debtorsOpenBalanceSchema.index({ createdAt: 1 });

export const DebtorsOpenBalanceModel = mongoose.model<IDebtorsOpenBalance>('DebtorsOpenBalance', debtorsOpenBalanceSchema);

