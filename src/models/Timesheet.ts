import mongoose, { Schema } from "mongoose";

const timesheetSchema = new mongoose.Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    date: {
        type: Date,
        required: true,
    },
    hours: {
        type: Number,
        required: true,
    },
    notes: {
        type: String,
        required: true,
    },
});