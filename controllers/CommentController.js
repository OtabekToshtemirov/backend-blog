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
    const { postId } = req.params;
    const userId = req.userId;

    // Validate the post ID
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(404).json({ message: "Post topilmadi..." });
    }

    // Find the post by ID
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post topilmadi..." });
    }

    // Create and save the new comment
    const newComment = new Comment({
      text,
      author: userId,
      post: postId,
    });

    await newComment.save();

    // Add the comment ID to the post's comments array
    post.comments.push(newComment._id);
    await post.save();

    res.status(201).json(newComment);
  } catch (err) {
    handleError(res, err, "Xatolik yuz berdi...");
  }
};

// Function to get comments for a specific post
export const getComments = async (req, res) => {
  try {
    const { postId } = req.params;

    // Validate the post ID
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(404).json({ message: "Post topilmadi..." });
    }

    // Find the post by ID and populate comments and author details
    const post = await Post.findById(postId).populate({
      path: 'comments',
      populate: { path: 'author', select: 'fullname avatar' },
    });

    if (!post) {
      return res.status(404).json({ message: "Post topilmadi..." });
    }

    res.status(200).json(post.comments);
  } catch (err) {
    handleError(res, err, "Xatolik yuz berdi...");
  }
};

// Function to get all comments
export const getAllComments = async (req, res) => {
  try {
    // Find all comments and populate author details
    const comments = await Comment.find().populate('author', 'fullname avatar');
    res.status(200).json(comments);
  } catch (err) {
    handleError(res, err, "Xatolik yuz berdi...");
  }
};
