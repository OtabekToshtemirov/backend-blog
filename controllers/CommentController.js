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
    const postId = req.params.postId;
    const post = await Post.findById(postId);
    
    if (!post) {
      return res.status(404).json({ message: "Post topilmadi" });
    }

    const newComment = new Comment({
      text: req.body.text,
      post: postId,
      author: req.userId,
      anonymous: req.body.anonymous ?? false,
      anonymousAuthor: req.body.anonymous ? "Anonim foydalanuvchi" : null,
    });

    const savedComment = await newComment.save();
    
    // Add to post's comments array
    post.comments.push(savedComment._id);
    await post.save();

    // Populate author info for response
    const populatedComment = await Comment.findById(savedComment._id)
      .populate('author', 'fullname avatar');

    res.status(201).json(populatedComment);
  } catch (error) {
    console.error("Comment yaratishda xatolik:", error);
    res.status(500).json({ message: "Izoh qo'shishda xatolik yuz berdi" });
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

export const editComment = async (req, res) => {
  try {
    const { text } = req.body;
    const { commentId } = req.params;
    const userId = req.userId;

    const comment = await Comment 
      .findOne({ _id: commentId, author: userId })
      .exec();

    if (!comment) {
      return res.status(404).json({ message: "Izoh topilmadi yoki sizga ruxsat berilmagan" });
    }

    comment.text = text;
    await comment.save();

    res.json(comment);
  }
  catch (err) {
    handleError(res, err, "Izohni tahrirlashda xatolik yuz berdi");
  }

};

export const deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.userId;

    const comment = await Comment 
      .findOne({ _id: commentId, author: userId })
      .exec();

    if (!comment) {
      return res.status(404).json({ message: "Izoh topilmadi yoki sizga ruxsat berilmagan" });
    }

    await Comment.deleteOne({ _id: commentId }).exec();

    res.json({ message: "Izoh o'chirildi" });
  }
  catch (err) {
    handleError(res, err, "Izohni o'chirishda xatolik yuz berdi");
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

// Function to get latest comments
export const getLatestComments = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const comments = await Comment.find()
      .populate('author')
      .populate('post')
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();

    res.json(comments);
  } catch (err) {
    handleError(res, err, "So'nggi izohlarni olishda xatolik yuz berdi");
  }
};
