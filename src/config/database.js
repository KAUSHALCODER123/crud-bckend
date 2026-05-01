const { Pool } = require('pg');
const logger = require('../utils/logger');

const poolConfig = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'restapi_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
    };

if (process.env.DB_SSL === 'true') {
  poolConfig.ssl = { rejectUnauthorized: false };
}

poolConfig.max = 20;
poolConfig.idleTimeoutMillis = 30000;
poolConfig.connectionTimeoutMillis = 2000;

const pool = new Pool(poolConfig);

pool.on('connect', () => {
  logger.info('New database connection established');
});

pool.on('error', (err) => {
  logger.error('Unexpected database error', { error: err.message });
  process.exit(-1);
});

/**
 * Execute a parameterized query
 * @param {string} text - SQL query string
 * @param {Array} params - Query parameters
 */
const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed query', { text, duration, rows: result.rowCount });
    return result;
  } catch (error) {
    logger.error('Database query error', { text, error: error.message });
    throw error;
  }
};

/**
 * Get a client from the pool (for transactions)
 */
const getClient = async () => {
  const client = await pool.connect();
  const originalQuery = client.query.bind(client);
  const release = client.release.bind(client);

  // Override release to log any lingering clients
  client.release = () => {
    client.release = release;
    return release();
  };

  return client;
};

/**
 * Run a function within a transaction
 * @param {Function} fn - Async function receiving a client
 */
const withTransaction = async (fn) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = { query, getClient, withTransaction, pool };
