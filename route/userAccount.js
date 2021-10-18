import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { account_schema } from "../schema/account-schema";
import { groupAccountSchema } from "../schema/group-account-schema";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { profileUploadMiddleware } from "../FileUpload/ProfilePicUpload";
import { checkLogin } from "../middlewares/checkLogin";
import { one_one_schema } from "../schema/one-one-schema";
import { group_chat_schema } from "../schema/group-chat-schema";
import { sendEmail } from "../utils/sendEmail";

dotenv.config();

const router = express.Router();
const Account = mongoose.model(
  `${process.env.ACCOUNT_COLLECTION}`,
  account_schema
);

const OneOneChat = mongoose.model(
  `${process.env.ONE_ONE_CHAT_COLLECTION}`,
  one_one_schema
);

export const userIsOnline = (user) => {
  if (user) {
    Account.updateOne(
      { email: user },
      {
        $set: {
          status: "active",
        },
      },
      (err, update) => {
        if (err) {
          console.log(err.message);
          return err;
        } else {
          return update.ok;
        }
      }
    );
  }
};

export const updateChatList = (socket, user) => {
  const userId = user?.split("@")[0];

  const newFriend = mongoose.connection
    .collection(`${process.env.ACCOUNT_COLLECTION}s`)
    .watch();
  newFriend.on("change", (change) => {
    if (change.operationType === "update") {
      const updateFiled = change?.updateDescription?.updatedFields;
      if (updateFiled?.chatList) {
        const id = updateFiled?.chatList[updateFiled?.chatList?.length - 1];
        if (userId === id?.friendOf) {
          socket.emit("add-friend-list", id?.email);
        }
      } else if (updateFiled?.groups) {
        const id = updateFiled?.groups[updateFiled?.groups?.length - 1];
        if (userId === id?.member) {
          socket.emit("add-group-list", id);
        }
      } else {
        socket.emit("update-profile-data", {
          _id: change.documentKey._id,
          updateFiled,
        });
      }
    }
  });
};

export const userIsOffLine = (user) => {
  if (user) {
    Account.updateOne(
      { email: user },
      {
        $set: {
          status: "inactive",
          goOffLine: new Date().toUTCString(),
        },
      },
      (err, update) => {
        if (err) {
          return err;
        } else {
          return update.ok;
        }
      }
    );
  }
};

router.get("/:email", checkLogin, (req, res) => {
  Account.findOne({ email: req.params.email }, (err, userAccount) => {
    if (err) {
      return res.status(404).send(err.message);
    } else {
      if (userAccount.chatList.length === 0 || !userAccount.chatList[0])
        return res.status(400).send("No friend available");

      const returnUsersInfo = (friends) => {
        return res.status(200).send(friends);
      };
      const friend = [];
      userAccount?.chatList?.forEach((chat) => {
        Account.findOne({ email: chat.email }, (err, account) => {
          if (err) {
            return res.status(404).send(err.message);
          } else {
            const ascendingSort = [
              req.params.email.split("@")[0],
              chat.email.split("@")[0],
            ].sort();
            const roomId = `${ascendingSort[0]}_${ascendingSort[1]}`;
            OneOneChat.findOne({ id: roomId })
              .sort({ _id: -1 })
              .then((message) => {
                const friendData = {
                  ...account._doc,
                  lastMessage: message,
                };
                friend.push(friendData);
                if (userAccount?.chatList?.length === friend?.length) {
                  const friends = friend.reverse();
                  returnUsersInfo(friends);
                }
              })
              .catch((err) => {
                return res.status(404).send(err.message);
              });
          }
        });
      });
    }
  });
});

router.get("/getFriendDetailsByEmail/:email", checkLogin, (req, res) => {
  Account.find({ email: req.params.email }, (err, account) => {
    if (err) {
      return req.status(404).send(err.message);
    } else {
      const user = account[0];
      if (user) {
        let info = {};
        if (user.status === "active") {
          info = {
            _id: user?._id,
            email: user?.email,
            displayName: user?.displayName,
            photoURL: user?.photoURL,
            status: user?.status,
          };
        } else {
          info = {
            _id: user?._id,
            email: user?.email,
            displayName: user?.displayName,
            photoURL: user?.photoURL,
            status: user?.status,
            goOffLine: user?.goOffLine,
          };
        }
        return res.status(200).send(info);
      }
    }
  });
});

