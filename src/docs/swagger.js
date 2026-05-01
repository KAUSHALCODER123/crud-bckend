const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'REST API with Auth & RBAC',
      version: '1.0.0',
      description: `
## Scalable REST API

A production-ready REST API featuring:
- **JWT Authentication** with access/refresh token rotation
- **Role-Based Access Control** (user / admin)
- **Task Management** CRUD with filters, pagination, and sorting
- **Admin Panel** for user management
- **Rate Limiting**, validation, and structured error handling

### Authentication
Use the \`/api/v1/auth/login\` endpoint to get tokens, then click **Authorize** and enter:
\`Bearer <your_access_token>\`
      `,
      contact: {
        name: 'API Support',
        email: 'support@example.com',
      },
      license: { name: 'MIT' },
    },
    servers: [
      { url: 'http://localhost:5000/api/v1', description: 'Development' },
      { url: 'https://your-api.example.com/api/v1', description: 'Production' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter: Bearer <token>',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id:         { type: 'string', format: 'uuid' },
            email:      { type: 'string', format: 'email' },
            username:   { type: 'string' },
            role:       { type: 'string', enum: ['user', 'admin'] },
            first_name: { type: 'string' },
            last_name:  { type: 'string' },
            is_active:  { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Task: {
          type: 'object',
          properties: {
            id:          { type: 'string', format: 'uuid' },
            title:       { type: 'string' },
            description: { type: 'string' },
            status:      { type: 'string', enum: ['todo', 'in_progress', 'done', 'archived'] },
            priority:    { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
            due_date:    { type: 'string', format: 'date-time' },
            tags:        { type: 'array', items: { type: 'string' } },
            owner_id:    { type: 'string', format: 'uuid' },
            created_at:  { type: 'string', format: 'date-time' },
          },
        },
        AuthTokens: {
          type: 'object',
          properties: {
            access_token:  { type: 'string' },
            refresh_token: { type: 'string' },
          },
        },
        ApiResponse: {
          type: 'object',
          properties: {
            success:   { type: 'boolean' },
            message:   { type: 'string' },
            data:      { type: 'object' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        ValidationError: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field:   { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.js'],
};

module.exports = swaggerJsdoc(options);
