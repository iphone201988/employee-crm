import mongoose, { Schema } from "mongoose";

const timesheetSchema = new mongoose.Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    weekstart: {
        type: Date,
        required: true,
    },
    weekend: {
        type: Date,
        required: true,
    },
    status: {
        type: String,
        required: true,
        default: "daft"
    },
    rowData: [{
        clientId: {
            type: Schema.Types.ObjectId,
            ref: 'Client',
            required: true,
        },
        jobId: {
            type: Schema.Types.ObjectId,
            ref: 'Job',
            required: true,
        },
        timeCategoryId: {
            type: Schema.Types.ObjectId,
            ref: 'TimeCategory',
            required: true,
        },
        decsription: {
            type: String,
        },
        isbillable: {
            type: Boolean,
            required: true,
            default: false
        },
        rate: {
            type: Number,
        },
        weeklyWorking:{
            monday: {
                type: Number,
                default: 0
            },
            tuesday: {
                type: Number,
                default: 0
            },
            wednesday: {
                type: Number,
                default: 0
            },
            thursday: {
                type: Number,
                default: 0
            },
            friday: {
                type: Number,
                default: 0
            },
            saturday: {
                type: Number,
                default: 0
            },
            sunday: {
                type: Number,
                default: 0
            },
        }
    }],
    billableHours:{
        monday:{
            type: Number,
            default: 0
        },
        tuesday: {
            type: Number,
            default: 0
        },
        wednesday: {
            type: Number,
            default: 0
        },
        thursday: {
            type: Number,
            default: 0
        },
        friday: {
            type: Number,
            default: 0
        },
        saturday: {
            type: Number,
            default: 0
        },
        sunday: {
            type: Number,
            default: 0
        },
    },
    nonBillableHours: {
        monday: {
            type: Number,
            default: 0
        },
        tuesday: {
            type: Number,
            default: 0
        },
        wednesday: {
            type: Number,
            default: 0
        },
        thursday: {
            type: Number,
            default: 0
        },
        friday: {
            type: Number,
            default: 0
        },
        saturday: {
            type: Number,
            default: 0
        },
        sunday: {
            type: Number,
            default: 0
        },
    }
});