import jwt from "jsonwebtoken";

export const checkLogin = (req, res, next) => {
  try {
    const { authorization } = req.headers;
    const token = authorization.split(" ")[1];
    const { id, email } = jwt.verify(token, process.env.JWT_SECRET_KEY);
    req.id = id;
    req.email = email;
    next();
  } catch {
    res.status(401).send("Authentication failed");
    // next("Authentication failed");
  }
};
