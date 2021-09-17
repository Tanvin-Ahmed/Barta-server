import multer from "multer";
import { GridFsStorage } from "multer-gridfs-storage";
import path from "path";

const uri = `mongodb://${process.env.USER_NAME}:${process.env.USER_PASSWORD}@cluster0-shard-00-00.zhub4.mongodb.net:27017,cluster0-shard-00-01.zhub4.mongodb.net:27017,cluster0-shard-00-02.zhub4.mongodb.net:27017/${process.env.DATABASE_NAME}?ssl=true&replicaSet=atlas-5oevi0-shard-0&authSource=admin&retryWrites=true&w=majority`;
// create storage engin
const storage = new GridFsStorage({
  url: uri,
  options: { useNewUrlParser: true, useUnifiedTopology: true },
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      if (!file.originalname) return reject(new Error("Upload failed"));
      const fileExt = path.extname(file.originalname);
      const filename =
        file.originalname.replace(fileExt, "") + "_" + Date.now() + fileExt;
      const fileInfo = {
        filename,
        bucketName: `${process.env.ONE_ONE_CHAT_COLLECTION}`,
      };
      resolve(fileInfo);
    });
  },
});

export const upload = multer({ storage });
