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
      let filename =
        file.originalname.replace(fileExt, "") + "◉_◉" + Date.now() + fileExt;
      filename = filename.split(" ").join("_");
      const fileInfo = {
        filename,
        bucketName: `${process.env.ONE_ONE_CHAT_COLLECTION}`,
      };
      resolve(fileInfo);
    });
  },
});

const store = multer({ storage, limits: { fileSize: 20000000 } });

export const uploadMiddleware = (req, res, next) => {
  const upload = store.array("file", 15);
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).send("File to large");
    } else if (err) {
      return res.status(500);
    }
    // all is good
    next();
  });
};
