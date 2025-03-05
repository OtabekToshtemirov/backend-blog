import {validationResult} from "express-validator";
import bcrypt from "bcrypt";
import User from "../models/User.js";
import Post from "../models/Post.js";
import Comment from "../models/Comment.js";
import jwt from "jsonwebtoken";

export const register = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                message: "Login yoki parol noto'g'ri",
            });
        }

        const passwordHash = req.body.password;
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(passwordHash, salt);

        const doc = new User({
            fullname: req.body.fullname,
            avatarUrl: req.body.avatarUrl,
            email: req.body.email,
            password: hash,
        });

        const user = await doc.save();

        const token = jwt.sign(
            { _id: user._id },
            "secretKey123",
            { expiresIn: "30d" }
        );

        const { password, ...userData } = user._doc;

        res.status(200).json({ ...userData, token });
    } catch (err) {
        res.status(500).json({
            message: "Login yoki parol noto'g'ri",
        });
    }
}

export const login = async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email });
        if (!user || !(await bcrypt.compare(req.body.password, user.password))) {
            return res.status(400).json({
                message: "Login yoki parol noto'g'ri",
            });
        }

        const token = jwt.sign(
            { _id: user._id },
            "secretKey123",
            { expiresIn: "30d" }
        );

        const { password, ...userData } = user._doc;

        res.status(200).json({ ...userData, token });
    } catch (error) {
        res.status(500).json({
            message: "Login yoki parol noto'g'ri",
        });
    }
}

export const getMe =  async (req, res ) =>{
    try {
        const user = await User.findById(req.userId)
        if (!user){
            return res.status(404).json({
                message:"Foydalanuvchi topilmadi!"
            })
        }
        const { password, ...userData } = user._doc;

        res.status(200).json({ ...userData });


    } catch (e) {
        res.status(500).json({message:"Avtorizatsiya tugallanmadi"})
    }
}

export const updateUser = async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({
                message: "Foydalanuvchi topilmadi!"
            });
        }

        const updates = {};
        if (req.body.fullname) updates.fullname = req.body.fullname;
        if (req.body.email) updates.email = req.body.email;
        if (req.body.password) {
            const salt = await bcrypt.genSalt(10);
            updates.password = await bcrypt.hash(req.body.password, salt);
        }

        const updatedUser = await User.findByIdAndUpdate(
            req.userId,
            updates,
            { new: true }
        );

        const { password, ...userData } = updatedUser._doc;
        res.status(200).json(userData);
    } catch (error) {
        res.status(500).json({
            message: "Profilni yangilashda xatolik yuz berdi"
        });
    }
};

export const deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({
                message: "Foydalanuvchi topilmadi!"
            });
        }

        // Foydalanuvchi postlarini anonymlashtirish
        await Post.updateMany(
            { author: req.userId },
            { 
                $set: { 
                    author: null,
                    anonymous: true,
                    anonymousAuthor: "O'chirilgan foydalanuvchi"
                } 
            }
        );

        // Foydalanuvchi kommentlarini anonymlashtirish
        await Comment.updateMany(
            { author: req.userId },
            { 
                $set: { 
                    author: null,
                    anonymous: true,
                    anonymousAuthor: "O'chirilgan foydalanuvchi"
                } 
            }
        );

        // Foydalanuvchining like'larini o'chirish
        await Post.updateMany(
            { likes: req.userId },
            { $pull: { likes: req.userId } }
        );

        // Foydalanuvchini o'chirish
        await User.findByIdAndDelete(req.userId);

        res.status(200).json({
            message: "Foydalanuvchi va tegishli ma'lumotlar muvaffaqiyatli o'chirildi"
        });
    } catch (error) {
        console.error("Deletion error:", error);
        res.status(500).json({
            message: "Foydalanuvchini o'chirishda xatolik yuz berdi"
        });
    }
};