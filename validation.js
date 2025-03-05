import { body } from "express-validator";

export const registerValidation = [
  body("email", "Noto'g'ri email format").isEmail(),
  body("password", "Parol kamida 8 ta belgidan iborat bo'lishi kerak").isLength({ min: 8 }),
  body("fullname", "Ism kamida 3 ta belgidan iborat bo'lishi kerak").isLength({ min: 3 }),
  body("avatarUrl", "Avatar URL noto'g'ri").optional().isURL(),
];

export const loginValidation = [
  body("email", "Noto'g'ri email format").isEmail(),
  body("password", "Parol kamida 8 ta belgidan iborat bo'lishi kerak").isLength({ min: 8 }),
];

export const createPostValidation = [
  body("title", "Sarlavha kamida 6 ta belgidan iborat bo'lishi kerak").isLength({ min: 6 }).isString(),
  body("description", "Maqola matni kamida 6 ta belgidan iborat bo'lishi kerak").isLength({ min: 6 }).isString(),
  body("tags", "Teglar massiv yoki vergul bilan ajratilgan satr bo'lishi kerak")
    .custom((value) => {
      if (Array.isArray(value)) {
        return value.every(tag => typeof tag === 'string' && tag.trim().length > 0);
      } else if (typeof value === 'string') {
        return value.split(',').every(tag => tag.trim().length > 0);
      }
      return false;
    }),
  body("photo", "Rasm URLlar massiv bo'lishi kerak").optional().isArray(),
  body("isPublished", "isPublished boolean bo'lishi kerak").optional().isBoolean(),
  body("anonymous", "anonymous boolean bo'lishi kerak").optional().isBoolean(),
];

export const commentValidation = [
  body("text", "Izoh matni kamida 3 ta belgidan iborat bo'lishi kerak").isLength({ min: 3 }).isString(),
  body("anonymous", "anonymous boolean bo'lishi kerak").optional().isBoolean(),
];