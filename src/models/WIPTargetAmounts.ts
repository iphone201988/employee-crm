import mongoose, { Document, Schema } from 'mongoose';

export interface IWipTragetAmounts extends Document {
  _id: mongoose.Types.ObjectId;
  amount: number;
  companyId: mongoose.Types.ObjectId;
}

const wipTragetAmountSchema = new Schema<IWipTragetAmounts>({
  amount: {
    type: Number,
    required: true,
  },
  companyId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
});

export const WipTragetAmountsModel = mongoose.model<IWipTragetAmounts>('WipTragetAmounts', wipTragetAmountSchema);
