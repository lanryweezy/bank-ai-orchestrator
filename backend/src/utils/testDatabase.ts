import { query } from '../config/db';

export const testRailwayConnection = async () => {
  try {
    console.log('🔄 Testing Railway database connection...');
    
    // Test basic connection
    const timeResult = await query('SELECT NOW() as current_time');
    console.log('✅ Database connection successful');
    console.log('⏰ Database time:', timeResult.rows[0].current_time);
    
    // Test if our tables exist
    const tablesResult = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'customers', 'accounts', 'workflows')
      ORDER BY table_name
    `);
    
    console.log('📊 Existing tables:', tablesResult.rows.map(row => row.table_name));
    
    // Test if we can create a simple table (permissions check)
    try {
      await query('CREATE TABLE IF NOT EXISTS connection_test (id SERIAL PRIMARY KEY, test_time TIMESTAMP DEFAULT NOW())');
      await query('INSERT INTO connection_test DEFAULT VALUES');
      const testResult = await query('SELECT COUNT(*) as count FROM connection_test');
      await query('DROP TABLE connection_test');
      
      console.log('✅ Database permissions verified');
      console.log(`📝 Test records: ${testResult.rows[0].count}`);
    } catch (permError) {
      console.log('⚠️  Database permission test failed:', permError.message);
    }
    
    return {
      success: true,
      message: 'Railway database connection successful',
      tables: tablesResult.rows.map(row => row.table_name)
    };
    
  } catch (error) {
    console.error('❌ Railway database connection failed:', error);
    
    // Provide helpful error messages
    if (error.message.includes('ENOTFOUND')) {
      console.error('🔍 Issue: Database hostname not found. Check if Railway database is public.');
    } else if (error.message.includes('authentication failed')) {
      console.error('🔍 Issue: Authentication failed. Check username/password.');
    } else if (error.message.includes('ETIMEDOUT')) {
      console.error('🔍 Issue: Connection timeout. Check if database allows external connections.');
    }
    
    return {
      success: false,
      message: error.message,
      tables: []
    };
  }
};

export const initializeRailwayDatabase = async () => {
  try {
    console.log('🚀 Initializing Railway database schema...');
    
    // Check if users table exists
    const userTableExists = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      )
    `);
    
    if (!userTableExists.rows[0].exists) {
      console.log('📝 Creating database schema...');
      
      // Create essential tables for authentication
      await query(`
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
        CREATE EXTENSION IF NOT EXISTS "pgcrypto";
        
        -- Users table for authentication
        CREATE TABLE users (
          user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          username VARCHAR(255) UNIQUE NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          role VARCHAR(50) NOT NULL DEFAULT 'bank_user' CHECK (role IN ('platform_admin', 'bank_user', 'customer')),
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Insert default admin user
        INSERT INTO users (username, email, password_hash, role) VALUES 
        ('admin', 'admin@bank.com', '$2a$10$8K1p/a0dF3o9R5C7x6Y.8O5z2/k5w3m7q1p9v3r7c2/h4x8z6k1j0', 'platform_admin');
      `);
      
      console.log('✅ Basic schema created with admin user');
    } else {
      console.log('✅ Database schema already exists');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    return false;
  }
};