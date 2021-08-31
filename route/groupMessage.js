import mongoose from "mongoose";
import express from "express";
import dotenv from "dotenv";
import { group_chat_schema } from "../schema/group-chat-schema";
dotenv.config();

const router = express.Router();

const GroupChat = mongoose.model(
  `${process.env.GROUP_CHAT_COLLECTION}`,
  group_chat_schema
);

router.post("/messages/:groupName", (req, res) => {
  const itemsPerPage = 9;
  const pageNum = parseInt(req.body.pageNum, 10);
  GroupChat.find({ id: req.params.groupName })
    .sort({ _id: -1 })
    .skip(itemsPerPage * (pageNum - 1))
    .limit(itemsPerPage)
    .then((docs) => {
      return res.status(200).send(docs);
    })
    .catch((err) => {
      return res.status(404).send(err);
    });
});

export default router;
