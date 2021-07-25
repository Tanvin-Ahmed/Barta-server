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
    type: String,
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
