import express, { response } from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { groupAccountSchema } from "../schema/group-account-schema";

dotenv.config();

const router = express.Router();

const Group = mongoose.model(
  `${process.env.GROUP_CHAT_ACCOUNT_COLLECTION}`,
  groupAccountSchema
);

router.post("/newGroup", (req, res) => {
  const info = req.body;
  const groupInfo = new Group(info);
  groupInfo.save((err, result) => {
    if (err) return response.status(500).send(err);
    else return res.status(201).send(result);
  });
});

router.get("/groupInfo/:groupName", (req, res) => {
  const groupName = req.params.groupName;
  Group.findOne({ groupName }, (err, result) => {
    if (err) return res.status(404).send(err);
    else return res.status(200).send(result);
  });
});

export default router;
