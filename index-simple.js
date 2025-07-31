const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 8081;

// In-memory storage (for development)
let users = [];
let products = [
  { id: 1, name: 'Book A', price: 10.99, description: 'A great book about programming' },
  { id: 2, name: 'Book B', price: 12.49, description: 'Another amazing book' }
];

// Middleware
app.use(cors());
app.use(express.json());

// User login endpoint
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username and password required' 
      });
    }

    // Check if user exists
    let user = users.find(u => u.username === username);

    if (!user) {
      // Create new user
      const hashedPassword = await bcrypt.hash(password, 10);
      user = {
        id: users.length + 1,
        username,
        password: hashedPassword,
        email: ''
      };
      users.push(user);
      
      const token = jwt.sign(
        { username, id: user.id },
        'your-secret-key',
        { expiresIn: '24h' }
      );

      return res.json({ 
        success: true, 
        message: 'User created and logged in successfully',
        user: { username, id: user.id },
        token
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    const token = jwt.sign(
      { username: user.username, id: user.id },
      'your-secret-key',
      { expiresIn: '24h' }
    );

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

// Get products
app.get('/api/products', (req, res) => {
  res.json(products);
});

// Add new product
app.post('/api/products', (req, res) => {
  try {
    const { name, price, description } = req.body;
    
    if (!name || typeof price !== 'number') {
      return res.status(400).json({ 
        success: false, 
        message: 'Name and price are required' 
      });
    }

    const newProduct = {
      id: products.length + 1,
      name,
      price,
      description: description || ''
    };

    products.push(newProduct);
    res.status(201).json({ 
      success: true, 
      product: newProduct 
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
app.get('/api/products/:id', (req, res) => {
  const { id } = req.params;
  const product = products.find(p => p.id === parseInt(id));

  if (!product) {
    return res.status(404).json({ 
      success: false, 
      message: 'Product not found' 
    });
  }

  res.json(product);
});

// Update product
app.put('/api/products/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, description } = req.body;
    
    const productIndex = products.findIndex(p => p.id === parseInt(id));
    
    if (productIndex === -1) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    products[productIndex] = {
      ...products[productIndex],
      name,
      price,
      description
    };

    res.json({ 
      success: true, 
      product: products[productIndex] 
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
app.delete('/api/products/:id', (req, res) => {
  try {
    const { id } = req.params;
    const productIndex = products.findIndex(p => p.id === parseInt(id));
    
    if (productIndex === -1) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    products.splice(productIndex, 1);

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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
  console.log(`📊 Using in-memory storage (no database required)`);
  console.log(`🔐 JWT Authentication: Enabled`);
}); 