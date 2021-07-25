import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { one_one_schema } from "../schema/one-one-schema";
import multer from "multer";
import { GridFsStorage } from "multer-gridfs-storage";
import Grid from "gridfs-stream";
import path from "path";
import crypto from "crypto";

dotenv.config();

const router = express.Router();

const OneOneChat = mongoose.model(
  `${process.env.ONE_ONE_CHAT_COLLECTION}`,
  one_one_schema
);

let lastMessage = {};
let updatedMessageId = "";
let deletedId = "";
export const oneOneMessageFromSocket = (socket) => {
  socket.on("join", ({ roomId }) => {
    socket.join(roomId);
    const newMessage = mongoose.connection
      .collection("one_one_messages")
      .watch();
    newMessage.on("change", (change) => {
      // console.log(change);
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
      } else if (change.operationType === "update") {
        if (change.documentKey !== updatedMessageId) {
          updatedMessageId = change.documentKey;

          const react = change?.updateDescription?.updatedFields?.react;
          socket.emit("update-react", { _id: change?.documentKey?._id, react });
        }
      } else if (change.operationType === "delete") {
        if (deletedId !== change?.documentKey?._id) {
          deletedId = change?.documentKey?._id;
          socket.emit("delete-chatMessage", { _id: change?.documentKey?._id });
        }
      }
    });
  });
  socket.on("typing", (info) => {
    socket.broadcast.emit("displayTyping", info);
  });
};

const uri = `mongodb://${process.env.USER_NAME}:${process.env.USER_PASSWORD}@cluster0-shard-00-00.zhub4.mongodb.net:27017,cluster0-shard-00-01.zhub4.mongodb.net:27017,cluster0-shard-00-02.zhub4.mongodb.net:27017/${process.env.DATABASE_NAME}?ssl=true&replicaSet=atlas-5oevi0-shard-0&authSource=admin&retryWrites=true&w=majority`;
// create storage engin
const storage = new GridFsStorage({
  url: uri,
  options: { useNewUrlParser: true, useUnifiedTopology: true },
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      // encrypt filename before storing file
      crypto.randomBytes(16, (err, buf) => {
        if (err) {
          return reject(err);
        }

        const filename = buf.toString("hex") + path.extname(file.originalname);
        const fileInfo = {
          filename,
          bucketName: `${process.env.ONE_ONE_CHAT_COLLECTION}`,
        };
        resolve(fileInfo);
      });
    });
  },
});

const upload = multer({ storage });

let gfs;
mongoose.connection.once("open", () => {
  //   console.log("connection open");
  gfs = Grid(mongoose.connection.db, mongoose.mongo);
  gfs.collection(`${process.env.ONE_ONE_CHAT_COLLECTION}`);
  // gfs = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
  //   chunkSizeBytes: 1024,
  //   bucketName: `${process.env.ONE_ONE_CHAT_COLLECTION}`,
  // });
});

router.post("/upload", upload.array("file", 15), (req, res) => {
  let files = [];
  for (let i = 0; i < req.files.length; i++) {
    const element = req.files[i];
    files[i] = {
      fileId: element.id,
      filename: element.filename,
      contentType: element.contentType,
    };
  }

  const fileInfo = {
    id: req.body.id,
    sender: req.body.sender,
    files,
    react: "",
    timeStamp: req.body.timeStamp,
  };

  // console.log(fileInfo);

  const newFiles = new OneOneChat(fileInfo);
  newFiles.save((err, result) => {
    if (err) {
      return res.status(500).send(err);
    } else {
      return res.status(200).send(result);
    }
  });
});
router.get("/file/:filename", (req, res) => {
  res.set({
    "Accept-Ranges": "bytes",
    "Content-Disposition": `attachment; filename=${req.params.filename}`,
    // "Content-Type": "application/octet-stream",
  });
  gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
    if (err) {
      console.log(err);
      return res.status(404).send(err.message);
    } else {
      return gfs.createReadStream(file.filename).pipe(res);
    }
  });
});

router.delete("/file/delete/:id", (req, res) => {
  gfs.remove(
    {
      _id: req.params.id,
      root: `${process.env.ONE_ONE_CHAT_COLLECTION}`,
    },
    (err, gridStore) => {
      if (err) {
        return res.status(404).send(err.message);
      } else {
        return res.status(200).send("deleted successfully");
      }
    }
  );
});

router.post("/postOneOneChat", (req, res) => {
  const chatMessage = new OneOneChat(req.body);
  chatMessage.save((err, result) => {
    if (err) {
      return res.status(500).send(err);
    } else {
      return res.status(200).send(result.insertCount > 0);
    }
  });
});

router.post("/postCallInfo", (req, res) => {
  const callInfo = new OneOneChat(req.body);
  callInfo.save((err, result) => {
    if (err) {
      return res.status(500).send(err);
    } else {
      return res.status(200).send(result.insertCount > 0);
    }
  });
});

router.get("/getOneOneChat/:roomId", (req, res) => {
  OneOneChat.find({ id: req.params.roomId }, (err, docs) => {
    if (err) {
      return res.status(404).send(err);
    } else {
      return res.status(200).send(docs);
    }
  });
});

router.put("/updateChatMessage", (req, res) => {
  OneOneChat.updateOne(
    { _id: req.body.id },
    {
      $set: { react: req.body.react },
    },
    (err, result) => {
      if (err) {
        return res.status(404).send(err);
      } else {
        return res.status(200).send(result);
      }
    }
  );
});

router.delete("/deleteChatMessage/:id", (req, res) => {
  console.log(req.params.id);
  OneOneChat.deleteOne({ _id: req.params.id }, (err, result) => {
    if (err) {
      return res.status(404).send(err);
    } else {
      return res.status(200).send(result);
    }
  });
});

export default router;
