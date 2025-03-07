import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

// JWT sekret kalitini environment variables dan olish
const JWT_SECRET = process.env.JWT_SECRET || 'secretKey123';

export default (req, res, next) => {
    try {
        // Token ni olish va tekshirish
        const token = (req.headers.authorization || '').replace(/Bearer\s?/,'');
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Avtorizatsiyadan o'tilmagan"
            });
        }
        
        // JWT ni tekshirish
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.userId = decoded._id;
            next();
        } catch (e) {
            if (e instanceof jwt.TokenExpiredError) {
                return res.status(401).json({
                    success: false,
                    message: "Token muddati tugagan, qayta login qiling"
                });
            }
            
            if (e instanceof jwt.JsonWebTokenError) {
                return res.status(401).json({
                    success: false,
                    message: "Noto'g'ri token"
                });
            }
            
            return res.status(403).json({
                success: false,
                message: "Avtorizatsiya tugallanmadi"
            });
        }
    } catch (e) {
        console.error("Auth middleware error:", e);
        return res.status(500).json({
            success: false,
            message: "Server xatosi, qayta urinib ko'ring"
        });
    }
};