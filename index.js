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
import Image from './models/Image.js';
import sharp from 'sharp';

const username = encodeURIComponent(process.env.MONGODB_USERNAME);
const password = encodeURIComponent(process.env.MONGODB_PASSWORD);


const mongoDB = `mongodb+srv://${username}:${password}@otablog.cnweg.mongodb.net/?retryWrites=true&w=majority&appName=Otablog`;
// const mongoDB = `mongodb://localhost:27017/blog`;
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
  storage: multer.memoryStorage(), // diskStorage o'rniga memoryStorage ishlatiladi
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

app.use(express.json());
app.use(cors({
  origin: [
    'https://frontend-blog-umber.vercel.app',
    'https://otablog.uz',
    'https://www.otablog.uz'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use("/uploads", express.static("uploads"));

app.get("/", (req, res) => {
  res.send("Server ishlamoqda");
});

// Yangilangan upload endpointi
app.post("/upload", checkAuth, (req, res) => {
  upload.single("image")(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: "Fayl hajmi 5MB dan oshmasligi kerak!" });
      }
      return res.status(400).json({ message: err.message || "Fayl yuklashda xatolik!" });
    }
    
    if (!req.file) {
      return res.status(400).json({ message: "Fayl yuklanmadi" });
    }

    try {
      // Convert image to WebP format using sharp
      const webpBuffer = await sharp(req.file.buffer)
        .webp({ quality: 80 }) // Adjust quality as needed (0-100)
        .toBuffer();
      
      // Create filename with .webp extension
      const originalFilename = req.file.originalname.split('.')[0];
      const newFilename = `${originalFilename}-${Date.now()}.webp`;

      // Save WebP image to MongoDB
      const image = new Image({
        filename: newFilename,
        data: webpBuffer,
        contentType: 'image/webp' // Always webp now
      });

      await image.save();

      res.json({
        url: `/images/${image._id}`,
        format: 'webp'
      });
    } catch (error) {
      console.error("Rasmni WebP formatiga o'tkazishda xatolik:", error);
      res.status(500).json({ message: "Rasm saqlashda xatolik yuz berdi" });
    }
  });
});

// Yangi endpoint rasmlarni olish uchun
app.get("/images/:id", async (req, res) => {
  try {
    const image = await Image.findById(req.params.id);
    if (!image) {
      return res.status(404).json({ message: "Rasm topilmadi" });
    }

    res.set('Content-Type', image.contentType);
    res.send(image.data);
  } catch (error) {
    res.status(500).json({ message: "Rasmni yuklashda xatolik yuz berdi" });
  }
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
