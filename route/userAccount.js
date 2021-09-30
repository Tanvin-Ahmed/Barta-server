import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { account_schema } from "../schema/account-schema";
import { groupAccountSchema } from "../schema/group-account-schema";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

dotenv.config();

const router = express.Router();
const Account = mongoose.model(
  `${process.env.ACCOUNT_COLLECTION}`,
  account_schema
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

  const newFriend = mongoose.connection.collection("accounts").watch();
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
          socket.emit("add-group-list", id?.groupName);
        }
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

router.get("/:email", (req, res) => {
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
            friend.push(account);
            if (userAccount?.chatList?.length === friend?.length) {
              const friends = friend.reverse();
              returnUsersInfo(friends);
            }
          }
        });
      });
    }
  });
});

router.get("/getFriendDetailsByEmail/:email", (req, res) => {
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

router.get("/receiverInfo/:id", (req, res) => {
  Account.find({ _id: req.params.id }, (err, account) => {
    if (err) {
      return res.status(404).send(err.message);
    } else {
      return res.status(200).send(account[0]);
    }
  });
});

router.get("/allAccount/:searchString", (req, res) => {
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
        });
        newUser.save((err, user) => {
          if (err) return res.status(500).send("Sign In failed");

          // generate token
          const token = jwt.sign(
            {
              _id: user._id,
              email: user.email,
              displayName: user.displayName,
              status: "active",
            },
            process.env.JWT_SECRET_KEY,
            { expiresIn: "12h" }
          );

          return res.status(200).send(token);
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
          { expiresIn: "12h" }
        );

        res.status(200).send(token);
      })
      .catch((err) => res.status(404).send(err.message));
  });
});

router.post("/", (req, res) => {
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

router.put("/updateChatList/:email", (req, res) => {
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

router.get("/groupList/:email", (req, res) => {
  Account.findOne({ email: req.params.email }, (err, userAccount) => {
    if (err) {
      return res.status(404).send(err.message);
    } else {
      if (!userAccount?.groups.length) {
        return res.status(200).send(userAccount?.groups);
      } else {
        const returnUsersInfo = (allGroup) => {
          return res.status(200).send(allGroup);
        };
        const groupList = [];
        userAccount?.groups?.forEach((group) => {
          GroupAccount.findOne(
            { groupName: group.groupName },
            (err, account) => {
              if (err) {
                return res.status(404).send(err.message);
              } else {
                groupList.push(account);
                if (userAccount?.groups?.length === groupList?.length) {
                  const allGroup = groupList.reverse();
                  returnUsersInfo(allGroup);
                }
              }
            }
          );
        });
      }
    }
  });
});

router.put("/updateGroupList/:email", (req, res) => {
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
