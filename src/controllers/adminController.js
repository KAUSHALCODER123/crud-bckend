const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { successResponse, errorResponse, paginatedResponse, parsePagination } = require('../utils/response');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// ─── List All Users ──────────────────────────────────────────
// @route GET /api/v1/admin/users
// @access Admin

exports.listUsers = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const { role, search, is_active } = req.query;

  const conditions = [];
  const params     = [];
  let   idx        = 1;

  if (role)  { conditions.push(`role = $${idx++}`); params.push(role); }
  if (search) {
    conditions.push(`(email ILIKE $${idx} OR username ILIKE $${idx} OR first_name ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }
  if (is_active !== undefined) {
    conditions.push(`is_active = $${idx++}`);
    params.push(is_active === 'true');
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [countResult, dataResult] = await Promise.all([
    query(`SELECT COUNT(*) FROM users ${where}`, params),
    query(
      `SELECT id, email, username, role, first_name, last_name, is_active, last_login, created_at
       FROM users ${where}
       ORDER BY created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, offset]
    ),
  ]);

  return paginatedResponse(
    res,
    dataResult.rows,
    { page, limit, total: parseInt(countResult.rows[0].count) },
    'Users retrieved successfully.'
  );
});

// ─── Get Single User ─────────────────────────────────────────
// @route GET /api/v1/admin/users/:id
// @access Admin

exports.getUser = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT id, email, username, role, first_name, last_name, avatar_url, is_active, last_login, created_at, updated_at
     FROM users WHERE id = $1`,
    [req.params.id]
  );
  if (!result.rows.length) return errorResponse(res, 'User not found.', 404);
  return successResponse(res, result.rows[0], 'User retrieved successfully.');
});

// ─── Update User Role ────────────────────────────────────────
// @route PATCH /api/v1/admin/users/:id/role
// @access Admin

exports.updateUserRole = asyncHandler(async (req, res) => {
  const { role } = req.body;
  if (!['user', 'admin'].includes(role)) {
    return errorResponse(res, 'Role must be "user" or "admin".', 400);
  }
  // Prevent admin from demoting themselves
  if (req.params.id === req.user.id && role !== 'admin') {
    return errorResponse(res, 'You cannot change your own role.', 400);
  }

  const result = await query(
    'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, username, role',
    [role, req.params.id]
  );
  if (!result.rows.length) return errorResponse(res, 'User not found.', 404);

  logger.info('User role updated', { targetUserId: req.params.id, newRole: role, adminId: req.user.id });
  return successResponse(res, result.rows[0], `User role updated to ${role}.`);
});

// ─── Toggle User Active Status ───────────────────────────────
// @route PATCH /api/v1/admin/users/:id/toggle-active
// @access Admin

exports.toggleUserActive = asyncHandler(async (req, res) => {
  if (req.params.id === req.user.id) {
    return errorResponse(res, 'You cannot deactivate your own account.', 400);
  }

  const result = await query(
    `UPDATE users SET is_active = NOT is_active
     WHERE id = $1
     RETURNING id, email, username, is_active`,
    [req.params.id]
  );
  if (!result.rows.length) return errorResponse(res, 'User not found.', 404);

  const user = result.rows[0];
  const action = user.is_active ? 'activated' : 'deactivated';
  logger.info(`User ${action}`, { targetUserId: req.params.id, adminId: req.user.id });

  return successResponse(res, user, `User account ${action} successfully.`);
});

// ─── Delete User ─────────────────────────────────────────────
// @route DELETE /api/v1/admin/users/:id
// @access Admin

exports.deleteUser = asyncHandler(async (req, res) => {
  if (req.params.id === req.user.id) {
    return errorResponse(res, 'You cannot delete your own account.', 400);
  }

  const result = await query('DELETE FROM users WHERE id = $1 RETURNING id', [req.params.id]);
  if (!result.rows.length) return errorResponse(res, 'User not found.', 404);

  logger.info('User deleted', { targetUserId: req.params.id, adminId: req.user.id });
  return successResponse(res, null, 'User deleted successfully.');
});

// ─── System Stats ────────────────────────────────────────────
// @route GET /api/v1/admin/stats
// @access Admin

exports.getSystemStats = asyncHandler(async (req, res) => {
  const [userStats, taskStats] = await Promise.all([
    query(`
      SELECT
        COUNT(*)                                       AS total_users,
        COUNT(*) FILTER (WHERE role = 'admin')         AS admins,
        COUNT(*) FILTER (WHERE role = 'user')          AS regular_users,
        COUNT(*) FILTER (WHERE is_active = true)       AS active_users,
        COUNT(*) FILTER (WHERE last_login > NOW() - INTERVAL '7 days') AS active_this_week
      FROM users
    `),
    query(`
      SELECT
        COUNT(*)                                             AS total_tasks,
        COUNT(*) FILTER (WHERE status = 'todo')             AS todo,
        COUNT(*) FILTER (WHERE status = 'in_progress')      AS in_progress,
        COUNT(*) FILTER (WHERE status = 'done')             AS done,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') AS created_this_week
      FROM tasks
    `),
  ]);

  return successResponse(res, {
    users: userStats.rows[0],
    tasks: taskStats.rows[0],
  }, 'System statistics retrieved successfully.');
});
