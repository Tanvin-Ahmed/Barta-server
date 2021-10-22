import express, { response } from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { groupAccountSchema } from "../schema/group-account-schema";
import { checkLogin } from "../middlewares/checkLogin";
import { GroupProfileUploadMiddleware } from "../FileUpload/GroupProfileUpload";
import { account_schema } from "../schema/account-schema";
import { group_chat_schema } from "../schema/group-chat-schema";

dotenv.config();

const router = express.Router();

const Group = mongoose.model(
  `${process.env.GROUP_CHAT_ACCOUNT_COLLECTION}`,
  groupAccountSchema
);
const UserAccount = mongoose.model(
  `${process.env.ACCOUNT_COLLECTION}`,
  account_schema
);

export const updateGroupInformation = (socket, user) => {
  const updateWatch = mongoose.connection
    .collection(`${process.env.GROUP_CHAT_ACCOUNT_COLLECTION}s`)
    .watch();

  updateWatch.on("change", (change) => {
    if (change.operationType === "update") {
      const updatedData = change.updateDescription.updatedFields;
      const _id = change.documentKey._id;
      socket.emit("update-group-data", { _id, updatedData });
    }
  });
};

router.post("/newGroup", checkLogin, (req, res) => {
  const info = req.body;
  const groupInfo = new Group(info);
  groupInfo.save((err, result) => {
    if (err) return response.status(500).send(err);
    else return res.status(201).send(result);
  });
});

router.get("/groupInfo/:id", checkLogin, (req, res) => {
  const _id = new mongoose.Types.ObjectId(req.params.id);
  Group.findOne({ _id }, (err, result) => {
    if (err) return res.status(404).send(err);
    else return res.status(200).send(result);
  });
});

const GroupChat = mongoose.model(
  `${process.env.GROUP_CHAT_COLLECTION}`,
  group_chat_schema
);

router.put("/remove-group-member", checkLogin, (req, res) => {
  const _id = new mongoose.Types.ObjectId(req.body._id);
  Group.findOne({ _id }, (err, account) => {
    if (err) return res.status(404).send(err.message);
    if (account?.members?.length > 1) {
      Group.findOneAndUpdate(
        { _id },
        {
          $pull: { members: req.body.email },
        },
        (err) => {
          if (err) return res.status(404).send(err.message);

          UserAccount.findOneAndUpdate(
            { email: req.body.email },
            {
              $pull: { groups: { groupId: req.body._id } },
            },
            (err) => {
              if (err) return res.status(404).send(err.message);
              return res.status(200).send("group remove successfully");
            }
          );
        }
      );
    } else if (account?.members?.length === 1) {
      GroupChat.deleteMany({ id: req.body._id }, (err) => {
        if (err) return res.status(501).send(err.message);

        Group.deleteOne({ _id }, (err) => {
          if (err) return res.status(501).send(err.message);
          UserAccount.findOneAndUpdate(
            { email: req.body.email },
            {
              $pull: { groups: { groupId: req.body._id } },
            },
            (err) => {
              if (err) return res.status(404).send(err.message);
              return res.status(200).send("group remove successfully");
            }
          );
        });
      });
    }
  });
});

router.put("/add-new-member", checkLogin, (req, res) => {
  const _id = new mongoose.Types.ObjectId(req.body._id);
  let totalUpload = 0;
  req.body.members.forEach((user) => {
    Group.findOneAndUpdate(
      { _id },
      {
        $addToSet: { members: user.email },
      },
      (err) => {
        console.log("update member list of group", err);
        if (err) return res.status(404).send(err.message);

        UserAccount.findOneAndUpdate(
          { email: user.email },
          {
            $addToSet: {
              groups: {
                member: user.email.split("@")[0],
                groupId: req.body._id,
              },
            },
          },
          (err) => {
            console.log("update group list of user", err);
            if (err) return res.status(404).send(err.message);
            totalUpload += 1;
            if (req.body.members.length === totalUpload) {
              return res.status(200).send("add member successfully");
            }
          }
        );
      }
    );
  });
});

// update group profile
let gfs;
mongoose.connection.once("open", () => {
  gfs = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: `${process.env.GROUP_CHAT_ACCOUNT_COLLECTION}`,
  });
});

const deletePreviousPic = (req, res, next) => {
  if (req.body?.photoId) {
    const _id = new mongoose.Types.ObjectId(req.body.photoId);
    gfs.delete(_id, (err, res) => {
      if (err) return res.status(404).send("Profile picture not update");
      next();
    });
  } else {
    next();
  }
};

router.put(
  "/update-profile-pic",
  checkLogin,
  deletePreviousPic,
  GroupProfileUploadMiddleware,
  (req, res) => {
    const _id = new mongoose.Types.ObjectId(req.body._id);
    const img = req.file?.id;
    Group.updateOne(
      { _id },
      {
        $set: {
          photoId: img,
        },
      },
      (err) => {
        if (err) return res.status(404).send("Profile picture not update");

        return res.status(200).send("updated profile picture");
      }
    );
  }
);

router.put("/update-profile-info", checkLogin, (req, res) => {
  const _id = new mongoose.Types.ObjectId(req.body._id);
  Group.updateOne(
    { _id },
    {
      $set: {
        groupName: req.body.groupName,
      },
    },
    (err) => {
      if (err) return res.status(404).send("Profile not update");
      return res.status(200).send("updated successfully");
    }
  );
});

router.get("/get-profile-img/:id", (req, res) => {
  if (!req.params.id) return res.status(400).send("file not exist");
  const _id = new mongoose.Types.ObjectId(req.params.id);
  gfs.find({ _id }).toArray((err, files) => {
    if (err) return res.status(404).send(err.message);
    if (!files || files.length === 0)
      return res.status(400).send("no files exist");

    const contentType = files[0].contentType;
    //setting response header
    res.set({
      "Accept-Ranges": "bytes",
      "Content-Type": `${contentType}`,
      "Access-Control-Allow-Origin": "*",
    });

    const downloadStream = gfs.openDownloadStream(_id);
    downloadStream.on("error", (err) => {
      return res.status(404).send(err.message);
    });
    return downloadStream.pipe(res);
  });
});

export default router;
