/**
 * Standardized API response helpers
 */

const successResponse = (res, data, message = 'Success', statusCode = 200, meta = {}) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    ...(Object.keys(meta).length > 0 && { meta }),
    timestamp: new Date().toISOString(),
  });
};

const errorResponse = (res, message, statusCode = 500, errors = null) => {
  const response = {
    success: false,
    message,
    timestamp: new Date().toISOString(),
  };
  if (errors) response.errors = errors;
  return res.status(statusCode).json(response);
};

const paginatedResponse = (res, data, pagination, message = 'Success') => {
  return res.status(200).json({
    success: true,
    message,
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages: Math.ceil(pagination.total / pagination.limit),
      hasNext: pagination.page < Math.ceil(pagination.total / pagination.limit),
      hasPrev: pagination.page > 1,
    },
    timestamp: new Date().toISOString(),
  });
};

/**
 * Parse pagination query params with defaults
 */
const parsePagination = (query) => {
  const page  = Math.max(1, parseInt(query.page)  || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 10));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
};

/**
 * Parse sort query param safely
 * @param {string} sort - e.g. "created_at:desc"
 * @param {string[]} allowedFields
 */
const parseSort = (sort, allowedFields = []) => {
  if (!sort) return { field: 'created_at', direction: 'DESC' };
  const [field, dir] = sort.split(':');
  if (!allowedFields.includes(field)) return { field: 'created_at', direction: 'DESC' };
  const direction = dir && dir.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  return { field, direction };
};

module.exports = {
  successResponse,
  errorResponse,
  paginatedResponse,
  parsePagination,
  parseSort,
};
