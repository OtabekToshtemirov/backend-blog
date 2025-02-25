import Comment from "../models/Comment.js";
import Post from "../models/Post.js";
import mongoose from "mongoose";

// Error handling helper function
const handleError = (res, err, message) => {
  console.error(err);
  res.status(500).json({ message });
};

// Function to add a comment to a post
export const addComment = async (req, res) => {
  try {
    const { text } = req.body;
    const { slug } = req.params;
    const userId = req.userId;

    const post = await Post.findOne({ slug });
    if (!post) {
      return res.status(404).json({ message: "Post topilmadi..." });
    }

    const newComment = new Comment({
      text,
      author: userId,
      post: post._id,
    });

    await newComment.save();

    const populatedComment = await Comment.findById(newComment._id)
      .populate('author')
      .exec();

    res.json(populatedComment);
  } catch (err) {
    handleError(res, err, "Izoh qo'shishda xatolik yuz berdi");
  }
};

// Function to get comments for a specific post
export const getComments = async (req, res) => {
  try {
    const post = await Post.findOne({ slug: req.params.slug });
    if (!post) {
      return res.status(404).json({ message: "Post topilmadi..." });
    }

    const comments = await Comment.find({ post: post._id })
      .populate('author')
      .sort({ createdAt: -1 })
      .exec();

    res.json(comments);
  } catch (err) {
    handleError(res, err, "Izohlarni olishda xatolik yuz berdi");
  }
};

// Function to get all comments
export const getAllComments = async (req, res) => {
  try {
    const comments = await Comment.find()
      .populate('author')
      .populate('post')
      .sort({ createdAt: -1 })
      .exec();

    res.json(comments);
  } catch (err) {
    handleError(res, err, "Izohlarni olishda xatolik yuz berdi");
  }
};
