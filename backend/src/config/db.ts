import { Pool } from 'pg';
import { dbConfig } from './index';

const pool = new Pool(dbConfig);

pool.on('connect', () => {
  console.log('Connected to the PostgreSQL database.');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Error executing query', { text, error });
    throw error;
  }
};

// Example of a simple query to test connection (optional, can be called from server.ts)
export const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('Successfully acquired client from pool.');
    const res = await client.query('SELECT NOW()');
    console.log('Test query result:', res.rows[0]);
    client.release();
  } catch (error) {
    console.error('Error connecting to the database or running test query:', error);
  }
};

export default pool;
