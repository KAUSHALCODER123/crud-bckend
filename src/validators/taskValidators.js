const { body, param, query } = require('express-validator');

const VALID_STATUSES   = ['todo', 'in_progress', 'done', 'archived'];
const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'];

const createTaskValidator = [
  body('title')
    .trim()
    .notEmpty().withMessage('Title is required.')
    .isLength({ min: 1, max: 255 }).withMessage('Title must be between 1 and 255 characters.')
    .escape(),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 5000 }).withMessage('Description must not exceed 5000 characters.'),

  body('status')
    .optional()
    .isIn(VALID_STATUSES).withMessage(`Status must be one of: ${VALID_STATUSES.join(', ')}.`),

  body('priority')
    .optional()
    .isIn(VALID_PRIORITIES).withMessage(`Priority must be one of: ${VALID_PRIORITIES.join(', ')}.`),

  body('due_date')
    .optional()
    .isISO8601().withMessage('Due date must be a valid ISO 8601 date.')
    .toDate(),

  body('tags')
    .optional()
    .isArray({ max: 20 }).withMessage('Tags must be an array with max 20 items.')
    .custom((tags) => {
      if (tags.some(t => typeof t !== 'string' || t.length > 50)) {
        throw new Error('Each tag must be a string of max 50 characters.');
      }
      return true;
    }),

  body('assigned_to')
    .optional()
    .isUUID(4).withMessage('assigned_to must be a valid user UUID.'),
];

const updateTaskValidator = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 255 }).withMessage('Title must be between 1 and 255 characters.')
    .escape(),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 5000 }).withMessage('Description must not exceed 5000 characters.'),

  body('status')
    .optional()
    .isIn(VALID_STATUSES).withMessage(`Status must be one of: ${VALID_STATUSES.join(', ')}.`),

  body('priority')
    .optional()
    .isIn(VALID_PRIORITIES).withMessage(`Priority must be one of: ${VALID_PRIORITIES.join(', ')}.`),

  body('due_date')
    .optional({ nullable: true })
    .isISO8601().withMessage('Due date must be a valid ISO 8601 date.')
    .toDate(),

  body('tags')
    .optional()
    .isArray({ max: 20 }).withMessage('Tags must be an array with max 20 items.'),

  body('assigned_to')
    .optional({ nullable: true })
    .isUUID(4).withMessage('assigned_to must be a valid user UUID.'),
];

const listTasksValidator = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer.').toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100.').toInt(),
  query('status').optional().isIn(VALID_STATUSES).withMessage(`Status filter must be one of: ${VALID_STATUSES.join(', ')}.`),
  query('priority').optional().isIn(VALID_PRIORITIES).withMessage(`Priority filter must be one of: ${VALID_PRIORITIES.join(', ')}.`),
  query('sort').optional().matches(/^[a-z_]+:(asc|desc)$/i).withMessage('Sort format must be "field:asc" or "field:desc".'),
];

module.exports = { createTaskValidator, updateTaskValidator, listTasksValidator };
