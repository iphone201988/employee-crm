import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
    _id: mongoose.Types.ObjectId;
    name: string;
    email: string;
    password?: string;
    status: 'active' | 'inActive';
    avatarUrl?: string;
    role: 'superadmin' | 'admin' | 'team';
    departmentId: mongoose.Types.ObjectId;
    hourlyRate: number;
    billableRate: number;
    workSchedule: {
        monday: {
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
    serviceFees: [{
        serviceId: mongoose.Types.ObjectId;
        fee: number;
    }];
    jobFees: [{
        jobId: mongoose.Types.ObjectId;
        fee: number;
    }];
    isLocked: boolean;
    jti: string;
    deviceToken: string;
    deviceType: string;
    createdAt: Date;
    updatedAt: Date;
    passwordResetToken: string;
    companyId?: mongoose.Types.ObjectId;
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
        enum: ['active', 'inActive',],
        default: 'active',
    },
    avatarUrl: String,
    role: {
        type: String,
        enum: ['superAdmin', 'company', 'team'],
    },
    departmentId: {
        type: Schema.Types.ObjectId,
        ref: 'Department',
    },
    hourlyRate: {
        type: Number,
        default: 0,
    },
    billableRate: {
        type: Number,
        default: 0,
    },
    isLocked: {
        type: Boolean,
        default: false,
    },
    serviceFees: [
        {
            serviceId: {
                type: Schema.Types.ObjectId,
                ref: 'servicesCategory',
                required: true
            },
            fee: {
                type: Number,
                default: 0,
                min: 0
            }
        }
    ],
    jobFees: [
        {
            jobId: {
                type: Schema.Types.ObjectId,
                ref: 'JobCategory',
                required: true
            },
            fee: {
                type: Number,
                default: 0,
                min: 0
            }
        }
    ],
    workSchedule: {
        monday: { type: Number, default: 0, },
        tuesday: { type: Number, default: 0, },
        wednesday: { type: Number, default: 0, },
        thursday: { type: Number, default: 0, },
        friday: { type: Number, default: 0, },
        saturday: { type: Number, default: 0, },
        sunday: { type: Number, default: 0, }
    },
    jti: String,
    deviceToken: String,
    deviceType: Number,
    passwordResetToken: String,
    companyId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        default: null
    }

}, {
    timestamps: true,
});

userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ departmentId: 1 });
userSchema.index({ companyId: 1 });

export const UserModel = mongoose.model<IUser>('User', userSchema);
