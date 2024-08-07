import Post from "../models/Post.js";
import mongoose from "mongoose";

const handleError = (res, err, message) => {
  console.error(err);
  res.status(500).json({ message });
};



export const getPosts = async (req, res) => {
  try {
    const sortBy = req.query.sortBy === 'views' ? { views: -1 } : { createdAt: -1 };
    const posts = await Post.find()
      .populate("author")
      .sort(sortBy)
      .exec();
    if (!posts || posts.length === 0) {
      return res.status(404).json({ message: "Postlar topilmadi..." });
    }
    res.status(200).json(posts);
  } catch (err) {
    handleError(res, err, "Xatolik yuz berdi...");
  }
};

export const getLastTags = async (req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 }).limit(5).exec();
    const tags = posts
      .map((post) => post.tags)
      .flat()
      .slice(0, 5);
    const uniqueTags = [...new Set(tags)];
    res.status(200).json(uniqueTags);
  } catch (err) {
    handleError(res, err, "Xatolik yuz berdi...");
  }
};

export const getPost = async (req, res) => {
  try {
    const doc = await Post.findByIdAndUpdate(
      req.params.id,
      { $inc: { views: 1 } },
      { returnDocument: "after" }
    )
      .populate("author")
      .exec();

    if (!doc) {
      return res.status(404).json({ message: "Maqola topilmadi..." });
    }
    res.status(200).json(doc);
  } catch (err) {
    handleError(res, err, "Xatolik yuz berdi...");
  }
};

export const createPost = async (req, res) => {
  try {
    let tagsArray;
    if (typeof req.body.tags === 'string') {
      tagsArray = req.body.tags.split(",").map(tag => tag.trim()); // Trim spaces around tags
    } else {
      tagsArray = [];
    }

    const post = new Post({
      title: req.body.title,
      description: req.body.description,
      photo: req.body.photo,
      tags: tagsArray,
      author: req.userId,
    });

    const doc = await post.save();
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({
      message: "Xatolik yuz berdi..."
    });
  }
};

export const updatePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: "Post topilmadi..." });
    }
    const doc = await Post.findByIdAndUpdate(req.params.id, {
        title: req.body.title,
        description: req.body.description,
        photo: req.body.photo,
        tags: req.body.tags.split(","),
    }, {
      new: true,
    });
    res.status(200).json(doc);
  } catch (err) {
    handleError(res, err, "Xatolik yuz berdi...");
  }
};

export const deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: "Post topilmadi..." });
    }
    await Post.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Post o'chirildi..." });
  } catch (err) {
    handleError(res, err, "Xatolik yuz berdi...");
  }
};

export const likePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: "Post topilmadi..." });
    }
    if (post.likes.includes(req.userId)) {
      return res
        .status(403)
        .json({ message: "Postni qo'llab-quvvatlash mumkin emas..." });
    }
    const doc = await Post.findByIdAndUpdate(
      req.params.id,
      { $push: { likes: req.userId } },
      { new: true }
    );
    res.status(200).json(doc);
  } catch (err) {
    handleError(res, err, "Xatolik yuz berdi...");
  }
};

export const unlikePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: "Post topilmadi..." });
    }
    if (!post.likes.includes(req.userId)) {
      return res
        .status(403)
        .json({ message: "Postni qo'llab-quvvatlamaydi..." });
    }
    const doc = await Post.findByIdAndUpdate(
      req.params.id,
      { $pull: { likes: req.userId } },
      { new: true }
    );
    res.status(200).json(doc);
  } catch (err) {
    handleError(res, err, "Xatolik yuz berdi...");
  }
};
