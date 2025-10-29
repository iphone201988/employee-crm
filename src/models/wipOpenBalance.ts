import mongoose, { Document, Schema } from 'mongoose';


const wipOpenBalancetSchema = new Schema({
  amount: {
    type: Number,
    required: true,
  },
  clientId: { type: Schema.Types.ObjectId, ref: 'Client', },
  jobId: { type: Schema.Types.ObjectId, ref: 'Job', },
  type: { type: String, required: true },
  companyId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: {
    type: String,
    enum: ['notInvoiced', 'invoiced', 'paid'],
    default: 'notInvoiced',
  },
  createdAt: { type: Date, default: Date.now },
});

export const WipOpenBalanceModel = mongoose.model('WipOpenBalance', wipOpenBalancetSchema);
