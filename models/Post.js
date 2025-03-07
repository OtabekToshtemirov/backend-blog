import mongoose from 'mongoose';
import slugify from 'slugify';

const postSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    minlength: 6,
    maxlength: 255,
    trim: true,
  },
  slug: {
    type: String,
    unique: true,
    index: true, // Indeks qo'shildi
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
    index: true, // Indeks qo'shildi
  },
  tags: {
    type: [String],
    default: [],
    index: true, // Indeks qo'shildi
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: [],
  }],
  views: {
    type: Number,
    default: 0,
    index: true, // Ko'p qidiriladigan maydon uchun indeks
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
  anonymous: {
    type: Boolean,
    default: false,
  },
  anonymousAuthor: {
    type: String,
    default: null,
  },
}, {
  timestamps: true,
});

// Compound indeks qo'shish - ko'p ishlatiladigan filter kombinatsiyalari uchun
postSchema.index({ createdAt: -1, author: 1 });
postSchema.index({ isPublished: 1, createdAt: -1 });

// Generate slug before saving
postSchema.pre('save', function(next) {
  if (this.isModified('title')) {
    this.slug = slugify(this.title, { lower: true, strict: true });
  }
  next();
});

// Slugni yangilash uchun middleware qo'shish
postSchema.pre('findOneAndUpdate', async function(next) {
  const update = this.getUpdate();
  if (update.title) {
    update.slug = slugify(update.title, { lower: true, strict: true });
  }
  next();
});

const Post = mongoose.model('Post', postSchema);

export default Post;
