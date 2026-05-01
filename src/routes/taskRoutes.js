const express = require('express');
const router  = express.Router();

const taskController = require('../controllers/taskController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/errorHandler');
const { uuidValidator } = require('../validators/authValidators');
const { createTaskValidator, updateTaskValidator, listTasksValidator } = require('../validators/taskValidators');

// All task routes require authentication
router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: Tasks
 *   description: Task management endpoints
 */

/**
 * @swagger
 * /tasks:
 *   get:
 *     tags: [Tasks]
 *     summary: List tasks (own tasks for users; all tasks for admins)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [todo, in_progress, done, archived] }
 *       - in: query
 *         name: priority
 *         schema: { type: string, enum: [low, medium, high, urgent] }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: sort
 *         schema: { type: string, example: "created_at:desc" }
 *   post:
 *     tags: [Tasks]
 *     summary: Create a new task
 *     security: [{ bearerAuth: [] }]
 */
router.get('/',    listTasksValidator, validate, taskController.listTasks);
router.post('/',   createTaskValidator, validate, taskController.createTask);

// Admin-only stats endpoint
router.get('/admin/stats', authorize('admin'), taskController.getTaskStats);

router.get('/:id',    uuidValidator('id'), validate, taskController.getTask);
router.put('/:id',    uuidValidator('id'), updateTaskValidator, validate, taskController.updateTask);
router.delete('/:id', uuidValidator('id'), validate, taskController.deleteTask);

module.exports = router;
