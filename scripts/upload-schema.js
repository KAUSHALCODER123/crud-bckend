require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('Error: DATABASE_URL is missing in .env');
    process.exit(1);
  }

  console.log('Connecting to database...');
  const client = new Client({ connectionString });
  await client.connect();
  console.log('Connected to database!');

  const schemaPath = path.join(__dirname, '..', 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  // Split queries by semicolon to execute them one by one.
  // Note: triggers and functions contain semicolons inside,
  // so we can use a more specific splitting regex or execute the whole thing.
  // But wait! If we run the entire string at once, it works perfectly in pg!
  // The only issue is if types already exist, it throws an error and rolls back.
  // To prevent crashing on "type already exists", let's use DO blocks or run separately.
  // Let's create a wrapper that adds IF NOT EXISTS logic for types.
  
  const modifiedSql = `
    DO $$ 
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('user', 'admin');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
        CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'done', 'archived');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_priority') THEN
        CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
      END IF;
    END $$;

    ${schemaSql.replace(/CREATE TYPE user_role[^;]+;/g, '').replace(/CREATE TYPE task_status[^;]+;/g, '').replace(/CREATE TYPE task_priority[^;]+;/g, '')}
  `;

  try {
    await client.query(modifiedSql);
    console.log('Schema uploaded successfully!');
  } catch (err) {
    console.error('Error uploading schema:', err.message);
  } finally {
    await client.end();
  }
}

main();
