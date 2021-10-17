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
  photoId: {
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
  birthday: {
    type: Date,
  },
  nationality: {
    type: String,
    default: "",
  },
  gender: {
    type: String,
    default: "",
  },
  religion: {
    type: String,
    default: "",
  },
  relationshipStatus: {
    type: String,
    default: "",
  },
  resetToken: {
    type: String,
    default: "",
  },
  education: {
    type: String,
    default: "",
  },
  work: {
    type: String,
    default: "",
  },
});
