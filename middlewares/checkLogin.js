import jwt from "jsonwebtoken";

export const checkLogin = (req, res, next) => {
  const { authorization } = req.headers;

  try {
    const token = authorization.split(" ")[1];
    const { id, email } = jwt.verify(token, process.env.JWT_SECRET_KEY);
    req.id = id;
    req.email = email;
    next();
  } catch {
    next("Authentication failed");
  }
};
