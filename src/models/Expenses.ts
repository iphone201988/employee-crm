import mongoose, { Schema, Document } from 'mongoose';

export interface IExpenses extends Document {
    date: Date;
    companyId: mongoose.Types.ObjectId;
    submittedBy: mongoose.Types.ObjectId;
    type: string;
    clientId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    expreseCategory: string;
    description: string;
    netAccount: number;
    vatPercentage: number;
    vatAccount: number;
    totalAmount: number;
    status: 'yes' | 'no';
    attachments: string[];
    createdAt: Date;
    updatedAt: Date;
}

const ExpensesSchema: Schema = new Schema<IExpenses>(
    {
        date: {
            type: Date,
            required: true,
        },
        companyId: {
            type: Schema.Types.ObjectId,
            ref: 'Company',
        },
        submittedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },
        type: {
            type: String,
        },
        clientId: {
            type: Schema.Types.ObjectId,
            ref: 'Client',
        },
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },
        expreseCategory: {
            type: String,
        },
        description: {
            type: String,
        },
        netAccount: {
            type: Number,
        },
        vatPercentage: {
            type: Number,
        },
        vatAccount: {
            type: Number,
        },
        totalAmount: {
            type: Number,
        },
        status: {
            type: String,
        },
        attachments: [String],
    }, {
    timestamps: true,
}
);

// Indexes for better performance
ExpensesSchema.index({ companyId: 1 });
ExpensesSchema.index({ submittedBy: 1 });
ExpensesSchema.index({ clientId: 1 });
ExpensesSchema.index({ userId: 1 });
ExpensesSchema.index({ createdAt: 1 });
ExpensesSchema.index({ status: 1 });
ExpensesSchema.index({ date: 1 });

export const ExpensesModel = mongoose.model<IExpenses>('Expenses', ExpensesSchema);
