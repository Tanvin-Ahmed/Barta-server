import mongoose from "mongoose";

export const one_one_schema = new mongoose.Schema({
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
  // for call
  callDuration: {
    type: Object,
  },
  callDescription: {
    type: String,
  },
  status: {
    type: String,
    required: true,
  },
  timeStamp: {
    type: Date,
    required: true,
  },
});
