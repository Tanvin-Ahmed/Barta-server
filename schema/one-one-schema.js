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
  files: {
    type: Array,
  },
  react: {
    type: String,
  },
  timeStamp: {
    type: Date,
    required: true,
  },
});
