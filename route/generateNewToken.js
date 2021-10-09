import jwt from "jsonwebtoken";
import express from "express";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();

router.post("/get-new-jwt", (req, res) => {
  // generate token
  const token = jwt.sign(req.body, process.env.JWT_SECRET_KEY, {
    expiresIn: "5d",
  });

  res.status(200).send(token);
});

export default router;
