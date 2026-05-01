const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

/**
 * Generate an access token (short-lived)
 */
const generateAccessToken = (payload) => {
  return jwt.sign(
    { ...payload, type: 'access' },
    process.env.JWT_SECRET || 'dev_access_secret_123',
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
};

/**
 * Generate a refresh token (long-lived)
 */
const generateRefreshToken = (payload) => {
  return jwt.sign(
    { ...payload, type: 'refresh', jti: uuidv4() },
    process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_123',
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
};

/**
 * Verify an access token
 */
const verifyAccessToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_access_secret_123');
    if (decoded.type !== 'access') throw new Error('Invalid token type');
    return { valid: true, decoded };
  } catch (error) {
    return { valid: false, error: error.message };
  }
};

/**
 * Verify a refresh token
 */
const verifyRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_123');
    if (decoded.type !== 'refresh') throw new Error('Invalid token type');
    return { valid: true, decoded };
  } catch (error) {
    return { valid: false, error: error.message };
  }
};

/**
 * Extract token from Authorization header
 */
const extractToken = (authHeader) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.substring(7);
};

/**
 * Calculate refresh token expiry date
 */
const getRefreshTokenExpiry = () => {
  const days = parseInt(process.env.JWT_REFRESH_EXPIRES_IN) || 7;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  extractToken,
  getRefreshTokenExpiry,
};
