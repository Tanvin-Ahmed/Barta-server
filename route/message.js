import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { one_one_schema } from "../schema/one-one-schema";
import Grid from "gridfs-stream";
import { upload } from "../FileUpload/FileUpload";

dotenv.config();

const router = express.Router();

const OneOneChat = mongoose.model(
  `${process.env.ONE_ONE_CHAT_COLLECTION}`,
  one_one_schema
);

export const oneOneMessageFromSocket = (socket, roomId) => {
  const newMessage = mongoose.connection.collection("one_one_messages").watch();
  newMessage.on("change", (change) => {
    // console.log(change);
    if (change.operationType === "insert") {
      const message = change.fullDocument;

      if (message.id === roomId) {
        socket.emit("new-message", message);
      }
    } else if (change.operationType === "update") {
      const updateFiled = change?.updateDescription?.updatedFields;
      socket.emit("update-react", {
        _id: change?.documentKey?._id,
        react:
          updateFiled?.react?.length >= 0 ? updateFiled.react : updateFiled,
      });
    } else if (change.operationType === "delete") {
      socket.emit("delete-chatMessage", { _id: change?.documentKey?._id });
    }
  });
  socket.on("typing", (info) => {
    socket.broadcast.emit("displayTyping", info);
  });
};

let gfs;
mongoose.connection.once("open", () => {
  gfs = Grid(mongoose.connection.db, mongoose.mongo);
  gfs.collection(`${process.env.ONE_ONE_CHAT_COLLECTION}`);
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
    react: [],
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
  gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
    if (err) {
      return res.status(404).send(err.message);
    } else {
      res.set({
        "Accept-Ranges": "bytes",
        "Content-Disposition": `attachment; filename=${req.params.filename}`,
        // "Content-Type": "application/octet-stream",
      });
      const readStream = gfs.createReadStream(file.filename);
      readStream.on("error", (err) => {
        return res.status(404).send(err.message);
      });
      return readStream.pipe(res);
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
      return res.status(201).send(result.insertCount > 0);
    }
  });
});

router.post("/getOneOneChat/:roomId", (req, res) => {
  const itemsPerPage = 9;
  const pageNum = parseInt(req.body.pageNum, 10);
  OneOneChat.find({ id: req.params.roomId })
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

router.put("/updateChatMessage", (req, res) => {
  OneOneChat.findOneAndUpdate(
    { _id: req.body.id },
    {
      $addToSet: { react: req.body.reactInfo },
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

router.put("/updateOnlyReact", (req, res) => {
  OneOneChat.findOneAndUpdate(
    { _id: req.body.id, "react.sender": req.body.sender },
    {
      $set: { "react.$.react": req.body.react },
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

router.put("/removeReact", (req, res) => {
  OneOneChat.findOneAndUpdate(
    { _id: req.body.id },
    {
      $pull: { react: { sender: req.body.sender } },
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
  OneOneChat.deleteOne({ _id: req.params.id }, (err, result) => {
    if (err) {
      return res.status(404).send(err);
    } else {
      return res.status(200).send(result);
    }
  });
});

export default router;
