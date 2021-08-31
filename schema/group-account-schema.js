import mongoose from "mongoose";

export const groupAccountSchema = new mongoose.Schema({
  groupName: {
    type: String,
    required: true,
  },
  photoURL: {
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
