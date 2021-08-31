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
import groupMessage from "./route/groupMessage.js";

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
      let user = {};
      socket.on("user-info", (userInfo) => {
        user = userInfo;
        userIsOnline(userInfo);
        socket.broadcast.emit("user-status", { ...user, status: "active" });
      });

      updateChatList(socket, user?.email);
      socket.on("join", ({ roomId }) => {
        oneOneMessageFromSocket(socket, roomId);
      });

      // private video call
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

      socket.on("disconnect", () => {
        userIsOffLine(user);
        io.emit("user-status", { ...user, status: "inactive" });
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
