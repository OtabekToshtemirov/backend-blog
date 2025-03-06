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

export const getPosts = async (req, res) => {
  try {
     // Debug log
    const sortBy = req.query.sortBy === 'views' ? '-views' : '-createdAt';
    
     // Debug log
    const posts = await Post.find()
      .populate("author")
      .populate('comments')
      .sort(sortBy)
      .exec();

     // Debug log

    if (!posts || posts.length === 0) {
       // Debug log
      return res.status(404).json({ 
        success: false,
        message: "Postlar topilmadi..." 
      });
    }

    const transformedPosts = posts.map(transformPost);
     // Debug log
    
    res.status(200).json(transformedPosts);
  } catch (err) {
    console.error("Error in getPosts:", err); // Detailed error log
    handleError(res, err, "Postlarni olishda xatolik yuz berdi");
  }
};

export const getLastTags = async (req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 }).exec();
    
    // Create a map to count tag occurrences
    const tagCount = {};
    posts.forEach(post => {
      post.tags.forEach(tag => {
        tagCount[tag] = (tagCount[tag] || 0) + 1;
      });
    });

    // Convert to array of objects with name and count
    const tags = Object.entries(tagCount)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);  // Get top 10 tags

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
      .populate("author")
      .populate({
        path: 'comments',
        populate: {
          path: 'author',
          select: 'fullname avatar'
        }
      })
      .exec();

    if (!doc) {
      return res.status(404).json({ message: "Maqola topilmadi..." });
    }

    const post = transformPost(doc);
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
