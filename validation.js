import { body } from 'express-validator';

export const registerValidation = [
    body('email').isEmail().withMessage('Invalid email format'),
    body('password').isLength({ min: 5 }).withMessage('Password must be at least 5 characters long'),
    body('fullname').isLength({ min: 3 }).withMessage('Full name must be at least 3 characters long'),
    body('avatarUrl').optional().isURL().withMessage('Avatar URL must be a valid URL'),
]

export const loginValidation = [
    body('email').isEmail().withMessage('Invalid email format'),
    body('password').isLength({ min: 5 }).withMessage('Password must be at least 5 characters long'),
]

export const createPostValidation = [
    body('title')
        .isString()
        .isLength({ min: 6, max: 255 })
        .withMessage('Title must be between 6 and 255 characters'),
    body('description')
        .isString()
        .isLength({ min: 6 })
        .withMessage('Description must be at least 6 characters'),
    body('tags')
        .optional()
        .isString()
        .custom((value) => {
            if (value) {
                const tags = value.split(',').map(tag => tag.trim());
                return tags.every(tag => tag.length > 0);
            }
            return true;
        })
        .withMessage('Tags must be comma-separated strings'),
    body('photo')
        .optional()
        .custom((value) => {
            if (Array.isArray(value)) {
                return value.every(url => typeof url === 'string');
            }
            return typeof value === 'string';
        })
        .withMessage('Photo must be a string or array of strings'),
];

export const commentValidation = [
    body('text')
        .isString()
        .trim()
        .isLength({ min: 3, max: 1000 })
        .withMessage('Izoh matni 3 dan 1000 gacha belgidan iborat bo\'lishi kerak'),
];