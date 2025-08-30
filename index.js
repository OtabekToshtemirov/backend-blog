import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import cors from "cors";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();
import { registerValidation, loginValidation, createPostValidation, commentValidation } from "./validation.js";
import { register, login, getMe, updateUser, deleteUser } from "./controllers/UserController.js";
import { updatePost, createPost, deletePost, getPosts, getPost, getLastTags, likePost, getPostsByTag, getLatestPosts, getMostViewedPosts } from "./controllers/PostController.js";
import { checkAuth, handleValidationErrors } from "./utils/index.js";
import { getAllComments, getComments, addComment, editComment, deleteComment, getLatestComments } from "./controllers/CommentController.js";
import Image from './models/Image.js';
import sharp from 'sharp';

const username = encodeURIComponent(process.env.MONGODB_USERNAME);
const password = encodeURIComponent(process.env.MONGODB_PASSWORD);
const JWT_SECRET = process.env.JWT_SECRET || 'secretKey123'; // .env faylida JWT_SECRET o'zgaruvchisini qo'shish kerak

// MongoDB ulanish sozlamalari
const connectionOptions = {
  serverSelectionTimeoutMS: 5000, // So'rov vaqti cheklovi
  socketTimeoutMS: 45000, // Socket timeouts
  family: 4, // IPv4 orqali ulanish, tezroq ishlashi mumkin
  maxPoolSize: 10, // Maksimal ulanishlar soni
  minPoolSize: 2,  // Minimal ulanishlar soni
};

const mongoDB = `mongodb+srv://${username}:${password}@otablog.cnweg.mongodb.net/?retryWrites=true&w=majority&appName=Otablog`;
// const mongoDB = `mongodb://localhost:27017/blog`;
const PORT = process.env.PORT || 4444; // Default port qo'shildi

// Qayta urinishlar bilan MongoDB ga ulanish
const connectWithRetry = () => {
  console.log('MongoDB ga ulanish...');
  mongoose
    .connect(mongoDB, connectionOptions)
    .then(() => {
      console.log("Ma'lumotlar bazasi muvaffaqiyatli ulandi");
      // Tegishli indekslarni yaratish
      mongoose.connection.db.command({ ping: 1 })
        .then(() => console.log("Database ping successful"))
        .catch(err => console.error("Database ping failed:", err));
    })
    .catch(err => {
      console.log("MongoDB ulanishda xato:", err);
      console.log("5 soniyadan so'ng qayta urinish...");
      setTimeout(connectWithRetry, 5000);
    });
};

connectWithRetry();

// MongoDB ulanish holatini kuzatish
mongoose.connection.on('error', err => {
  console.error('MongoDB xatosi:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB dan uzildi, qayta ulanish...');
  setTimeout(connectWithRetry, 5000);
});

const app = express();

// Xotira optimizatsiyasi uchun memoryStorage ishlatilmoqda
const upload = multer({ 
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Faqat rasmlar yuklash mumkin! (.jpg, .png, .gif, .webp)'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// REST API middleware
app.use(express.json());
const corsOptions = {
  origin: ['https://www.otablog.uz'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));



app.use("/uploads", express.static("uploads"));

// Health check endpoint
app.get("/health", (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  res.status(200).json({ 
    status: "ok", 
    dbConnection: dbStatus,
    serverTime: new Date().toISOString()
  });
});

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
      // Rasm o'lchamlarini optimallashtirish
      const imgBuffer = req.file.buffer;
      const imgSize = imgBuffer.length;
      let quality = 80; // Default sifat
      
      // Katta rasmlar uchun sifatni kamaytirish
      if (imgSize > 3 * 1024 * 1024) {
        quality = 60;
      } else if (imgSize > 1 * 1024 * 1024) {
        quality = 70;
      }

      // Rasm o'lchamlarini maksimal 1200px gacha cheklash
      const webpBuffer = await sharp(imgBuffer)
        .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
        .webp({ quality }) 
        .toBuffer();
      
      // Filename yaratish
      const originalFilename = req.file.originalname.split('.')[0];
      const newFilename = `${originalFilename}-${Date.now()}.webp`;

      // MongoDB ga saqlash
      const image = new Image({
        filename: newFilename,
        data: webpBuffer,
        contentType: 'image/webp'
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
app.patch("/auth/me", checkAuth, updateUser);
app.delete("/auth/me", checkAuth, deleteUser);

// Post routes - order is important!
app.get("/tags", getLastTags);
app.get("/posts/latest", getLatestPosts);
app.get("/posts/popular", getMostViewedPosts);
app.get("/posts/tag/:tag", getPostsByTag);  // Make sure this comes before /:slug
app.get("/posts/:slug", getPost);
app.get("/posts", getPosts);
app.post("/posts", checkAuth, createPostValidation, handleValidationErrors, createPost);
app.patch("/posts/:slug", checkAuth, createPostValidation, handleValidationErrors, updatePost);
app.delete("/posts/:slug", checkAuth, deletePost);
app.post("/posts/:slug/like", checkAuth, likePost);

// Comment routes
app.get("/comments/latest", getLatestComments);
app.get("/posts/:slug/comments", getComments);
app.post("/posts/:slug/comments", checkAuth, commentValidation, handleValidationErrors, addComment);
app.get("/comments", getAllComments);
app.patch("/comments/:commentId", checkAuth, commentValidation, handleValidationErrors, editComment); // Edit a comment
app.delete("/comments/:commentId", checkAuth, deleteComment); // Delete a comment

app.listen(PORT, (err) => {
  if (err) {
    console.log("Serverda xato:", err);
  } else {
    console.log(`Server ${PORT} portda ishlamoqda`);
  }
});
