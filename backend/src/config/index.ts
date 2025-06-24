import * as dotenv from 'dotenv';

dotenv.config(); // Load .env file

export const dbConfig = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'bank_db',
  password: process.env.DB_PASSWORD || 'password',
  port: parseInt(process.env.DB_PORT || '5432', 10),
};

export const jwtConfig = {
  secret: process.env.JWT_SECRET || 'your-very-secret-key',
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
