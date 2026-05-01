const { verifyAccessToken, extractToken } = require('../utils/jwt');
const { errorResponse } = require('../utils/response');
const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Verify JWT and attach user to request
 */
const authenticate = async (req, res, next) => {
  try {
    const token = extractToken(req.headers.authorization);
    if (!token) {
      return errorResponse(res, 'Authentication required. Please provide a valid Bearer token.', 401);
    }

    const { valid, decoded, error } = verifyAccessToken(token);
    if (!valid) {
      const message = error === 'jwt expired'
        ? 'Token has expired. Please refresh your token.'
        : 'Invalid token. Please log in again.';
      return errorResponse(res, message, 401);
    }

    // Fetch fresh user from DB (ensures deactivated users can't access)
    const result = await query(
      'SELECT id, email, username, role, is_active, first_name, last_name FROM users WHERE id = $1',
      [decoded.sub]
    );

    if (!result.rows.length || !result.rows[0].is_active) {
      return errorResponse(res, 'Account not found or deactivated.', 401);
    }

    req.user = result.rows[0];
    req.tokenPayload = decoded;
    next();
  } catch (err) {
    logger.error('Authentication middleware error', { error: err.message });
    return errorResponse(res, 'Authentication failed.', 500);
  }
};

/**
 * Role-based authorization middleware factory
 * @param {...string} roles - Allowed roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, 'Authentication required.', 401);
    }
    if (!roles.includes(req.user.role)) {
      logger.warn('Unauthorized access attempt', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: roles,
        path: req.path,
      });
      return errorResponse(
        res,
        `Access denied. Required role: ${roles.join(' or ')}. Your role: ${req.user.role}`,
        403
      );
    }
    next();
  };
};

/**
 * Resource ownership check: user must own the resource OR be admin
 */
const authorizeOwnerOrAdmin = (getOwnerId) => {
  return async (req, res, next) => {
    try {
      if (req.user.role === 'admin') return next();
      const ownerId = await getOwnerId(req);
      if (!ownerId || ownerId !== req.user.id) {
        return errorResponse(res, 'You do not have permission to access this resource.', 403);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
};

/**
 * Optional authentication: attaches user if token present, doesn't fail if not
 */
const optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req.headers.authorization);
    if (!token) return next();

    const { valid, decoded } = verifyAccessToken(token);
    if (!valid) return next();

    const result = await query(
      'SELECT id, email, username, role, is_active FROM users WHERE id = $1',
      [decoded.sub]
    );
    if (result.rows.length && result.rows[0].is_active) {
      req.user = result.rows[0];
    }
    next();
  } catch (err) {
    next();
  }
};

module.exports = { authenticate, authorize, authorizeOwnerOrAdmin, optionalAuth };
