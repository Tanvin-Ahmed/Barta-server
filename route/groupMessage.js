import mongoose from "mongoose";
import express from "express";
import dotenv from "dotenv";
import Grid from "gridfs-stream";
import { group_chat_schema } from "../schema/group-chat-schema";
import { uploadMiddleware } from "../FileUpload/FileUpload";
import { checkLogin } from "../middlewares/checkLogin";
dotenv.config();

export const groupChatFromSocket = (socket, roomId) => {
  const groupChat = mongoose.connection
    .collection(`${process.env.GROUP_CHAT_COLLECTION}s`)
    .watch();

  groupChat.on("change", (change) => {
    if (change.operationType === "insert") {
      const message = change.fullDocument;
      if (message.id === roomId) {
        socket.emit("new-message", message);
      }
    } else if (change.operationType === "update") {
      const updateFiled = change?.updateDescription?.updatedFields;
      if (updateFiled?.status) {
        return socket.emit("updated-message-status", {
          _id: change?.documentKey?._id,
          status: updateFiled?.status,
        });
      }
      socket.emit("update-react", {
        _id: change?.documentKey?._id,
        react:
          updateFiled?.react?.length >= 0 ? updateFiled.react : updateFiled,
      });
    } else if (change.operationType === "delete") {
      socket.emit("delete-chatMessage", { _id: change?.documentKey?._id });
    }
  });
};

const router = express.Router();

const GroupChat = mongoose.model(
  `${process.env.GROUP_CHAT_COLLECTION}`,
  group_chat_schema
);

let gfs;
mongoose.connection.once("open", () => {
  gfs = Grid(mongoose.connection.db, mongoose.mongo);
  gfs.collection(`${process.env.GROUP_CHAT_COLLECTION}`);
});

router.post("/upload", checkLogin, uploadMiddleware, (req, res) => {
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
    status: req.body.status,
    timeStamp: req.body.timeStamp,
  };

  const newFiles = new GroupChat(fileInfo);
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

router.delete("/file/delete/:id", checkLogin, (req, res) => {
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

router.post("/messages/post", checkLogin, (req, res) => {
  const message = req.body;
  const newChat = new GroupChat(message);
  newChat.save((err, chat) => {
    if (err) return res.status(500).send(err.message);
    return res.status(201).send(chat);
  });
});

router.post("/messages/:roomId", checkLogin, (req, res) => {
  const itemsPerPage = 9;
  const pageNum = parseInt(req.body.pageNum, 10);
  GroupChat.find({ id: req.params.roomId })
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

router.put("/updateChatMessage", checkLogin, (req, res) => {
  GroupChat.findOneAndUpdate(
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

router.put("/updateOnlyReact", checkLogin, (req, res) => {
  GroupChat.findOneAndUpdate(
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

router.put("/removeReact", checkLogin, (req, res) => {
  GroupChat.findOneAndUpdate(
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

router.delete("/deleteChatMessage/:id", checkLogin, (req, res) => {
  GroupChat.deleteOne({ _id: req.params.id }, (err, result) => {
    if (err) {
      return res.status(404).send(err);
    } else {
      return res.status(200).send(result);
    }
  });
});

router.post("/unseen-message-to-seen", checkLogin, (req, res) => {
  const ids = req.body;
  let count = 0;

  ids.forEach((id) => {
    const _id = new mongoose.Types.ObjectId(id);
    GroupChat.findOne({ _id }, (err, data) => {
      if (err) return res.status(404).send(err.message);
      if (data.status === "unseen") {
        GroupChat.updateOne(
          { _id },
          {
            $set: { status: "seen" },
          },
          (err) => {
            if (err) return res.status(500).send(err.message);
            count += 1;
            if (ids.length === count) {
              return res.status(200).send("update successfully.");
            }
          }
        );
      }
    });
  });
});

router.get("/get-lastMessage-for-chatBar/:id", checkLogin, (req, res) => {
  GroupChat.findOne({ id: req.params.id })
    .sort({ _id: -1 })
    .then((message) => {
      const msg = {
        groupId: message.id,
        _id: message._id,
        message: message.message || "",
        files: message.files || [],
        status: message.status,
        timeStamp: message.timeStamp,
      };
      res.status(200).send(msg);
    })
    .catch((err) => {
      res.status(404).send(err.message);
    });
});

router.delete("/delete-conversation/:id", checkLogin, (req, res) => {
  const id = req.params.id;
  GroupChat.deleteMany({ id }, (err) => {
    if (err) return res.status(501).send(err.message);
    return res.status(200).send("deleted successfully");
  });
});

export default router;
