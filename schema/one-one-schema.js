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
  message: {
    type: String,
  },
  file: {
    type: Array,
  },
  timeStamp: {
    type: Date,
    required: true,
  },
});
