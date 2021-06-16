import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { account_schema } from "../schema/account-schema";

dotenv.config();

const router = express.Router();
const Account = mongoose.model(
  `${process.env.ACCOUNT_COLLECTION}`,
  account_schema
);

export const userIsOnline = (user) => {
  if (user?.email) {
    Account.updateOne(
      { email: user.email },
      {
        $set: {
          status: "active",
        },
      },
      (err, update) => {
        if (err) {
          console.log(err);
        } else {
          console.log(update.ok);
        }
      }
    );
  }
};

export const updateChatList = (socket) => {
  socket.on("my-account", (userId) => {
    socket.join(userId);
    const newFriend = mongoose.connection.collection("accounts").watch();
    newFriend.on("change", (change) => {
      // console.log(change);

      if (change.operationType === "update") {
        const updateFiled = change?.updateDescription?.updatedFields;
        if (updateFiled?.chatList) {
          let email = "";
          const id = updateFiled?.chatList[updateFiled?.chatList?.length - 1];
          if (id?.friendOf === userId) {
            if (id?.email !== email) {
              email = id?.email;
              console.log(id);
              socket.emit("add-friend-list", { email: id?.email });
            }
          }
        }
      }
    });
  });
};

export const userIsOffLine = (user) => {
  if (user?.email) {
    Account.updateOne(
      { email: user.email },
      {
        $set: {
          status: "inactive",
          goOffLine: new Date().toUTCString(),
        },
      },
      (err, update) => {
        if (err) {
          console.log(err);
        } else {
          console.log(update.ok);
        }
      }
    );
  }
};

router.get("/:email", (req, res) => {
  Account.find({ email: req.params.email }, (err, userAccount) => {
    if (err) {
      res.status(404).send(err.message);
    } else {
      userAccount[0]?.chatList?.forEach((chat) => {
        Account.find({ email: chat.email }, (err, account) => {
          if (err) {
            res.status(404).send(err.message);
          } else {
            const user = account[0];
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
            res.status(200).send(info);
          }
        });
      });
    }
  });
});

router.get("/getFriendDetailsByEmail/:email", (req, res) => {
  Account.find({ email: req.params.email }, (err, account) => {
    if (err) {
      req.status(404).send(err.message);
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
        res.status(200).send(info);
      }
    }
  });
});

router.get("/receiverInfo/:id", (req, res) => {
  Account.find({ _id: req.params.id }, (err, account) => {
    if (err) {
      res.status(404).send(err.message);
    } else {
      res.status(200).send(account[0]);
    }
  });
});

router.get("/allAccount/:searchString", (req, res) => {
  Account.find(
    { displayName: new RegExp(req.params.searchString, "i") },
    (err, accounts) => {
      if (err) {
        res.status(404).send(err.message);
      } else {
        res.status(200).send(accounts);
      }
    }
  );
});

router.post("/", (req, res) => {
  Account.find({ email: req.body.email }, (err, account) => {
    if (err) {
      res.status(404).send(err.message);
    } else {
      if (account[0]) {
        res.status(200).send("Login Successfully");
      } else {
        const newAccount = new Account(req.body);
        newAccount.save((err, result) => {
          if (err) {
            res.status(500).send(err.message);
          } else {
            res.status(201).send(result.insertCount > 0);
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
      if (err) res.status(500).send(err.message);
      else res.status(201).send(data);
    }
  );
});

export default router;
