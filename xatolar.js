import express from "express";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { registerValidation } from "./validation.js";
import { validationResult } from "express-validator";
import bcrypt from "bcrypt";
import User from "./models/User.js";

// Foydalanuvchi nomi va parolingizni kiriting
const username = encodeURIComponent("shoraqorgon");
const password = encodeURIComponent("zEt3mOqJy2vfQnuz");

// MongoDB ulanish stringi
const mongoDB = `mongodb+srv://${username}:${password}@telegrambot.wscpeif.mongodb.net/blog?retryWrites=true&w=majority&appName=Telegrambot`;

mongoose
  .connect(mongoDB)
  .then(() => console.log("Ma'lumotlar bazasi ulandi"))
  .catch((err) => console.log("Ma'lumotlar bazasiga ulanib bo'lmadi", err));

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Server ishlamoqda");
});

app.post("/auth/login", async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      return res.status(404).json({
        message: "Foydalanuvchi topilmadi",
      });
    }

    const isValid = await bcrypt.compare(req.body.password, user.password);
    if (!isValid) {
      return res.status(400).json({
        message: "Parol noto'g'ri",
      });
    }

    const token = jwt.sign(
      {
        _id: user._id,
      },
      "secretKey123",
      {
        expiresIn: "30d",
      }
    );

    const { password, ...userData } = user._doc;

    res.status(200).json({ ...userData, token });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Kirishda xatolik yuz berdi",
    });
  }
});

app.post("/auth/register", registerValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(errors.array());
    }

    const passwordHash = req.body.password;
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(passwordHash, salt);

    const doc = new User({
      fullname: req.body.fullname,
      avatarUrl: req.body.avatarUrl,
      email: req.body.email,
      password: hash,
    });

    const user = await doc.save();

    const token = jwt.sign(
      {
        _id: user._id,
      },
      "secretKey123",
      {
        expiresIn: "30d",
      }
    );

    const { password, ...userData } = user._doc;

    res.status(200).json({ ...userData, token });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      message: "Ro'yxatdan o'tishda xatolik yuz berdi",
    });
  }
});

app.listen(5555, (err) => {
  if (err) {
    console.log("Serverda xato:", err);
  } else {
    console.log("Server 5555 portda ishlamoqda");
  }
});
