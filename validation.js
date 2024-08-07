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
    body('title').isString().isLength({min:3}),
    body('description').isString().isLength({min:3}),
    body('tags').isString().isLength({min:3}),
    body('photo').isString().optional(),
]