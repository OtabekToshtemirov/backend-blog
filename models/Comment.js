import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      minlength: 3,
      maxlength: 1000,
      trim: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, // Indeks qo'shildi
    },
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
      index: true, // Indeks qo'shildi
    },
    anonymous: {
      type: Boolean,
      default: false
    },
    anonymousAuthor: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true,
  }
);

// Compound indeks - comment izlashni tezlashtirish uchun
commentSchema.index({ post: 1, createdAt: -1 });

const Comment = mongoose.model("Comment", commentSchema);

export default Comment;
