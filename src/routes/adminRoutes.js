const express = require('express');
const router  = express.Router();
const { body } = require('express-validator');

const adminController = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/errorHandler');
const { uuidValidator } = require('../validators/authValidators');

// All admin routes require auth + admin role
router.use(authenticate, authorize('admin'));

router.get('/stats', adminController.getSystemStats);
router.get('/users', adminController.listUsers);
router.get('/users/:id', uuidValidator('id'), validate, adminController.getUser);

router.patch('/users/:id/role',
  uuidValidator('id'),
  [body('role').isIn(['user', 'admin']).withMessage('Role must be "user" or "admin".')],
  validate,
  adminController.updateUserRole
);

router.patch('/users/:id/toggle-active',
  uuidValidator('id'),
  validate,
  adminController.toggleUserActive
);

router.delete('/users/:id',
  uuidValidator('id'),
  validate,
  adminController.deleteUser
);

module.exports = router;
