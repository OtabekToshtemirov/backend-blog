import Comment from "../models/Comment.js";
import Post from "../models/Post.js";
import mongoose from "mongoose";

/**
 * Standardized error handling helper
 */
const handleError = (res, err, message) => {
  console.error(`Error: ${message}`, err);
  res.status(500).json({
    success: false,
    message,
    error: process.env.NODE_ENV === 'production' ? null : err.message
  });
};

/**
 * Helper function to populate comment data consistently
 */
const populateComment = async (commentId) => {
  return Comment.findById(commentId)
    .populate('author', 'fullname avatar')
    .populate('post', 'title slug')
    .lean();
};

/**
 * Add a comment to a post
 */
export const addComment = async (req, res) => {
  try {
    const postSlug = req.params.slug;
    const post = await Post.findOne({ slug: postSlug });

    if (!post) {
      return res.status(404).json({ 
        success: false,
        message: "Post topilmadi" 
      });
    }

    const newComment = new Comment({
      text: req.body.text,
      post: post._id,
      author: req.userId,
      anonymous: req.body.anonymous ?? false,
      anonymousAuthor: req.body.anonymous ? "Anonim foydalanuvchi" : null,
    });

    // Use a session for transaction to ensure consistency
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Save comment
      const savedComment = await newComment.save({ session });
      
      
      // Update post's comments array with one query
      await Post.findByIdAndUpdate(
        post._id,
        { $push: { comments: savedComment._id } },
        { session }
      );

      await session.commitTransaction();
      session.endSession();
      
      // Get populated comment
      const populatedComment = await populateComment(savedComment._id);
      

      // Return flattened response structure for tests compatibility
      // IMPORTANT: Tests expect _id directly at the root level, not nested under "comment"
      res.status(201).json({
        _id: savedComment._id.toString(), // Explicit ID at root level for tests
        text: populatedComment.text,
        author: populatedComment.author,
        post: populatedComment.post,
        anonymous: populatedComment.anonymous,
        anonymousAuthor: populatedComment.anonymousAuthor,
        createdAt: populatedComment.createdAt,
        updatedAt: populatedComment.updatedAt,
        success: true
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (error) {
    handleError(res, error, "Izoh qo'shishda xatolik yuz berdi");
  }
};

/**
 * Get comments for a specific post
 */
export const getComments = async (req, res) => {
  try {
    const post = await Post.findOne({ slug: req.params.slug });
    if (!post) {
      return res.status(404).json({ 
        success: false,
        message: "Post topilmadi" 
      });
    }

    // Use find for better performance with large datasets
    const comments = await Comment.find({ post: post._id })
      .populate('author', 'fullname avatar')
      .sort({ createdAt: -1 })
      .lean();

    // Return the array directly as the tests expect
    res.json(comments);
  } catch (err) {
    handleError(res, err, "Izohlarni olishda xatolik yuz berdi");
  }
};

/**
 * Edit an existing comment
 */
export const editComment = async (req, res) => {
  try {
    const { text, anonymous } = req.body;
    const { commentId } = req.params;
    const userId = req.userId;

    // Find and update in one operation for better performance
    const updatedComment = await Comment.findOneAndUpdate(
      { _id: commentId, author: userId },
      { 
        text, 
        anonymous: anonymous ?? false,
        anonymousAuthor: anonymous ? "Anonim foydalanuvchi" : null,
        updatedAt: new Date() 
      },
      { new: true }
    ).populate('author', 'fullname avatar');

    if (!updatedComment) {
      return res.status(404).json({ 
        success: false,
        message: "Izoh topilmadi yoki sizga ruxsat berilmagan" 
      });
    }

    // Tests expect the comment object directly
    res.json(updatedComment);
  } catch (err) {
    handleError(res, err, "Izohni tahrirlashda xatolik yuz berdi");
  }
};

/**
 * Delete a comment
 */
export const deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.userId;

    // First, find the comment to get the post ID
    const comment = await Comment.findOne({ _id: commentId, author: userId });
    
    if (!comment) {
      return res.status(404).json({ 
        success: false,
        message: "Izoh topilmadi yoki sizga ruxsat berilmagan" 
      });
    }
    
    const postId = comment.post;
    
    // Use a session to ensure both operations succeed or fail together
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Delete comment
      await Comment.deleteOne({ _id: commentId }).session(session);
      
      // Remove comment reference from post
      await Post.updateOne(
        { _id: postId },
        { $pull: { comments: commentId } }
      ).session(session);
      
      await session.commitTransaction();
      session.endSession();
      
      res.json({ 
        success: true,
        message: "Izoh muvaffaqiyatli o'chirildi" 
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (err) {
    handleError(res, err, "Izohni o'chirishda xatolik yuz berdi");
  }
};

/**
 * Get all comments with pagination support
 */
export const getAllComments = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Count total for pagination info
    const total = await Comment.countDocuments();
    
    const comments = await Comment.find()
      .populate('author', 'fullname avatar')
      .populate('post', 'title slug')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Tests expect an array directly
    res.json(comments);
  } catch (err) {
    handleError(res, err, "Izohlarni olishda xatolik yuz berdi");
  }
};

/**
 * Get latest comments
 */
export const getLatestComments = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    
    // Use projection to limit data returned for better performance
    const comments = await Comment.find()
      .populate('author', 'fullname avatar')
      .populate('post', 'title slug')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    // Tests expect an array directly
    res.json(comments);
  } catch (err) {
    handleError(res, err, "So'nggi izohlarni olishda xatolik yuz berdi");
  }
};