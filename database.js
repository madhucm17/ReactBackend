const mysql = require('mysql2/promise');
require('dotenv').config({ path: './config.env' });

// Database configuration without database name for initial connection
const initialConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Database configuration with database name
const dbConfig = {
  ...initialConfig,
  database: process.env.DB_NAME
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Test database connection and create database if needed
async function testConnection() {
  try {
    // First, connect without specifying database
    const initialPool = mysql.createPool(initialConfig);
    const connection = await initialPool.getConnection();
    
    // Create database if it doesn't exist
    await connection.execute(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME}`);
    console.log(`✅ Database '${process.env.DB_NAME}' created/verified successfully!`);
    
    connection.release();
    await initialPool.end();
    
    // Now test connection with database
    const dbConnection = await pool.getConnection();
    console.log('✅ Database connected successfully!');
    dbConnection.release();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.log('💡 Make sure MySQL is running and config.env has correct credentials');
    process.exit(1);
  }
}

// Initialize database tables
async function initializeDatabase() {
  try {
    const connection = await pool.getConnection();
    
    // Create users table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        email VARCHAR(100) UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Create products table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Insert sample products if table is empty
    const [products] = await connection.execute('SELECT COUNT(*) as count FROM products');
    if (products[0].count === 0) {
      await connection.execute(`
        INSERT INTO products (name, price, description) VALUES 
        ('Book A', 10.99, 'A great book about programming'),
        ('Book B', 12.49, 'Another amazing book')
      `);
      console.log('✅ Sample products inserted');
    }

    connection.release();
    console.log('✅ Database tables initialized successfully!');
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    throw error;
  }
}

module.exports = {
  pool,
  testConnection,
  initializeDatabase
}; 