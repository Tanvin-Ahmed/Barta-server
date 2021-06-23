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
export const oneOneMessageFromSocket = (socket) => {
  socket.on("join", ({ roomId }) => {
    socket.join(roomId);
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
  socket.on("typing", (info) => {
    socket.broadcast.emit("displayTyping", info);
  });
};

const uri = `mongodb://${process.env.USER_NAME}:${process.env.USER_PASSWORD}@cluster0-shard-00-00.zhub4.mongodb.net:27017,cluster0-shard-00-01.zhub4.mongodb.net:27017,cluster0-shard-00-02.zhub4.mongodb.net:27017/${process.env.DATABASE_NAME}?ssl=true&replicaSet=atlas-5oevi0-shard-0&authSource=admin&retryWrites=true&w=majority`;
// create storage engin
const storage = new GridFsStorage({
  url: uri,
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
});

router.post("/upload", upload.array("file", 15), (req, res) => {
  
  let files = [];
  for (let i = 0; i < req.files.length; i++) {
    const element = req.files[i];
    files[i] = {
      filename: element.filename,
      contentType: element.contentType
    }
  }
  
  const fileInfo = {
    id: req.body.id,
    sender: req.body.sender,
    files,
    timeStamp: req.body.timeStamp,
  };

  console.log(fileInfo)

  const newFiles = new OneOneChat(fileInfo);
  newFiles.save((err, result) => {
    if (err) {
      console.log(err);
    } else {
      console.log(result);
    }
  });
});

router.get("/file/:filename", (req, res) => {
  gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
    if (err) {
      res.status(404).send(err.message);
    } else {
      gfs.createReadStream({ filename: file.filename }).pipe(res);
      // console.log(file);
    }
  });
});

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
      for (let i = 0; i < docs.length; i++) {
        const document = docs[i];
        if (document.file || document.file?.length || document.file[0]) {
          for (let j = 0; j < document.file.length; j++) {
            const element = document.file[j];
            // gfs.files.findOne({ _id: element.id }, (err, file) => {
            //   if (err) {
            //     res.status(404).send(err.message);
            //   } else {
            //     gfs.createReadStream(file.filename).pipe(res);
            //   }
            // });
            gfs.createReadStream(element.filename).pipe(res);
          }
        }
      }
      res.status(200).send(docs);
    }
  });
});

export default router;
