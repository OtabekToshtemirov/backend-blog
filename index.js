import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();
import { registerValidation, loginValidation, createPostValidation } from "./validation.js";
import { register, login, getMe } from "./controllers/UserController.js";
import { updatePost, createPost, deletePost, getPosts, getPost, getLastTags } from "./controllers/PostController.js";
import { checkAuth, handleValidationErrors } from "./utils/index.js";
import { getAllComments, getComments, addComment } from "./controllers/CommentController.js";

// Foydalanuvchi nomi va parolingizni kiriting
const username = encodeURIComponent(process.env.MONGODB_USERNAME);
const password = encodeURIComponent(process.env.MONGODB_PASSWORD);

// MongoDB ulanish stringi
const mongoDB = `mongodb+srv://${username}:${password}@telegrambot.wscpeif.mongodb.net/blog?retryWrites=true&w=majority&appName=Telegrambot`;

mongoose
  .connect(mongoDB)
  .then(() => console.log("Ma'lumotlar bazasi ulandi"))
  .catch((err) => console.log("Ma'lumotlar bazasiga ulanib bo'lmadi", err));

const app = express();


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads");
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});
const upload = multer({ storage });

app.use(express.json());
app.use(cors());
app.use("/uploads", express.static("uploads"));

app.get("/", (req, res) => {
  res.send("Server ishlamoqda");
});

// Upload route
app.post("/upload", checkAuth, upload.single("image"), (req, res) => {
  res.json({
    url: `uploads/${req.file.originalname}`,
  });
});

// User routes
app.post("/auth/register", registerValidation, handleValidationErrors, register);
app.post("/auth/login", loginValidation, handleValidationErrors, login);
app.get("/auth/me", checkAuth, getMe);

// Post routes
app.get("/tags", getLastTags);
app.get("/posts", getPosts);
app.get("/posts/:id", getPost);
app.post("/posts", checkAuth, createPostValidation, handleValidationErrors, createPost);
app.patch("/posts/:id", checkAuth, createPostValidation, handleValidationErrors, updatePost);
app.delete("/posts/:id", checkAuth, deletePost);

// Comment routes
app.get("/posts/:postId/comments", getComments);
app.post("/posts/:postId/comments", checkAuth, handleValidationErrors, addComment);
app.get("/comments",getAllComments);

app.listen(5555, (err) => {
  if (err) {
    console.log("Serverda xato:", err);
  } else {
    console.log("Server 5555 portda ishlamoqda");
  }
});