router.get("/receiverInfo/:id", checkLogin, (req, res) => {
  Account.findOne({ _id: req.params.id }, (err, account) => {
    if (err) {
      return res.status(404).send(err.message);
    } else {
      const accountInfo = {
        displayName: account.displayName,
        email: account.email,
        photoURL: account.photoURL,
        photoId: account.photoId,
        chatList: account.chatList,
        groups: account.groups,
        _id: account._id,
        religion: account.religion,
        gender: account.gender,
        nationality: account.nationality,
        birthday: account.birthday,
        status: account.status,
        goOffLine: account.goOffLine,
        timeStamp: account.timeStamp,
        relationshipStatus: account.relationshipStatus,
      };
      return res.status(200).send(accountInfo);
    }
  });
});

router.get("/allAccount/:searchString", checkLogin, (req, res) => {
  Account.find(
    { displayName: new RegExp(req.params.searchString, "i") },
    (err, accounts) => {
      if (err) {
        return res.status(404).send(err.message);
      } else {
        return res.status(200).send(accounts);
      }
    }
  );
});

router.post("/sign-in", (req, res) => {
  Account.findOne({ email: req.body.email }, (err, account) => {
    if (err) return res.status(404).send(err.message);
    if (account?.email === req.body.email)
      return res.status(400).send("Email already registered");
    bcrypt
      .hash(req.body.password, 10)
      .then((hashedPassword) => {
        const newUser = new Account({
          displayName: req.body.displayName,
          email: req.body.email,
          password: hashedPassword,
          status: "active",
          goOffLine: new Date().toUTCString(),
          timeStamp: new Date().toUTCString(),
          birthday: req.body.birthday,
        });
        newUser.save((err, account) => {
          console.log(err);
          if (err) return res.status(500).send("Sign In failed");

          // generate token
          const token = jwt.sign(
            {
              _id: account._id,
              email: account.email,
              displayName: account.displayName,
              status: "active",
            },
            process.env.JWT_SECRET_KEY,
            { expiresIn: "5d" }
          );

          const accountInfo = {
            displayName: account.displayName,
            email: account.email,
            photoURL: account.photoURL,
            photoId: account.photoId,
            chatList: account.chatList,
            groups: account.groups,
            _id: account._id,
            religion: account.religion,
            gender: account.gender,
            nationality: account.nationality,
            birthday: account.birthday,
            status: account.status,
            goOffLine: account.goOffLine,
            timeStamp: account.timeStamp,
            relationshipStatus: account.relationshipStatus,
          };

          return res.status(200).send({ token, accountInfo });
        });
      })
      .catch(() => res.status(400).send("Sing In failed"));
  });
});

router.post("/login", (req, res) => {
  Account.findOne({ email: req.body.email }, (err, account) => {
    if (err) return res.status(404).send(err.message);
    if (!account) return res.status(401).send("Authentication failed");

    bcrypt
      .compare(req.body.password, account.password)
      .then((valid) => {
        if (!valid) return res.status(400).send("Authentication failed");

        // generate token
        const token = jwt.sign(
          {
            _id: account._id,
            email: account.email,
            displayName: account.displayName,
            status: "active",
          },
          process.env.JWT_SECRET_KEY,
          { expiresIn: "5d" }
        );

        const accountInfo = {
          displayName: account.displayName,
          email: account.email,
          photoURL: account.photoURL,
          photoId: account.photoId,
          chatList: account.chatList,
          groups: account.groups,
          _id: account._id,
          religion: account.religion,
          gender: account.gender,
          nationality: account.nationality,
          birthday: account.birthday,
          status: account.status,
          goOffLine: account.goOffLine,
          timeStamp: account.timeStamp,
          relationshipStatus: account.relationshipStatus,
        };

        res.status(200).send({ token, accountInfo });
      })
      .catch((err) => res.status(404).send(err.message));
  });
});

router.get("/reset-password-request/:email", (req, res) => {
  const email = req.params.email;
  Account.findOne({ email }, (err, account) => {
    if (err) return res.status(404).send(err.message);
    if (account) {
      const token = jwt.sign(
        {
          _id: account._id,
          email,
        },
        process.env.JWT_SECRET_KEY,
        { expiresIn: "5m" }
      );
      const resetUrl = `https://barta-the-real-time-chat.netlify.app/reset-password/${token}`;
      const message = `
        <h1>You have requested for reset the password</h1>
        <p>Please go to this link to reset your password</p>
        <p style="color: red; font-weight: bold; font-size: 20px;">Please reset password in 5 minutes</p>
        <a href=${resetUrl} clicktracking=off>${resetUrl}</a>
        `;
      const options = {
        to: email,
        subject: "reset password",
        html: message,
      };
      sendEmail(options, res);
    } else {
      return res.status(422).send("No user registered with this email!");
    }
  });
});

