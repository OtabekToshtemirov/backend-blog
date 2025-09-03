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

// JWT_SECRET tekshirish va xavfsizlik
let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.warn('⚠️  JWT_SECRET environment variable o\'rnatilmagan!');
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ Production muhitida JWT_SECRET majburiy!');
    // Production muhitida random JWT_SECRET yaratish
    JWT_SECRET = require('crypto').randomBytes(64).toString('hex');
    console.log('🔑 Vaqtinchalik JWT_SECRET yaratildi. Coolifyda JWT_SECRET o\'rnating!');
  } else {
    JWT_SECRET = 'secretKey123';
    console.log('🔧 Development uchun default JWT_SECRET ishlatilmoqda');
  }
}

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
mongoose.connection.on('connected', () => {
  console.log('✅ MongoDB muvaffaqiyatli ulandi');
});

mongoose.connection.on('error', err => {
  console.error('❌ MongoDB xatosi:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('🔌 MongoDB dan uzildi, qayta ulanish...');
  setTimeout(connectWithRetry, 5000);
});

mongoose.connection.on('reconnected', () => {
  console.log('🔄 MongoDB qayta ulandi');
});

const app = express();

// Trust proxy (Coolify/Docker network uchun)
app.set('trust proxy', true);

// Request size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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

// Proxy headers middleware (Coolify uchun)
app.use((req, res, next) => {
  // Proxy headers information logging
  console.log(`\n🌐 Request: ${req.method} ${req.url}`);
  console.log(`📍 Origin: ${req.headers.origin || 'No origin'}`);
  console.log(`🔗 Referer: ${req.headers.referer || 'No referer'}`);
  console.log(`🏠 Host: ${req.headers.host}`);
  console.log(`🌍 X-Forwarded-For: ${req.headers['x-forwarded-for'] || 'Direct'}`);
  console.log(`🔒 X-Forwarded-Proto: ${req.headers['x-forwarded-proto'] || 'http'}`);
  console.log(`📡 User-Agent: ${req.headers['user-agent']?.substring(0, 50)}...`);
  
  // Trust proxy headers (Coolify setup)
  if (req.headers['x-forwarded-for']) {
    req.ip = req.headers['x-forwarded-for'].split(',')[0].trim();
  }
  
  if (req.headers['x-forwarded-proto']) {
    req.protocol = req.headers['x-forwarded-proto'];
  }
  
  // Set response headers for proxy compatibility
  res.header('X-Powered-By', 'OtaBlog-API');
  res.header('X-Response-Time', Date.now());
  
  // Preflight so'rovlar uchun
  if (req.method === 'OPTIONS') {
    console.log('✅ Handling preflight request');
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
  console.log(`\n⏰ ${timestamp} - ${req.method} ${req.url}`);
  console.log(`📍 IP: ${req.ip || req.connection.remoteAddress}`);
  console.log(`🌍 Real IP: ${req.headers['x-real-ip'] || 'N/A'}`);
  console.log(`🔗 Forwarded: ${req.headers['x-forwarded-for'] || 'Direct'}`);
  
  // Response timing
  const startTime = Date.now();
  
  // Response logging
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - startTime;
    console.log(`✅ ${timestamp} - ${res.statusCode} for ${req.method} ${req.url} (${duration}ms)`);
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
    environment: process.env.NODE_ENV || 'development',
    port: PORT,
    host: HOST
  };
  
  // Always return 200 for basic health check to pass load balancer
  res.status(200).json(healthCheck);
});

// Detailed health check for internal use
app.get("/health/detailed", (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  const healthCheck = {
    status: dbStatus === "connected" ? "ok" : "error",
    dbConnection: dbStatus,
    serverTime: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development',
    port: PORT,
    host: HOST,
    version: "1.0.0",
    endpoints: ["/", "/health", "/posts", "/auth/login", "/auth/register"]
  };
  
  if (dbStatus === "connected") {
    res.status(200).json(healthCheck);
  } else {
    res.status(503).json(healthCheck);
  }
});

// Readiness probe
app.get("/ready", (req, res) => {
  const dbReady = mongoose.connection.readyState === 1;
  if (dbReady) {
    res.status(200).json({ status: "ready" });
  } else {
    res.status(503).json({ status: "not ready", reason: "database not connected" });
  }
});

// Liveness probe
app.get("/live", (req, res) => {
  res.status(200).json({ status: "alive", timestamp: new Date().toISOString() });
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

// Coolify troubleshooting endpoints
app.get("/debug/proxy", (req, res) => {
  res.json({
    message: "Proxy diagnostic info",
    serverInfo: {
      host: HOST,
      port: PORT,
      environment: process.env.NODE_ENV,
      uptime: process.uptime()
    },
    request: {
      method: req.method,
      url: req.url,
      originalUrl: req.originalUrl,
      protocol: req.protocol,
      secure: req.secure,
      ip: req.ip,
      ips: req.ips,
      host: req.get('host'),
      origin: req.get('origin'),
      referer: req.get('referer')
    },
    headers: {
      'x-forwarded-for': req.headers['x-forwarded-for'],
      'x-forwarded-proto': req.headers['x-forwarded-proto'],
      'x-forwarded-host': req.headers['x-forwarded-host'],
      'x-real-ip': req.headers['x-real-ip'],
      'host': req.headers['host'],
      'user-agent': req.headers['user-agent']
    },
    coolify: {
      internal_url: `http://vsc88csg8okgkscg8080ko4k.158.220.108.219.sslip.io`,
      public_url: `https://otablog.ijaraol.uz`,
      expected_port: PORT,
      expected_host: HOST
    },
    timestamp: new Date().toISOString()
  });
});

// Simple ping endpoint
app.get("/ping", (req, res) => {
  res.json({ 
    message: "pong", 
    timestamp: new Date().toISOString(),
    server: `${HOST}:${PORT}`
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
    console.log("❌ Serverda xato:", err);
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
    console.log(`   JWT_SECRET: ${process.env.JWT_SECRET ? '✅ Mavjud' : '🔧 Auto-generated'}`);
    
    console.log(`\n📡 Endpointlar:`);
    console.log(`   🏠 Root: /`);
    console.log(`   💚 Health: /health`);
    console.log(`   🔍 Detailed Health: /health/detailed`);
    console.log(`   ✅ Ready: /ready`);
    console.log(`   💓 Live: /live`);
    console.log(`   🐛 Debug Info: /debug/info`);
    console.log(`   📊 Debug Headers: /debug/headers`);
    console.log(`   📝 Posts: /posts`);
    console.log(`   👤 Auth: /auth/*`);
    console.log(`   📷 Upload: /upload`);
    
    if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
      console.warn(`\n⚠️  MUHIM: Coolifyda JWT_SECRET environment variable o'rnating!`);
    }
    
    // Container readiness signal
    console.log(`\n🟢 Server tayyor - so'rovlarni qabul qilish mumkin!`);
  }
});

// Improved graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`\n🛑 ${signal} signal qabul qilindi. Serverni to'xtatish...`);
  
  // HTTP serverni yangi connectionlarni qabul qilishni to'xtatish
  server.close(() => {
    console.log('🔌 HTTP server yopildi (yangi so\'rovlar qabul qilinmaydi).');
    
    // MongoDB ulanishini yopish
    mongoose.connection.close(false, () => {
      console.log('💾 MongoDB ulanishi yopildi.');
      console.log('✅ Graceful shutdown tugallandi.');
      process.exit(0);
    });
  });
  
  // Aktiv connectionlar tugashini kutish
  setTimeout(() => {
    console.error('⏰ 15 soniya o\'tdi, majburiy to\'xtatish...');
    process.exit(1);
  }, 15000); // Coolify uchun ko'proq vaqt
};

// Container lifecycle signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM')); // Docker stop
process.on('SIGINT', () => gracefulShutdown('SIGINT'));   // Ctrl+C
process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));   // Terminal closed

// Error handling
process.on('unhandledRejection', (err, promise) => {
  console.error('❌ Unhandled Promise Rejection:', err);
  console.error('Promise:', promise);
  // Production da restart, development da continue
  if (process.env.NODE_ENV === 'production') {
    gracefulShutdown('UNHANDLED_REJECTION');
  }
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
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
