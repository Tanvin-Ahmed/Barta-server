import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

export const sendEmail = (options, res) => {
  const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE,
    auth: {
      user: process.env.EMAIL_FROM,
      pass: process.env.EMAIL_PASSWORD,
    },
    tls: {
      rejectUnauthorized: process.env.AUTHORIZATION,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: options.to,
    subject: options.subject,
    html: options.html,
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      res.status(422).send("something is wrong, please try again");
    } else {
      res
        .status(200)
        .send("Please check your mail, some time you will find mail as spam.");
    }
  });
};
