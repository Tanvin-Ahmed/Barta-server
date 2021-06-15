import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { one_one_schema } from "../schema/one-one-schema";

dotenv.config();

const router = express.Router();

const OneOneChat = mongoose.model(
  `${process.env.ONE_ONE_CHAT_COLLECTION}`,
  one_one_schema
);

export const oneOneMessageFromSocket = (socket) => {
  socket.on("join", ({ roomId }) => {
    socket.join(roomId);
    let lastMessage = {};
    const newMessage = mongoose.connection
      .collection("one_one_messages")
      .watch();
    newMessage.on("change", (change) => {
      if (change.operationType === "insert") {
        const message = change.fullDocument;

        if (message.id === roomId) {
          if (
            message.sender !== lastMessage?.sender ||
            (message.sender === lastMessage?.sender &&
              message.timeStamp !== lastMessage?.timeStamp)
          ) {
            lastMessage = {
              sender: message.sender,
              timeStamp: message.timeStamp,
            };
            socket.emit("one_one_chatMessage", message);
          }
        }
      }
    });
  });
};

router.post("/postOneOneChat", (req, res) => {
  const chatMessage = new OneOneChat(req.body);
  chatMessage.save((err, result) => {
    if (err) {
      res.status(500).send(err);
    } else {
      res.status(200).send(result.insertCount > 0);
    }
  });
});

router.get("/getOneOneChat/:roomId", (req, res) => {
  OneOneChat.find({ id: req.params.roomId }, (err, docs) => {
    if (err) {
      res.status(404).send(err);
    } else {
      res.status(200).send(docs);
    }
  });
});

export default router;