router.put("/reset-password", (req, res) => {
  const password = req.body.password;
  jwt.verify(req.body.token, process.env.JWT_SECRET_KEY, (err, { email }) => {
    if (err)
      return res.status(401).send("Time is over, please resend a request");
    bcrypt.hash(password, 10).then((hashedPassword) => {
      Account.updateOne(
        { email },
        { $set: { password: hashedPassword } },
        (err) => {
          if (err)
            return res
              .status(404)
              .send("something went wrong, please try again");
          return res.status(200).send("password reset successfully");
        }
      );
    });
  });
});

router.get("/userInfo/:id", checkLogin, (req, res) => {
  const _id = new mongoose.Types.ObjectId(req.params.id);
  Account.findOne({ _id }, (err, account) => {
    if (err) return res.status(404).send(err.message);

    const accountInfo = {
      displayName: account.displayName,
      email: account.email,
      photoURL: account.photoURL,
      photoId: account.photoId,
      chatList: account.chatList,
      groups: account.groups,
      _id: account._id,
      religion: account.religion,
      gender: account.gender,
      nationality: account.nationality,
      birthday: account.birthday,
      status: account.status,
      goOffLine: account.goOffLine,
      timeStamp: account.timeStamp,
      relationshipStatus: account.relationshipStatus,
    };
    return res.status(200).send(accountInfo);
  });
});

let gfs;
mongoose.connection.once("open", () => {
  gfs = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: `${process.env.ACCOUNT_COLLECTION}`,
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
  profileUploadMiddleware,
  deletePreviousPic,
  (req, res) => {
    const _id = new mongoose.Types.ObjectId(req.body._id);
    const img = req.file?.id;
    Account.updateOne(
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
  Account.updateOne(
    { _id },
    {
      $set: {
        displayName: req.body.displayName,
        religion: req.body.religion,
        nationality: req.body.nationality,
        gender: req.body.gender,
        relationshipStatus: req.body.relationshipStatus,
        birthday: req.body.birthday,
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

router.post("/", checkLogin, (req, res) => {
  Account.find({ email: req.body.email }, (err, account) => {
    if (err) {
      return res.status(404).send(err.message);
    } else {
      if (account[0]) {
        return res.status(200).send(account[0]);
      } else {
        const newAccount = new Account(req.body);
        newAccount.save((err, result) => {
          if (err) {
            return res.status(500).send(err.message);
          } else {
            return res.status(201).send(result);
          }
        });
      }
    }
  });
});

router.put("/updateChatList/:email", checkLogin, (req, res) => {
  const email = req.params.email;
  const friendsInfo = req.body;

  Account.updateOne(
    { email },
    { $addToSet: { chatList: friendsInfo } },
    (err, data) => {
      if (err) {
        return res.status(500).send(err.message);
      } else {
        return res.status(201).send(data);
      }
    }
  );
});

///////////// group list //////////////
const GroupAccount = mongoose.model(
  `${process.env.GROUP_CHAT_ACCOUNT_COLLECTION}`,
  groupAccountSchema
);
const GroupChat = mongoose.model(
  `${process.env.GROUP_CHAT_COLLECTION}`,
  group_chat_schema
);

router.get("/groupList/:email", checkLogin, (req, res) => {
  Account.findOne({ email: req.params.email }, (err, userAccount) => {
    if (err) {
      return res.status(404).send(err.message);
    } else {
      if (userAccount?.groups.length === 0) {
        return res.status(200).send(userAccount?.groups);
      } else {
        const returnUsersInfo = (allGroup) => {
          return res.status(200).send(allGroup);
        };
        const groupList = [];
        userAccount?.groups?.forEach((group) => {
          const _id = new mongoose.Types.ObjectId(group.groupId);
          GroupAccount.findOne({ _id }, (err, account) => {
            if (err) {
              return res.status(404).send(err.message);
            } else {
              GroupChat.find({ id: _id })
                .sort({ _id: -1 })
                .limit(1)
                .then((messages) => {
                  if (messages.length > 0) {
                    const msg = messages[0];
                    groupList.push({
                      ...account._doc,
                      lastMessage: msg,
                    });
                  } else {
                    groupList.push({
                      ...account._doc,
                      lastMessage: {
                        _id: msg._id,
                        id: _id,
                        message: "No message available",
                      },
                    });
                  }

                  if (userAccount?.groups?.length === groupList?.length) {
                    const allGroup = groupList.reverse();
                    returnUsersInfo(allGroup);
                  }
                })
                .catch((err) => {
                  return res.status(404).send(err.message);
                });
            }
          });
        });
      }
    }
  });
});

router.put("/updateGroupList/:email", checkLogin, (req, res) => {
  const email = req.params.email;
  const groupInfo = req.body;
  Account.updateOne(
    { email },
    { $addToSet: { groups: groupInfo } },
    (err, data) => {
      if (err) {
        return res.status(500).send(err.message);
      } else {
        return res.status(201).send(data);
      }
    }
  );
});

export default router;
