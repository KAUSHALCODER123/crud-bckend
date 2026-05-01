const { query } = require('../config/database');
const { successResponse, errorResponse, paginatedResponse, parsePagination, parseSort } = require('../utils/response');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const SORTABLE_FIELDS = ['created_at', 'updated_at', 'title', 'priority', 'due_date', 'status'];

// ─── Helper: Fetch task with ownership check ──────────────────

const getTaskOrFail = async (taskId, userId, role) => {
  const result = await query('SELECT * FROM tasks WHERE id = $1', [taskId]);
  if (!result.rows.length) throw new AppError('Task not found.', 404);

  const task = result.rows[0];
  if (role !== 'admin' && task.owner_id !== userId) {
    throw new AppError('You do not have permission to access this task.', 403);
  }
  return task;
};

// ─── Create Task ─────────────────────────────────────────────
// @route POST /api/v1/tasks
// @access Private (user, admin)

exports.createTask = asyncHandler(async (req, res) => {
  const { title, description, status, priority, due_date, tags, assigned_to } = req.body;

  // If assigning to someone else, only admins can do that
  if (assigned_to && assigned_to !== req.user.id && req.user.role !== 'admin') {
    return errorResponse(res, 'Only admins can assign tasks to other users.', 403);
  }

  const result = await query(
    `INSERT INTO tasks (title, description, status, priority, due_date, tags, owner_id, assigned_to)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      title,
      description || null,
      status || 'todo',
      priority || 'medium',
      due_date || null,
      tags || [],
      req.user.id,
      assigned_to || req.user.id,
    ]
  );

  logger.info('Task created', { taskId: result.rows[0].id, userId: req.user.id });
  return successResponse(res, result.rows[0], 'Task created successfully.', 201);
});

// ─── List Tasks ──────────────────────────────────────────────
// @route GET /api/v1/tasks
// @access Private (users see own tasks; admins see all)

exports.listTasks = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const { field, direction }    = parseSort(req.query.sort, SORTABLE_FIELDS);
  const { status, priority, search, assigned_to } = req.query;

  const conditions  = [];
  const params      = [];
  let   paramIndex  = 1;

  // Non-admins see only their own tasks
  if (req.user.role !== 'admin') {
    conditions.push(`t.owner_id = $${paramIndex++}`);
    params.push(req.user.id);
  } else if (req.query.owner_id) {
    conditions.push(`t.owner_id = $${paramIndex++}`);
    params.push(req.query.owner_id);
  }

  if (status) {
    conditions.push(`t.status = $${paramIndex++}`);
    params.push(status);
  }
  if (priority) {
    conditions.push(`t.priority = $${paramIndex++}`);
    params.push(priority);
  }
  if (assigned_to) {
    conditions.push(`t.assigned_to = $${paramIndex++}`);
    params.push(assigned_to);
  }
  if (search) {
    conditions.push(`(t.title ILIKE $${paramIndex} OR t.description ILIKE $${paramIndex})`);
    params.push(`%${search}%`);
    paramIndex++;
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await query(
    `SELECT COUNT(*) FROM tasks t ${whereClause}`,
    params
  );

  const dataResult = await query(
    `SELECT t.*,
            u.username AS owner_username,
            a.username AS assignee_username
     FROM tasks t
     LEFT JOIN users u ON t.owner_id = u.id
     LEFT JOIN users a ON t.assigned_to = a.id
     ${whereClause}
     ORDER BY t.${field} ${direction}
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...params, limit, offset]
  );

  return paginatedResponse(
    res,
    dataResult.rows,
    { page, limit, total: parseInt(countResult.rows[0].count) },
    'Tasks retrieved successfully.'
  );
});

// ─── Get Single Task ─────────────────────────────────────────
// @route GET /api/v1/tasks/:id
// @access Private

exports.getTask = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT t.*,
            u.username AS owner_username, u.first_name AS owner_first_name, u.last_name AS owner_last_name,
            a.username AS assignee_username, a.first_name AS assignee_first_name
     FROM tasks t
     LEFT JOIN users u ON t.owner_id = u.id
     LEFT JOIN users a ON t.assigned_to = a.id
     WHERE t.id = $1`,
    [req.params.id]
  );

  if (!result.rows.length) return errorResponse(res, 'Task not found.', 404);

  const task = result.rows[0];
  if (req.user.role !== 'admin' && task.owner_id !== req.user.id && task.assigned_to !== req.user.id) {
    return errorResponse(res, 'You do not have permission to view this task.', 403);
  }

  return successResponse(res, task, 'Task retrieved successfully.');
});

// ─── Update Task ─────────────────────────────────────────────
// @route PUT /api/v1/tasks/:id
// @access Private (owner or admin)

exports.updateTask = asyncHandler(async (req, res) => {
  await getTaskOrFail(req.params.id, req.user.id, req.user.role);

  const { title, description, status, priority, due_date, tags, assigned_to } = req.body;

  const result = await query(
    `UPDATE tasks
     SET title       = COALESCE($1, title),
         description = COALESCE($2, description),
         status      = COALESCE($3, status),
         priority    = COALESCE($4, priority),
         due_date    = COALESCE($5, due_date),
         tags        = COALESCE($6, tags),
         assigned_to = COALESCE($7, assigned_to)
     WHERE id = $8
     RETURNING *`,
    [title, description, status, priority, due_date, tags, assigned_to, req.params.id]
  );

  logger.info('Task updated', { taskId: req.params.id, userId: req.user.id });
  return successResponse(res, result.rows[0], 'Task updated successfully.');
});

// ─── Delete Task ─────────────────────────────────────────────
// @route DELETE /api/v1/tasks/:id
// @access Private (owner or admin)

exports.deleteTask = asyncHandler(async (req, res) => {
  await getTaskOrFail(req.params.id, req.user.id, req.user.role);

  await query('DELETE FROM tasks WHERE id = $1', [req.params.id]);

  logger.info('Task deleted', { taskId: req.params.id, userId: req.user.id });
  return successResponse(res, null, 'Task deleted successfully.');
});

// ─── Admin: Get All Users' Tasks Stats ───────────────────────
// @route GET /api/v1/tasks/admin/stats
// @access Admin only

exports.getTaskStats = asyncHandler(async (req, res) => {
  const stats = await query(`
    SELECT
      COUNT(*)                                              AS total_tasks,
      COUNT(*) FILTER (WHERE status = 'todo')              AS todo,
      COUNT(*) FILTER (WHERE status = 'in_progress')       AS in_progress,
      COUNT(*) FILTER (WHERE status = 'done')              AS done,
      COUNT(*) FILTER (WHERE status = 'archived')          AS archived,
      COUNT(*) FILTER (WHERE priority = 'urgent')          AS urgent,
      COUNT(*) FILTER (WHERE due_date < NOW() AND status != 'done' AND status != 'archived') AS overdue,
      COUNT(DISTINCT owner_id)                             AS unique_owners
    FROM tasks
  `);

  return successResponse(res, stats.rows[0], 'Task statistics retrieved successfully.');
});
