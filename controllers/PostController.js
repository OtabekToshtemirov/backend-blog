import Post from "../models/Post.js";
import mongoose from "mongoose";

const handleError = (res, err, message) => {
  console.error(err);
  res.status(500).json({ message });
};

const formatImages = (photos) => {
  if (!photos || !Array.isArray(photos)) return [];
  return photos.map(photo => 
    photo.startsWith('/uploads/') ? photo : `/uploads/${photo}`
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

export const getPosts = async (req, res) => {
  try {
    const sortBy = req.query.sortBy === 'views' ? { views: -1 } : { createdAt: -1 };
    const posts = await Post.find()
      .populate("author")
      .populate('comments')
      .sort(sortBy)
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
    let tagsArray;
    if (typeof req.body.tags === 'string') {
      tagsArray = req.body.tags.split(",").map(tag => tag.trim());
    } else {
      tagsArray = [];
    }

    const post = new Post({
      title: req.body.title,
      description: req.body.description,
      photo: formatImages(req.body.photo),
      tags: tagsArray,
      author: req.userId,
    });

    const doc = await post.save();
    const populatedDoc = await Post.findById(doc._id)
      .populate("author")
      .exec();
    res.status(201).json(transformPost(populatedDoc));
  } catch (err) {
    handleError(res, err, "Xatolik yuz berdi...");
  }
};

export const updatePost = async (req, res) => {
  try {
    const post = await Post.findOne({ slug: req.params.slug });
    if (!post) {
      return res.status(404).json({ message: "Post topilmadi..." });
    }
    
    if (post.author.toString() !== req.userId) {
      return res.status(403).json({ message: "Faqat post egasi tahrirlashi mumkin" });
    }

    const doc = await Post.findOneAndUpdate(
      { slug: req.params.slug },
      {
        title: req.body.title,
        description: req.body.description,
        photo: formatImages(req.body.photo),
        tags: req.body.tags.split(","),
      },
      { new: true }
    ).populate("author");
    
    res.status(200).json(transformPost(doc));
  } catch (err) {
    handleError(res, err, "Xatolik yuz berdi...");
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
    const tag = req.params.tag;
    const posts = await Post.find({ tags: tag })
      .populate("author")
      .populate('comments')
      .sort({ createdAt: -1 })
      .exec();

    if (!posts || posts.length === 0) {
      return res.status(404).json({ message: "Bu tegdagi postlar topilmadi..." });
    }

    const transformedPosts = posts.map(transformPost);
    res.status(200).json(transformedPosts);
  } catch (err) {
    handleError(res, err, "Xatolik yuz berdi...");
  }
};
