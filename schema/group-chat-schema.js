import mongoose from "mongoose";

export const group_chat_schema = new mongoose.Schema({
    room: {
        type: String,
        required: true
    },
    senderName: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    timeStamp: {
        type: Date,
        required: true
    }
})