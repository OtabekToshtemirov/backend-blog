import Post from "../models/Post.js";
import mongoose from "mongoose";

const handleError = (res, err, message) => {
  console.error(err);
  res.status(500).json({ message });
};

const formatImages = (photos) => {
  if (!photos || !Array.isArray(photos)) return [];
  return photos.map(photo => 
    photo.startsWith('/images/') ? photo : `/images/${photo}`
  );
};

const transformPost = (post) => {
  const { _doc } = post;
  return {
    ..._doc,
    photo: formatImages(_doc.photo),
    commentsCount: post.comments?.length || 0,
    likesCount: post.likes?.length || 0,
  };
};

const validateAndCleanTags = (tags) => {
  if (typeof tags === 'string') {
    return tags
      .split(',')
      .map(tag => tag.trim().replace(/^#/, ''))
      .filter(tag => tag.length > 0);
  } else if (Array.isArray(tags)) {
    return tags
      .map(tag => tag.toString().trim().replace(/^#/, ''))
      .filter(tag => tag.length > 0);
  }
  return [];
};

// Optimallashtirilgan funksiyalar - projection va partial population ishlatilgan
export const getPosts = async (req, res) => {
  try {
    const { sortBy = 'date', page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    
    // Saralash parametrlarini aniqlash
    const sortOptions = sortBy === 'views' ? { views: -1 } : { createdAt: -1 };
    
    // Oldindan hisoblangan count
    const totalCount = await Post.countDocuments();
    
    // Faqat kerakli ma'lumotlarni olish uchun projection
    const posts = await Post.find({}, {
      title: 1,
      slug: 1,
      description: { $substr: ["$description", 0, 200] },
      photo: { $slice: ["$photo", 1] }, // Faqat birinchi rasmni olish
      author: 1,
      tags: 1,
      views: 1,
      createdAt: 1,
      isPublished: 1,
      anonymous: 1,
      anonymousAuthor: 1,
      comments: { $slice: 0 }, // Comments sonini bilish uchun, lekin kontentni olmaslik
      likes: { $size: "$likes" } // Likes sonini hisoblash
    })
      .populate("author", "fullname avatar") // Faqat kerakli maydonlarni populate qilish
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .lean() // Mongoose objektlarini oddiy JS objektlariga aylantirish - tezroq
      .exec();

    if (!posts || posts.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: "Postlar topilmadi..." 
      });
    }

    // Comments sonini asl arraydan hisoblash o'rniga hisoblash
    const transformedPosts = posts.map(post => ({
      ...post,
      photo: formatImages(post.photo),
      commentsCount: post.comments?.length || 0,
      likesCount: post.likes || 0
    }));
    
    res.status(200).json({
      posts: transformedPosts,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (err) {
    console.error("Error in getPosts:", err);
    handleError(res, err, "Postlarni olishda xatolik yuz berdi");
  }
};

export const getLastTags = async (req, res) => {
  try {
    // Tezroq tag statistikasi olish uchun aggregate ishlatish
    const tags = await Post.aggregate([
      { $unwind: "$tags" },
      { $group: { _id: "$tags", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $project: { name: "$_id", count: 1, _id: 0 } }
    ]);

    res.status(200).json(tags);
  } catch (err) {
    handleError(res, err, "Xatolik yuz berdi...");
  }
};

export const getPost = async (req, res) => {
  try {
    const doc = await Post.findOneAndUpdate(
      { slug: req.params.slug },
      { $inc: { views: 1 } },
      { returnDocument: "after" }
    )
      .populate("author", "fullname avatar") // Faqat kerakli maydonlarni populate qilish
      .populate({
        path: 'comments',
        options: { sort: { createdAt: -1 }, limit: 10 }, // So'nggi 10 ta kommentlarni olish
        populate: {
          path: 'author',
          select: 'fullname avatar'
        }
      })
      .lean() // Mongoose objektlarini oddiy JS objektlariga aylantirish
      .exec();

    if (!doc) {
      return res.status(404).json({ message: "Maqola topilmadi..." });
    }

    // Post ma'lumotlarini formatlash
    const post = {
      ...doc,
      photo: formatImages(doc.photo),
      commentsCount: doc.comments?.length || 0,
      likesCount: doc.likes?.length || 0
    };
    
    res.status(200).json(post);
  } catch (err) {
    handleError(res, err, "Xatolik yuz berdi...");
  }
};

export const createPost = async (req, res) => {
  try {
    const cleanedTags = validateAndCleanTags(req.body.tags);

    const doc = new Post({
      title: req.body.title,
      description: req.body.description,
      tags: cleanedTags,
      photo: req.body.photo,
      author: req.userId,
      isPublished: req.body.isPublished ?? true,
      anonymous: req.body.anonymous ?? false,
      anonymousAuthor: req.body.anonymous ? "Anonim foydalanuvchi" : null,
    });

    const post = await doc.save();
    res.json(post);
  } catch (err) {
    console.error("Post yaratishda xatolik:", err);
    res.status(500).json({
      message: "Post yaratib bo'lmadi",
    });
  }
};

export const updatePost = async (req, res) => {
  try {
    const post = await Post.findOne({ slug: req.params.slug });

    if (!post) {
      return res.status(404).json({ message: "Post topilmadi" });
    }

    if (post.author.toString() !== req.userId) {
      return res.status(403).json({ message: "Postni o'zgartirish huquqi yo'q" });
    }

    const cleanedTags = validateAndCleanTags(req.body.tags);
    if (cleanedTags.length === 0 && req.body.tags) {
      return res.status(400).json({ 
        success: false,
        errors: [
          { field: 'tags', message: "Invalid value" },
          { field: 'tags', message: "Tags must be comma-separated strings" }
        ]
      });
    }

    const updatedData = {
      title: req.body.title,
      description: req.body.description,
      tags: cleanedTags,
      photo: req.body.photo,
      isPublished: req.body.isPublished ?? post.isPublished,
      anonymous: req.body.anonymous ?? post.anonymous,
      anonymousAuthor: req.body.anonymous ? "Anonim foydalanuvchi" : null,
    };

    const updatedPost = await Post.findOneAndUpdate(
      { slug: req.params.slug },
      updatedData,
      { new: true }
    ).populate("author");

    res.json(updatedPost);
  } catch (err) {
    console.error("Postni yangilashda xatolik:", err);
    res.status(500).json({
      success: false,
      message: "Postni yangilab bo'lmadi",
      error: err.message
    });
  }
};

export const deletePost = async (req, res) => {
  try {
    const post = await Post.findOne({ slug: req.params.slug });
    if (!post) {
      return res.status(404).json({ message: "Post topilmadi..." });
    }
    
    if (post.author.toString() !== req.userId) {
      return res.status(403).json({ message: "Faqat post egasi o'chira oladi" });
    }

    await Post.findOneAndDelete({ slug: req.params.slug });
    res.status(200).json({ message: "Post o'chirildi..." });
  } catch (err) {
    handleError(res, err, "Xatolik yuz berdi...");
  }
};

export const likePost = async (req, res) => {
  try {
    const post = await Post.findOne({ slug: req.params.slug });
    if (!post) {
      return res.status(404).json({ message: "Post topilmadi..." });
    }

    const index = post.likes.indexOf(req.userId);
    if (index === -1) {
      post.likes.push(req.userId);
    } else {
      post.likes.splice(index, 1);
    }

    await post.save();
    const updatedPost = await Post.findById(post._id).populate("author");
    res.status(200).json(transformPost(updatedPost));
  } catch (err) {
    handleError(res, err, "Xatolik yuz berdi...");
  }
};

export const getPostsByTag = async (req, res) => {
  try {
    const tag = req.params.tag.replace(/^#/, ''); // Remove # if it exists
    const posts = await Post.find({ tags: { $regex: new RegExp('^' + tag + '$', 'i') } })
      .populate("author")
      .populate('comments')
      .sort({ createdAt: -1 })
      .exec();

    if (!posts || posts.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: "Bu tegdagi postlar topilmadi..." 
      });
    }

    const transformedPosts = posts.map(transformPost);
    res.status(200).json(transformedPosts);
  } catch (err) {
    console.error("Tag search error:", err);
    handleError(res, err, "Teglar bo'yicha qidirishda xatolik yuz berdi...");
  }
};

export const getLatestPosts = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5; // Default to 5 posts if not specified
    const posts = await Post.find()
      .populate("author")
      .populate('comments')
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();

    if (!posts || posts.length === 0) {
      return res.status(404).json({ message: "Postlar topilmadi..." });
    }

    const transformedPosts = posts.map(transformPost);
    res.status(200).json(transformedPosts);
  } catch (err) {
    handleError(res, err, "Xatolik yuz berdi...");
  }
};

export const getMostViewedPosts = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5; // Default to 5 posts if not specified
    const posts = await Post.find()
      .populate("author")
      .populate('comments')
      .sort({ views: -1 }) // Sort by views in descending order
      .limit(limit)
      .exec();

    if (!posts || posts.length === 0) {
      return res.status(404).json({ message: "Postlar topilmadi..." });
    }

    const transformedPosts = posts.map(transformPost);
    res.status(200).json(transformedPosts);
  } catch (err) {
    handleError(res, err, "Xatolik yuz berdi...");
  }
};
