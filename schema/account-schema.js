import mongoose from "mongoose";

export const account_schema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
  },
  displayName: {
    type: String,
    required: true,
  },
  photoURL: {
    type: String,
    // required: true,
  },
  chatList: {
    type: Array,
    default: [],
    // required: true,
  },
  groups: {
    type: Array,
    default: [],
    // required: true,
  },
  status: {
    type: String,
    required: true,
  },
  goOffLine: {
    type: Date,
    // required: true,
  },
  timeStamp: {
    type: Date,
    required: true,
  },
});
