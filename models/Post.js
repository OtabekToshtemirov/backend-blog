import mongoose from 'mongoose';

const postSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    minlength: 6,
    maxlength: 255,
    trim: true,
  },
  description: {
    type: String,
    required: true,
    minlength: 6,
    maxlength: 10000,
    trim: true,
  },
  photo: {
    type: [String],
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  tags: {
    type: [String],
    default: [],
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: [],
  }],
  views: {
    type: Number,
    default: 0,
  },
  isPublished: {
    type: Boolean,
    default: false,
  },
  comments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    default: [],
  }],
}, {
  timestamps: true,
});

const Post = mongoose.model('Post', postSchema);

export default Post;
