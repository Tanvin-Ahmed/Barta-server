import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import userAccount, {
  updateChatList,
  userIsOffLine,
  userIsOnline,
} from "./route/userAccount.js";
import message, { oneOneMessageFromSocket } from "./route/message.js";
import groupAccount from "./route/groupAccount.js";
import groupMessage, { groupChatFromSocket } from "./route/groupMessage.js";

const app = express();
app.use(express.json());
app.use(cors());
dotenv.config();
// app.use(fileUpload());

const httpServer = createServer(app);
export const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});
//
// data base
const uri = `mongodb://${process.env.USER_NAME}:${process.env.USER_PASSWORD}@cluster0-shard-00-00.zhub4.mongodb.net:27017,cluster0-shard-00-01.zhub4.mongodb.net:27017,cluster0-shard-00-02.zhub4.mongodb.net:27017/${process.env.DATABASE_NAME}?ssl=true&replicaSet=atlas-5oevi0-shard-0&authSource=admin&retryWrites=true&w=majority`;

const users = {};
const socketToRoom = {};
let user = {};

mongoose
  .connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
    useFindAndModify: false,
  })
  .then(() => {
    console.log("database connected");
    io.on("connection", (socket) => {
      socket.on("user-info", (userInfo) => {
        user[socket.id] = userInfo.email;
        updateChatList(socket, userInfo.email);
        userIsOnline(userInfo.email);
        socket.broadcast.emit("user-status", { ...userInfo, status: "active" });
      });

      socket.on("join", ({ roomId }) => {
        groupChatFromSocket(socket, roomId);
        oneOneMessageFromSocket(socket, roomId);
      });

      // private call
      socket.on("callUser", (data) => {
        io.emit("callUser", data);
      });

      socket.on("answerCall", (data) => {
        io.emit("callAccepted", data);
      });

      socket.on("call-reach-to-me", (to) => {
        io.emit("call-reach-to-user", to);
      });

      socket.on("cutCall", (data) => {
        io.emit("callEnded", data.to);
      });

      // group call
      socket.on(
        "members to call",
        ({ members, callerID, callerName, roomID, callType }) => {
          members.forEach((member) => {
            socket.broadcast.emit("group call for you", {
              callerID,
              callerName,
              member,
              roomID,
              callType,
            });
          });
        }
      );
      socket.on("join room", ({ roomID, userID, userName }) => {
        if (users[roomID]) {
          users[roomID].push({ id: userID, name: userName });
        } else {
          users[roomID] = [{ id: userID, name: userName }];
        }
        socketToRoom[userID] = roomID;
        const usersInThisRoom = users[roomID].filter(({ id }) => id !== userID);
        socket.emit("all users", { usersInThisRoom, roomID });
        socket.emit("total user", { usersInThisRoom, roomID });
      });

      socket.on(
        "sending signal",
        ({ roomID, userToSignal, callerID, callerName, signal }) => {
          io.emit("user joined", {
            roomID,
            callerID,
            callerName,
            userToSignal,
            signal,
          });
        }
      );

      socket.on("returning signal", (payload) => {
        io.emit("receiving returned signal", {
          signal: payload.signal,
          id: payload.userID,
          roomID: payload.roomID,
          callerID: payload.callerID,
        });
      });

      socket.on("cut call", (userID) => {
        const roomID = socketToRoom[userID];
        let room = users[roomID];
        if (room) {
          room = room.filter(({ id }) => id !== userID);
          users[roomID] = room;
          socket.broadcast.emit("user left", userID);
          if (room.length === 0) {
            const usersInThisRoom = room;
            socket.emit("total user", { usersInThisRoom, roomID });
          }
        }
      });

      // get group call info after reloading
      // socket.on("after reload get user data of group call", (roomID) => {
      //   if (users[roomID].length) {
      //     const usersInThisRoom = users[roomID];
      //     socket.emit("total user", { usersInThisRoom, roomID });
      //   }
      // });

      // disconnect
      socket.on("disconnect", () => {
        // private call
        // io.emit("callEnded", data.to);

        // group call
        const roomID = socketToRoom[user[socket.id]];
        let room = users[roomID];
        if (room) {
          room = room.filter(({ id }) => id !== user[socket.id]);
          users[roomID] = room;
          socket.broadcast.emit("user left", user[socket.id]);
          if (room.length === 0) {
            const usersInThisRoom = room;
            socket.emit("total user", { usersInThisRoom, roomID });
          }
        }

        // update user status
        userIsOffLine(user[socket.id]);
        io.emit("user-status", { email: user[socket.id], status: "inactive" });
        delete user[socket.id];
      });
    });
  })
  .catch((err) => console.log(err));

app.get("/", (req, res) => {
  res.status(200).send(`<h1>Node.js</h1>`);
});

app.use("/user/account", userAccount);
app.use("/chatMessage", message);
app.use("/groupAccount", groupAccount);
app.use("/groupChat", groupMessage);

httpServer.listen(process.env.PORT || 5000, () =>
  console.log("Server is running")
);
