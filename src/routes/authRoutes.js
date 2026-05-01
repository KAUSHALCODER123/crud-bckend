const express = require('express');
const router  = express.Router();

const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/errorHandler');
const { authLimiter, registerLimiter } = require('../middleware/rateLimiter');
const {
  registerValidator,
  loginValidator,
  refreshTokenValidator,
  updateProfileValidator,
  changePasswordValidator,
} = require('../validators/authValidators');

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication endpoints
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, username, password]
 *             properties:
 *               email:    { type: string, format: email }
 *               username: { type: string, minLength: 3 }
 *               password: { type: string, minLength: 8 }
 *               first_name: { type: string }
 *               last_name:  { type: string }
 *     responses:
 *       201: { description: User created }
 *       409: { description: Email or username already exists }
 *       422: { description: Validation error }
 */
router.post('/register', registerLimiter, registerValidator, validate, authController.register);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login with email and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:    { type: string }
 *               password: { type: string }
 *     responses:
 *       200: { description: Login successful }
 *       401: { description: Invalid credentials }
 */
router.post('/login', authLimiter, loginValidator, validate, authController.login);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh access token
 */
router.post('/refresh', refreshTokenValidator, validate, authController.refreshToken);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout and revoke refresh token
 *     security: [{ bearerAuth: [] }]
 */
router.post('/logout', authenticate, authController.logout);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get current user's profile
 *     security: [{ bearerAuth: [] }]
 */
router.get('/me', authenticate, authController.getProfile);

router.put('/me',
  authenticate,
  updateProfileValidator,
  validate,
  authController.updateProfile
);

router.post('/change-password',
  authenticate,
  changePasswordValidator,
  validate,
  authController.changePassword
);

module.exports = router;
