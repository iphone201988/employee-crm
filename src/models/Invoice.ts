import mongoose, { Schema, Document } from 'mongoose';


const InvoiceSchema: Schema = new Schema(
    {   invoiceNo: {
            type: String,
            required: true,
        },
        date: {
            type: Date,
            required: true,
        },
        companyId: {
            type: Schema.Types.ObjectId,
            ref: 'Company',
        },
        invoiceCreatedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },
        clientId: {
            type: Schema.Types.ObjectId,
            ref: 'Client',
        },
        netAmount: {
            type: Number,
            default: 0,
        },
        vatPercentage: {
            type: Number,
            default: 0,
        },
        vatAmount: {
            type: Number,
            default: 0,
        },
        expenseAmount: {
            type: Number,
            default: 0,
        },
        originaltotalAmount: {
             type: Number,
            default: 0,
        },
        totalAmount: {
            type: Number,
            default: 0,
        },
        paidAmount: {
            type: Number,
            default: 0,
        },
        status: {
            type: String,
        },
        timeLogIds: [{
            type: Schema.Types.ObjectId,
            ref: 'TimeLog',
        }],
        expenseIds: [{
            type: Schema.Types.ObjectId,
            ref: 'Expenses',
        }],
        wipOpenBalanceIds: [{
            type: Schema.Types.ObjectId,
            ref: 'WipOpenBalance',
        }],
    }, {
    timestamps: true,
}
);

// Indexes for better performance
InvoiceSchema.index({ invoiceNo: 1 });
InvoiceSchema.index({ companyId: 1 });
InvoiceSchema.index({ invoiceCreatedBy: 1 });
InvoiceSchema.index({ clientId: 1 });
InvoiceSchema.index({ userId: 1 });
InvoiceSchema.index({ createdAt: 1 });
InvoiceSchema.index({ status: 1 });
InvoiceSchema.index({ date: 1 });

export const InvoiceModel = mongoose.model('Invoice', InvoiceSchema);
