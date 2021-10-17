import mongoose from "mongoose";

export const group_chat_schema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
  },
  sender: {
    type: String,
    required: true,
  },
  //for call
  receiver: {
    type: String,
  },
  message: {
    type: String,
  },
  files: {
    type: Array,
  },
  react: {
    type: Array,
  },
  status: {
    type: String,
    required: true,
  },
  // for call
  callDuration: {
    type: Object,
  },
  callDescription: {
    type: String,
  },
  timeStamp: {
    type: Date,
    required: true,
  },
});
