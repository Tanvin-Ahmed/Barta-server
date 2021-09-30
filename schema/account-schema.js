import mongoose from "mongoose";

export const account_schema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  displayName: {
    type: String,
    required: true,
  },
  photoURL: {
    type: String,
    default: "",
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
  },
  goOffLine: {
    type: Date,
    // required: true,
  },
  timeStamp: {
    type: Date,
  },
});
