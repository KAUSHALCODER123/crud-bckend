const rateLimit = require('express-rate-limit');

const createLimiter = (windowMs, max, message) => rateLimit({
  windowMs,
  max,
  message: { success: false, message, timestamp: new Date().toISOString() },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API rate limit
const apiLimiter = createLimiter(
  parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  parseInt(process.env.RATE_LIMIT_MAX) || 100,
  'Too many requests from this IP, please try again later.'
);

// Stricter limit for auth routes
const authLimiter = createLimiter(
  15 * 60 * 1000, // 15 minutes
  20,
  'Too many authentication attempts. Please try again in 15 minutes.'
);

// Very strict for registration (prevent spam)
const registerLimiter = createLimiter(
  60 * 60 * 1000, // 1 hour
  10,
  'Too many registration attempts. Please try again in 1 hour.'
);

module.exports = { apiLimiter, authLimiter, registerLimiter };
