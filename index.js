const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: './config.env' });

const { pool, testConnection, initializeDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 8081;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database on startup
async function startServer() {
  try {
    await testConnection();
    await initializeDatabase();
    
    app.listen(PORT, () => {
      console.log(`🚀 Backend running on http://localhost:${PORT}`);
      console.log(`📊 Database: Connected to ${process.env.DB_NAME}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// User login endpoint with database
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username and password required' 
      });
    }

    const connection = await pool.getConnection();
    
    // Check if user exists
    const [users] = await connection.execute(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );

    if (users.length === 0) {
      // Create new user (for demo purposes)
      const hashedPassword = await bcrypt.hash(password, 10);
      await connection.execute(
        'INSERT INTO users (username, password) VALUES (?, ?)',
        [username, hashedPassword]
      );
      
      const token = jwt.sign(
        { username, id: users.insertId },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      connection.release();
      return res.json({ 
        success: true, 
        message: 'User created and logged in successfully',
        user: { username },
        token
      });
    }

    // Verify existing user password
    const user = users[0];
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      connection.release();
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    const token = jwt.sign(
      { username: user.username, id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    connection.release();
    res.json({ 
      success: true, 
      message: 'Login successful',
      user: { username: user.username, id: user.id },
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Get products from database
app.get('/api/products', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [products] = await connection.execute('SELECT * FROM products ORDER BY created_at DESC');
    connection.release();
    
    res.json(products);
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch products' 
    });
  }
});

// Add new product to database
app.post('/api/products', async (req, res) => {
  try {
    const { name, price, description } = req.body;
    
    if (!name || typeof price !== 'number') {
      return res.status(400).json({ 
        success: false, 
        message: 'Name and price are required' 
      });
    }

    const connection = await pool.getConnection();
    const [result] = await connection.execute(
      'INSERT INTO products (name, price, description) VALUES (?, ?, ?)',
      [name, price, description || '']
    );

    const [newProduct] = await connection.execute(
      'SELECT * FROM products WHERE id = ?',
      [result.insertId]
    );

    connection.release();
    res.status(201).json({ 
      success: true, 
      product: newProduct[0] 
    });

  } catch (error) {
    console.error('Add product error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to add product' 
    });
  }
});

// Get single product
app.get('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();
    const [products] = await connection.execute(
      'SELECT * FROM products WHERE id = ?',
      [id]
    );
    connection.release();

    if (products.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    res.json(products[0]);
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch product' 
    });
  }
});

// Update product
app.put('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, description } = req.body;
    
    const connection = await pool.getConnection();
    await connection.execute(
      'UPDATE products SET name = ?, price = ?, description = ? WHERE id = ?',
      [name, price, description, id]
    );

    const [updatedProduct] = await connection.execute(
      'SELECT * FROM products WHERE id = ?',
      [id]
    );
    connection.release();

    res.json({ 
      success: true, 
      product: updatedProduct[0] 
    });

  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update product' 
    });
  }
});

// Delete product
app.delete('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();
    await connection.execute('DELETE FROM products WHERE id = ?', [id]);
    connection.release();

    res.json({ 
      success: true, 
      message: 'Product deleted successfully' 
    });

  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete product' 
    });
  }
});

// Start the server
startServer(); 