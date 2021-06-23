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

const app = express();
app.use(express.json());
app.use(cors());
dotenv.config();

const httpServer = createServer(app);
export const io = new Server(httpServer, {
  cors: true,
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
    const connection = mongoose.connection;
    io.on("connection", (socket) => {
      let user = {};
      socket.on("user-info", (userInfo) => {
        user = userInfo;
        userIsOnline(userInfo);
        socket.broadcast.emit("user-status", { ...user, status: "active" });
      });

      updateChatList(socket);
      oneOneMessageFromSocket(socket);

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

httpServer.listen(process.env.PORT || 5000, () =>
  console.log("Server is running")
);
