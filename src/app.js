require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const swaggerUi  = require('swagger-ui-express');
const path       = require('path');
const fs         = require('fs');

const logger          = require('./utils/logger');
const swaggerSpec     = require('./docs/swagger');
const authRoutes      = require('./routes/authRoutes');
const taskRoutes      = require('./routes/taskRoutes');
const adminRoutes     = require('./routes/adminRoutes');
const { apiLimiter }  = require('./middleware/rateLimiter');
const { notFound, globalErrorHandler } = require('./middleware/errorHandler');

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const app     = express();
const API_VER = process.env.API_VERSION || 'v1';
const PREFIX  = `/api/${API_VER}`;

// ─── Security Middleware ──────────────────────────────────────

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net', 'unpkg.com'], // for Swagger UI & unpkg React
      styleSrc:   ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net', 'fonts.googleapis.com'],
      fontSrc:    ["'self'", 'fonts.gstatic.com'],
      imgSrc:     ["'self'", 'data:', 'cdn.jsdelivr.net'],
    },
  },
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Request Parsing ──────────────────────────────────────────

app.use(express.json({ limit: '10kb' }));       // Limit payload size
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ─── Logging ──────────────────────────────────────────────────

app.use(morgan('combined', { stream: logger.stream }));

// ─── Rate Limiting ────────────────────────────────────────────

app.use(PREFIX, apiLimiter);

// ─── Static Frontend ──────────────────────────────────────────

app.use(express.static(path.join(process.cwd(), 'public')));

// ─── Health Check ─────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: API_VER,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    uptime: Math.floor(process.uptime()),
  });
});

app.get('/', (req, res, next) => {
  // If static file is served, this won't be called, otherwise return JSON
  if (req.accepts('html')) {
    return res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
  }
  res.json({
    name: 'REST API with Auth & RBAC',
    version: '1.0.0',
    docs: `/api-docs`,
    health: `/health`,
  });
});

// ─── API Documentation ────────────────────────────────────────

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'REST API Documentation',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    tryItOutEnabled: true,
  },
}));

// Expose raw OpenAPI spec
app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));

// ─── Routes ───────────────────────────────────────────────────

app.use(`${PREFIX}/auth`,  authRoutes);
app.use(`${PREFIX}/tasks`, taskRoutes);
app.use(`${PREFIX}/admin`, adminRoutes);

// ─── Error Handling ───────────────────────────────────────────

app.use(notFound);
app.use(globalErrorHandler);

// ─── Start Server ─────────────────────────────────────────────

let server;
if (process.env.NODE_ENV !== 'test') {
  const PORT = parseInt(process.env.PORT) || 5000;
  server = app.listen(PORT, () => {
    logger.info(`🚀 Server running on port ${PORT}`, {
      port: PORT,
      env: process.env.NODE_ENV,
      apiPrefix: PREFIX,
      docs: `http://localhost:${PORT}/api-docs`,
    });
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
      logger.info('Server closed.');
      process.exit(0);
    });
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Promise Rejection', { reason });
    server.close(() => process.exit(1));
  });
}

module.exports = app;
