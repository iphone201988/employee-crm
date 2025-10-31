import mongoose, { Schema, Document } from 'mongoose';


const InvoiceLogSchema: Schema = new Schema(
    {
        invoiceId: {
            type: Schema.Types.ObjectId,
            ref: 'Invoice',
        },
        companyId: {
            type: Schema.Types.ObjectId,
            ref: 'Company',
        },
        action: {
            type: String,
        },
        amount: { type: Number },
        date: { type: Date, default: Date.now },
        notes: { type: String },
        performedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    }
);

// Indexes for better performance
InvoiceLogSchema.index({ companyId: 1 });
InvoiceLogSchema.index({ invoiceId: 1 });
InvoiceLogSchema.index({ performedBy: 1 });
InvoiceLogSchema.index({ date: 1 });

export const InvoiceLogModel = mongoose.model('InvoiceLog', InvoiceLogSchema);
