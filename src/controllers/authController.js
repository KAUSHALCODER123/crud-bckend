const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { query, withTransaction } = require('../config/database');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  getRefreshTokenExpiry,
} = require('../utils/jwt');
const { successResponse, errorResponse } = require('../utils/response');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const SALT_ROUNDS = 12;

// ─── Register ────────────────────────────────────────────────

exports.register = asyncHandler(async (req, res) => {
  const { email, username, password, first_name, last_name } = req.body;

  // Check uniqueness
  const existing = await query(
    'SELECT id FROM users WHERE email = $1 OR username = $2',
    [email, username]
  );
  if (existing.rows.length) {
    const conflict = existing.rows[0];
    throw new AppError('Email or username already registered.', 409);
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  const result = await query(
    `INSERT INTO users (email, username, password, first_name, last_name)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, email, username, role, first_name, last_name, created_at`,
    [email, username, hashedPassword, first_name || null, last_name || null]
  );

  const user = result.rows[0];

  // Generate tokens
  const tokenPayload = { sub: user.id, email: user.email, role: user.role };
  const accessToken  = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  // Store refresh token
  await query(
    'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
    [user.id, refreshToken, getRefreshTokenExpiry()]
  );

  logger.info('User registered', { userId: user.id, email: user.email });

  return successResponse(res, {
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      first_name: user.first_name,
      last_name: user.last_name,
      created_at: user.created_at,
    },
    tokens: { access_token: accessToken, refresh_token: refreshToken },
  }, 'Account created successfully.', 201);
});

// ─── Login ───────────────────────────────────────────────────

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const result = await query(
    'SELECT id, email, username, password, role, first_name, last_name, is_active FROM users WHERE email = $1',
    [email]
  );

  // Generic message prevents user enumeration
  const invalidMsg = 'Invalid email or password.';
  if (!result.rows.length) return errorResponse(res, invalidMsg, 401);

  const user = result.rows[0];
  if (!user.is_active) return errorResponse(res, 'Account is deactivated. Please contact support.', 403);

  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) return errorResponse(res, invalidMsg, 401);

  const tokenPayload = { sub: user.id, email: user.email, role: user.role };
  const accessToken  = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  // Store refresh token & update last_login in parallel
  await Promise.all([
    query('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, refreshToken, getRefreshTokenExpiry()]),
    query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]),
  ]);

  logger.info('User logged in', { userId: user.id });

  return successResponse(res, {
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      first_name: user.first_name,
      last_name: user.last_name,
    },
    tokens: { access_token: accessToken, refresh_token: refreshToken },
  }, 'Login successful.');
});

// ─── Refresh Token ───────────────────────────────────────────

exports.refreshToken = asyncHandler(async (req, res) => {
  const { refresh_token } = req.body;

  const { valid, decoded, error } = verifyRefreshToken(refresh_token);
  if (!valid) return errorResponse(res, 'Invalid or expired refresh token.', 401);

  // Verify token in DB and not revoked
  const tokenRecord = await query(
    `SELECT id, user_id, is_revoked, expires_at
     FROM refresh_tokens WHERE token = $1`,
    [refresh_token]
  );

  if (!tokenRecord.rows.length || tokenRecord.rows[0].is_revoked) {
    return errorResponse(res, 'Refresh token has been revoked.', 401);
  }

  if (new Date(tokenRecord.rows[0].expires_at) < new Date()) {
    return errorResponse(res, 'Refresh token has expired.', 401);
  }

  // Fetch user
  const userResult = await query(
    'SELECT id, email, username, role, is_active FROM users WHERE id = $1',
    [decoded.sub]
  );
  if (!userResult.rows.length || !userResult.rows[0].is_active) {
    return errorResponse(res, 'User not found or deactivated.', 401);
  }

  const user = userResult.rows[0];

  // Rotate: revoke old, issue new (token rotation pattern)
  const newAccessToken  = generateAccessToken({ sub: user.id, email: user.email, role: user.role });
  const newRefreshToken = generateRefreshToken({ sub: user.id, email: user.email, role: user.role });

  await withTransaction(async (client) => {
    await client.query('UPDATE refresh_tokens SET is_revoked = TRUE WHERE id = $1',
      [tokenRecord.rows[0].id]);
    await client.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, newRefreshToken, getRefreshTokenExpiry()]
    );
  });

  return successResponse(res, {
    tokens: { access_token: newAccessToken, refresh_token: newRefreshToken },
  }, 'Token refreshed successfully.');
});

// ─── Logout ──────────────────────────────────────────────────

exports.logout = asyncHandler(async (req, res) => {
  const { refresh_token } = req.body;

  if (refresh_token) {
    await query(
      'UPDATE refresh_tokens SET is_revoked = TRUE WHERE token = $1 AND user_id = $2',
      [refresh_token, req.user.id]
    );
  }

  logger.info('User logged out', { userId: req.user.id });
  return successResponse(res, null, 'Logged out successfully.');
});

// ─── Get Profile ─────────────────────────────────────────────

exports.getProfile = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT id, email, username, role, first_name, last_name, avatar_url, last_login, created_at, updated_at
     FROM users WHERE id = $1`,
    [req.user.id]
  );
  return successResponse(res, result.rows[0], 'Profile retrieved successfully.');
});

// ─── Update Profile ──────────────────────────────────────────

exports.updateProfile = asyncHandler(async (req, res) => {
  const { first_name, last_name, avatar_url } = req.body;

  const result = await query(
    `UPDATE users
     SET first_name = COALESCE($1, first_name),
         last_name  = COALESCE($2, last_name),
         avatar_url = COALESCE($3, avatar_url)
     WHERE id = $4
     RETURNING id, email, username, role, first_name, last_name, avatar_url, updated_at`,
    [first_name, last_name, avatar_url, req.user.id]
  );
  return successResponse(res, result.rows[0], 'Profile updated successfully.');
});

// ─── Change Password ─────────────────────────────────────────

exports.changePassword = asyncHandler(async (req, res) => {
  const { current_password, new_password } = req.body;

  const result = await query('SELECT password FROM users WHERE id = $1', [req.user.id]);
  const valid  = await bcrypt.compare(current_password, result.rows[0].password);

  if (!valid) return errorResponse(res, 'Current password is incorrect.', 400);

  const hashed = await bcrypt.hash(new_password, SALT_ROUNDS);
  await query('UPDATE users SET password = $1 WHERE id = $2', [hashed, req.user.id]);

  // Revoke all refresh tokens (security: force re-login everywhere)
  await query('UPDATE refresh_tokens SET is_revoked = TRUE WHERE user_id = $1', [req.user.id]);

  logger.info('Password changed', { userId: req.user.id });
  return successResponse(res, null, 'Password changed successfully. Please log in again.');
});
