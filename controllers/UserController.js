import {validationResult} from "express-validator";
import bcrypt from "bcrypt";
import User from "../models/User.js";
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
        console.log(err);
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
        console.log(error);
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
        console.log(e)
        res.status(500).json({message:"Avtorizatsiya tugallanmadi"})
    }
}