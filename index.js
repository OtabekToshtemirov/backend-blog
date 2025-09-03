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
const HOST = process.env.HOST || '0.0.0.0'; // Coolify uchun kerak

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

// Enable CORS for all routes - applying this before any routes
const corsOptions = {
  origin: function (origin, callback) {
    // Barcha domenlarni ruxsat berish development uchun
    const allowedOrigins = [
      'https://www.otablog.uz', 
      'https://otablog.uz', 
      'https://otablog.ijaraol.uz',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'https://frontend-blog-six-theta.vercel.app'
    ];
    
    console.log(`CORS - Origin: ${origin}`);
    
    // Agar origin yo'q bo'lsa (Postman yoki to'g'ridan-to'g'ri server so'rovlari uchun)
    if (!origin) {
      console.log('CORS - No origin, allowing');
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      console.log('CORS - Origin allowed');
      callback(null, true);
    } else {
      // Development rejimida barcha domenlarni ruxsat berish
      if (process.env.NODE_ENV !== 'production') {
        console.log('CORS - Development mode, allowing all origins');
        callback(null, true);
      } else {
        console.log('CORS - Origin blocked:', origin);
        callback(new Error('CORS policy tomonidan bloklandi'), false);
      }
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
};

// Apply CORS middleware before any routes
app.use(cors(corsOptions));

// Handle preflight requests explicitly for all routes
app.options('*', cors(corsOptions));

// Soddalashtirilgan CORS headers middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  console.log(`Request origin: ${origin}`);
  console.log(`Request method: ${req.method}`);
  console.log(`Request path: ${req.path}`);
  
  // Preflight so'rovlar uchun
  if (req.method === 'OPTIONS') {
    console.log('Handling preflight request');
    res.sendStatus(200);
  } else {
    next();
  }
});

// REST API middleware
app.use(express.json());
app.use("/uploads", express.static("uploads"));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} - ${req.method} ${req.url} - IP: ${req.ip || req.connection.remoteAddress}`);
  console.log(`Headers:`, req.headers);
  
  // Response logging
  const originalSend = res.send;
  res.send = function(data) {
    console.log(`${timestamp} - Response: ${res.statusCode} for ${req.method} ${req.url}`);
    originalSend.call(this, data);
  };
  
  next();
});

// Health check endpoint
/**
 * @swagger
 * /health:
 *   get:
 *     summary: Server va database holatini tekshirish
 *     description: Load balancer va monitoring uchun server salomatlik holatini qaytaradi
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Server ishlayapti
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 dbConnection:
 *                   type: string
 *                   example: connected
 *                 serverTime:
 *                   type: string
 *                   example: 2025-09-03T12:00:00.000Z
 *                 uptime:
 *                   type: number
 *                   example: 3600.123
 *       503:
 *         description: Database bilan bog'lanish muammosi
 */
app.get("/health", (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  const healthCheck = {
    status: dbStatus === "connected" ? "ok" : "error",
    dbConnection: dbStatus,
    serverTime: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development'
  };
  
  if (dbStatus === "connected") {
    res.status(200).json(healthCheck);
  } else {
    res.status(503).json(healthCheck);
  }
});

app.get("/", (req, res) => {
  res.json({
    message: "OtaBlog API Server ishlamoqda",
    version: "1.0.0",
    status: "ok",
    endpoints: {
      health: "/health",
      posts: "/posts",
      auth: "/auth/*",
      uploads: "/upload"
    },
    timestamp: new Date().toISOString()
  });
});

// Favicon endpoint
app.get("/favicon.ico", (req, res) => {
  res.status(204).end(); // No content
});

// Debug endpointlari
/**
 * @swagger
 * /debug/info:
 *   get:
 *     summary: Server ma'lumotlarini olish
 *     description: Debugging uchun server holatini ko'rsatadi
 *     tags: [Debug]
 *     responses:
 *       200:
 *         description: Server ma'lumotlari
 */
app.get("/debug/info", (req, res) => {
  res.json({
    server: {
      host: HOST,
      port: PORT,
      environment: process.env.NODE_ENV,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.version
    },
    database: {
      status: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
      host: mongoose.connection.host,
      name: mongoose.connection.name
    },
    request: {
      ip: req.ip,
      headers: req.headers,
      method: req.method,
      url: req.url
    },
    timestamp: new Date().toISOString()
  });
});

/**
 * @swagger
 * /debug/headers:
 *   get:
 *     summary: Request headerlarini ko'rsatish
 *     description: CORS va proxy muammolarini hal qilish uchun
 *     tags: [Debug]
 */
app.get("/debug/headers", (req, res) => {
  res.json({
    headers: req.headers,
    method: req.method,
    url: req.url,
    ip: req.ip,
    protocol: req.protocol,
    secure: req.secure,
    xhr: req.xhr,
    timestamp: new Date().toISOString()
  });
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

const server = app.listen(PORT, HOST, (err) => {
  if (err) {
    console.log("Serverda xato:", err);
    process.exit(1);
  } else {
    console.log(`\n🚀 Server ishga tushdi!`);
    console.log(`📍 Manzil: ${HOST}:${PORT}`);
    console.log(`🌐 URL: http://${HOST}:${PORT}`);
    console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`💾 MongoDB: ${mongoose.connection.readyState === 1 ? '✅ Ulangan' : '❌ Ulanmagan'}`);
    console.log(`📊 Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`);
    console.log(`⏰ Vaqt: ${new Date().toISOString()}`);
    
    // Environment variables tekshirish
    console.log(`\n📋 Environment Variables:`);
    console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`   PORT: ${process.env.PORT}`);
    console.log(`   HOST: ${process.env.HOST}`);
    console.log(`   MongoDB username: ${process.env.MONGODB_USERNAME ? '✅ Mavjud' : '❌ Yo\'q'}`);
    console.log(`   MongoDB password: ${process.env.MONGODB_PASSWORD ? '✅ Mavjud' : '❌ Yo\'q'}`);
    console.log(`   JWT_SECRET: ${process.env.JWT_SECRET ? '✅ Mavjud' : '❌ Yo\'q'}`);
  }
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`\n${signal} signal qabul qilindi. Serverni to'xtatish...`);
  
  server.close(() => {
    console.log('HTTP server yopildi.');
    
    mongoose.connection.close(false, () => {
      console.log('MongoDB ulanishi yopildi.');
      process.exit(0);
    });
  });
  
  // Agar 10 soniyada yopilmasa, majburiy to'xtatish
  setTimeout(() => {
    console.error('Majburiy to\'xtatish, 10 soniya o\'tdi.');
    process.exit(1);
  }, 10000);
};

// Signal handlerlar
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Unhandled promise rejection
process.on('unhandledRejection', (err, promise) => {
  console.error('Unhandled Promise Rejection:', err);
  console.error('Promise:', promise);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Uncaught exception
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Umumi error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  console.error('Request URL:', req.url);
  console.error('Request method:', req.method);
  console.error('Request headers:', req.headers);
  
  res.status(500).json({ 
    message: 'Server xatosi', 
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  console.log(`404 - Topilmagan endpoint: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    message: 'Endpoint topilmadi',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});
