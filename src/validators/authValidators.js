const { body, param, query } = require('express-validator');

const registerValidator = [
  body('email')
    .trim()
    .isEmail().withMessage('Please provide a valid email address.')
    .normalizeEmail()
    .isLength({ max: 255 }).withMessage('Email must not exceed 255 characters.'),

  body('username')
    .trim()
    .notEmpty().withMessage('Username is required.')
    .isLength({ min: 3, max: 50 }).withMessage('Username must be between 3 and 50 characters.')
    .matches(/^[a-zA-Z0-9_.-]+$/).withMessage('Username may only contain letters, numbers, underscores, dots, and hyphens.')
    .toLowerCase(),

  body('password')
    .isLength({ min: 8, max: 128 }).withMessage('Password must be between 8 and 128 characters.')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number.'),

  body('first_name')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('First name must not exceed 100 characters.')
    .matches(/^[a-zA-Z\s'-]+$/).withMessage('First name contains invalid characters.'),

  body('last_name')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Last name must not exceed 100 characters.')
    .matches(/^[a-zA-Z\s'-]+$/).withMessage('Last name contains invalid characters.'),
];

const loginValidator = [
  body('email')
    .trim()
    .isEmail().withMessage('Please provide a valid email address.')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('Password is required.'),
];

const refreshTokenValidator = [
  body('refresh_token')
    .notEmpty().withMessage('Refresh token is required.'),
];

const updateProfileValidator = [
  body('first_name')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('First name must not exceed 100 characters.')
    .matches(/^[a-zA-Z\s'-]+$/).withMessage('First name contains invalid characters.'),

  body('last_name')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Last name must not exceed 100 characters.')
    .matches(/^[a-zA-Z\s'-]+$/).withMessage('Last name contains invalid characters.'),

  body('avatar_url')
    .optional()
    .trim()
    .isURL().withMessage('Avatar URL must be a valid URL.')
    .isLength({ max: 500 }).withMessage('Avatar URL must not exceed 500 characters.'),
];

const changePasswordValidator = [
  body('current_password')
    .notEmpty().withMessage('Current password is required.'),

  body('new_password')
    .isLength({ min: 8, max: 128 }).withMessage('Password must be between 8 and 128 characters.')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number.'),
];

const uuidValidator = (paramName = 'id') => [
  param(paramName)
    .isUUID(4).withMessage(`${paramName} must be a valid UUID.`),
];

module.exports = {
  registerValidator,
  loginValidator,
  refreshTokenValidator,
  updateProfileValidator,
  changePasswordValidator,
  uuidValidator,
};
