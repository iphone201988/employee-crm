import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
    _id: mongoose.Types.ObjectId;
    name: string;
    email: string;
    password?: string;
    status: 'active' | 'inactive' | 'pending';
    avatarUrl?: string;
    role: 'superadmin' | 'team';
    departmentId: mongoose.Types.ObjectId;
    hourlyRate: number;
    billableRate: number;
    accounts: number;
    audits: number;
    bookkeeping: number;
    payroll: number;
    vat: number;
    companySecretarial: number;
    cgt: number;
    workSchedule: {
        monday:{
            type: Number,
            default: 0
        };
        tuesday: {
            type: Number,
            default: 0
        };
        wednesday: {
            type: Number,
            default: 0
        };
        thursday: {
            type: Number,
            default: 0
        };
        friday: {
            type: Number,
            default: 0
        };
        saturday: {
            type: Number,
            default: 0
        };
        sunday: {
            type: Number,
            default: 0
        };
    };
    jti: string;
    deviceToken: string;
    deviceType: string;
    createdAt: Date;
    updatedAt: Date;
}

const userSchema = new Schema<IUser>({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    email: {
        type: String,
        required: true,
        lowercase: true,
    },
    password: {
        type: String,
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'lock'],
        default: 'active',
    },
    avatarUrl: String,
    role: {
        type: String,
        enum: ['superAdmin', 'team'],
    },
    departmentId: {
        type: Schema.Types.ObjectId,
        ref: 'Department',
        required: true,
    },
    hourlyRate: {
        type: Number,
        default: 0,
    },
    billableRate: {
        type: Number,
        default: 0,
    },
    accounts: {
        type: Number,
        default: 0
    },
    audits: {
        type: Number,
        default: 0
    },
    bookkeeping: {
        type: Number,
        default: 0
    },
    payroll: {
        type: Number,
        default: 0
    },
    vat: {
        type: Number,
        default: 0
    },
    companySecretarial: {
        type: Number,
        default: 0
    },
    cgt: {
        type: Number,
        default: 0
    },
    workSchedule: {
        monday: { type: Number, default: 0,  },
        tuesday: { type: Number, default: 0,  },
        wednesday: { type: Number, default: 0, },
        thursday: { type: Number, default: 0, },
        friday: { type: Number, default: 0,},
        saturday: { type: Number, default: 0, },
        sunday: { type: Number, default: 0,  }
    },
    jti: String,
    deviceToken: String,
    deviceType: Number
}, {
    timestamps: true,
});

userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ departmentId: 1 });

export const UserModel = mongoose.model<IUser>('User', userSchema);
