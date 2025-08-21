const mysql = require('mysql2');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'projectdb',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Create database and tables if they don't exist
const initializeDatabase = async () => {
  try {
    // Create database
    await pool.promise().query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || 'projectdb'}`);
    
    // Use the database
    await pool.promise().query(`USE ${process.env.DB_NAME || 'projectdb'}`);
    
    // Create users table
    await pool.promise().query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        full_name VARCHAR(100),
        avatar VARCHAR(255),
        role ENUM('user', 'admin') DEFAULT 'user',
        bio TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Auto-migrate: ensure 'role' column exists on pre-existing databases
    try {
      const [roleCol] = await pool.promise().query(
        `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role'`,
        [process.env.DB_NAME || 'projectdb']
      );
      if (roleCol.length === 0) {
        await pool.promise().query(
          `ALTER TABLE users ADD COLUMN role ENUM('user','admin') DEFAULT 'user'`
        );
        console.log("Auto-migrated: added 'role' column to users table");
      }
    } catch (migrationError) {
      console.warn('Auto-migration check failed (continuing):', migrationError.message);
    }

    // Auto-migrate: ensure 'full_name' column exists
    try {
      const [fullNameCol] = await pool.promise().query(
        `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'full_name'`,
        [process.env.DB_NAME || 'projectdb']
      );
      if (fullNameCol.length === 0) {
        await pool.promise().query(
          `ALTER TABLE users ADD COLUMN full_name VARCHAR(100) NULL`
        );
        console.log("Auto-migrated: added 'full_name' column to users table");
      }
    } catch (migrationError) {
      console.warn('Auto-migration check failed (continuing):', migrationError.message);
    }

    // Auto-migrate: ensure 'avatar' column exists
    try {
      const [avatarCol] = await pool.promise().query(
        `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'avatar'`,
        [process.env.DB_NAME || 'projectdb']
      );
      if (avatarCol.length === 0) {
        await pool.promise().query(
          `ALTER TABLE users ADD COLUMN avatar VARCHAR(255) NULL`
        );
        console.log("Auto-migrated: added 'avatar' column to users table");
      }
    } catch (migrationError) {
      console.warn('Auto-migration check failed (continuing):', migrationError.message);
    }

    // Auto-migrate: ensure 'bio' column exists
    try {
      const [bioCol] = await pool.promise().query(
        `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'bio'`,
        [process.env.DB_NAME || 'projectdb']
      );
      if (bioCol.length === 0) {
        await pool.promise().query(
          `ALTER TABLE users ADD COLUMN bio TEXT NULL`
        );
        console.log("Auto-migrated: added 'bio' column to users table");
      }
    } catch (migrationError) {
      console.warn('Auto-migration check failed (continuing):', migrationError.message);
    }
    
    // Create posts table
    await pool.promise().query(`
      CREATE TABLE IF NOT EXISTS posts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        excerpt TEXT,
        featured_image VARCHAR(255),
        author_id INT NOT NULL,
        status ENUM('draft', 'published') DEFAULT 'draft',
        views INT DEFAULT 0,
        likes INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    
    // Create comments table
    await pool.promise().query(`
      CREATE TABLE IF NOT EXISTS comments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        content TEXT NOT NULL,
        post_id INT NOT NULL,
        user_id INT NOT NULL,
        parent_id INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
      )
    `);
    
    // Create likes table
    await pool.promise().query(`
      CREATE TABLE IF NOT EXISTS likes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        post_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        UNIQUE KEY unique_like (user_id, post_id)
      )
    `);
    
    // Create admin user if not exists
    const [adminUsers] = await pool.promise().query('SELECT * FROM users WHERE role = "admin" LIMIT 1');
    if (adminUsers.length === 0) {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await pool.promise().query(`
        INSERT INTO users (username, email, password, full_name, role) 
        VALUES ('admin', 'admin@blog.com', ?, 'Administrator', 'admin')
      `, [hashedPassword]);
      console.log('Admin user created: admin@blog.com / admin123');
    }
    
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
};

// Initialize database on startup
initializeDatabase();

module.exports = pool;
