import * as dotenv from 'dotenv';

dotenv.config(); // Load .env file

// Production-ready database configuration
const isProduction = process.env.NODE_ENV === 'production';

// For Railway, we need to replace internal hostname with public one for external access
const getDatabaseConfig = () => {
  let connectionString = process.env.DATABASE_URL;
  
  // Fix Railway internal hostname for external access (Vercel)
  if (connectionString && connectionString.includes('postgres.railway.internal')) {
    connectionString = connectionString.replace(
      'postgres.railway.internal', 
      'roundhouse.proxy.rlwy.net'
    );
  }
  
  if (connectionString) {
    return {
      connectionString,
      ssl: isProduction ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };
  }
  
  // Fallback to individual environment variables
  return {
    user: process.env.DB_USER || process.env.POSTGRES_USER || 'postgres',
    host: process.env.DB_HOST || process.env.POSTGRES_HOST || 'localhost',
    database: process.env.DB_NAME || process.env.POSTGRES_DB || 'bank_db',
    password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'password',
    port: parseInt(process.env.DB_PORT || process.env.POSTGRES_PORT || '5432', 10),
    ssl: false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };
};

export const dbConfig = getDatabaseConfig();

export const jwtConfig = {
  secret: process.env.JWT_SECRET || process.env.AUTH_SECRET || 'your-very-secret-key-change-in-production',
  expiresIn: parseInt(process.env.JWT_EXPIRES_IN_SECONDS || '3600', 10), // Expect seconds, default 1 hour
};

export const serverConfig = {
  port: parseInt(process.env.BACKEND_PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
};

export const bankConfig = {
  bankName: process.env.BANK_NAME || 'Lovable Bank Inc.',
  defaultCurrency: process.env.DEFAULT_CURRENCY || 'USD',
  defaultTimezone: process.env.DEFAULT_TIMEZONE || 'UTC',
  // Example of a configurable feature/rule
  enableAccountOpeningFee: (process.env.ENABLE_ACCOUNT_OPENING_FEE || 'false').toLowerCase() === 'true',
  accountOpeningFee: parseFloat(process.env.ACCOUNT_OPENING_FEE || '0.00'),
  // Placeholder for account number generation strategy
  // This would likely be more complex, potentially pointing to a module or function name
  accountNumberStrategy: process.env.ACCOUNT_NUMBER_STRATEGY || 'default_sequential', // e.g., 'random_numeric', 'branch_prefixed'
};
