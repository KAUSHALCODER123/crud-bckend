const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/database');

afterAll(async () => {
  await pool.end();
});

describe('GET /health', () => {
  it('should return 200 and a healthy status', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('status');
    expect(res.body.status).toBe('healthy');
  });
});
