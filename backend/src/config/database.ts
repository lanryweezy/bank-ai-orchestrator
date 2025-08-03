import { Pool } from 'pg';

// Production database configuration
const isProduction = process.env.NODE_ENV === 'production';

const connectionString = process.env.DATABASE_URL;

const poolConfig = {
  connectionString,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Create connection pool
export const pool = new Pool(poolConfig);

// Enhanced query function with error handling
export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Executed query', { text, duration, rows: res.rowCount });
    }
    
    return res;
  } catch (error) {
    console.error('Database query error:', error);
    console.error('Query:', text);
    console.error('Params:', params);
    throw error;
  }
};

// Test database connection
export const testConnection = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    console.log('✅ Database connected successfully at:', result.rows[0].now);
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
};

// Initialize database schema for production
export const initializeSchema = async () => {
  if (!isProduction) return;
  
  try {
    console.log('🔄 Initializing database schema...');
    
    // Read and execute schema files
    const fs = require('fs');
    const path = require('path');
    
    const schemaPath = path.join(__dirname, '../../sql/core_banking_schema.sql');
    
    if (fs.existsSync(schemaPath)) {
      const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
      await query(schemaSQL);
      console.log('✅ Database schema initialized successfully');
    } else {
      console.log('⚠️ Schema file not found, skipping initialization');
    }
  } catch (error) {
    console.error('❌ Schema initialization failed:', error);
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🔄 Closing database connection pool...');
  await pool.end();
  console.log('✅ Database pool closed');
  process.exit(0);
});

export default { pool, query, testConnection, initializeSchema };