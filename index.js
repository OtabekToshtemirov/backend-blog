import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import cors from "cors";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();
import { registerValidation, loginValidation, createPostValidation, commentValidation } from "./validation.js";
import { register, login, getMe } from "./controllers/UserController.js";
import { updatePost, createPost, deletePost, getPosts, getPost, getLastTags, likePost, getPostsByTag } from "./controllers/PostController.js";
import { checkAuth, handleValidationErrors } from "./utils/index.js";
import { getAllComments, getComments, addComment } from "./controllers/CommentController.js";

const username = encodeURIComponent(process.env.MONGODB_USERNAME);
const password = encodeURIComponent(process.env.MONGODB_PASSWORD);

const mongoDB = `mongodb+srv://${username}:${password}@otablog.cnweg.mongodb.net/?retryWrites=true&w=majority&appName=Otablog`;

const PORT = process.env.PORT;

mongoose
  .connect(mongoDB)
  .then(() => console.log("Ma'lumotlar bazasi ulandi"))
  .catch((err) => console.log("Ma'lumotlar bazasiga ulanib bo'lmadi", err));

const app = express();

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Ensure uploads directory exists
    if (!fs.existsSync('uploads')) {
      fs.mkdirSync('uploads');
    }
    cb(null, "uploads");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = file.originalname.split('.').pop().toLowerCase();
    cb(null, `${uniqueSuffix}.${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Faqat rasmlar yuklash mumkin! (.jpg, .png, .gif, .webp)'), false);
  }
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

app.use(express.json());
app.use(cors());
app.use("/uploads", express.static("uploads"));

app.get("/", (req, res) => {
  res.send("Server ishlamoqda");
});

// Upload route with better error handling
app.post("/upload", checkAuth, (req, res) => {
  upload.single("image")(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: "Fayl hajmi 5MB dan oshmasligi kerak!" });
      }
      return res.status(400).json({ message: err.message || "Fayl yuklashda xatolik!" });
    }
    
    if (!req.file) {
      return res.status(400).json({ message: "Fayl yuklanmadi" });
    }

    res.json({
      url: `/uploads/${req.file.filename}`,
    });
  });
});

// User routes
app.post("/auth/register", registerValidation, handleValidationErrors, register);
app.post("/auth/login", loginValidation, handleValidationErrors, login);
app.get("/auth/me", checkAuth, getMe);

// Post routes
app.get("/tags", getLastTags);
app.get("/posts", getPosts);
app.get("/posts/tag/:tag", getPostsByTag);  // Add this before the :slug route
app.get("/posts/:slug", getPost);
app.post("/posts", checkAuth, createPostValidation, handleValidationErrors, createPost);
app.patch("/posts/:slug", checkAuth, createPostValidation, handleValidationErrors, updatePost);
app.delete("/posts/:slug", checkAuth, deletePost);
app.post("/posts/:slug/like", checkAuth, likePost);

// Comment routes
app.get("/posts/:slug/comments", getComments);
app.post("/posts/:slug/comments", checkAuth, commentValidation, handleValidationErrors, addComment);
app.get("/comments", getAllComments);

app.listen(PORT, (err) => {
  if (err) {
    console.log("Serverda xato:", err);
  } else {
    console.log("Server 5555 portda ishlamoqda");
  }
});
