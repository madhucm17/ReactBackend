const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 8081;

// Dummy in-memory data
let products = [
  { id: 1, name: 'Book A', price: 10.99 },
  { id: 2, name: 'Book B', price: 12.49 },
];

// Middleware
app.use(cors());
app.use(express.json());

// User login endpoint
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  // Dummy authentication: accept any username/password
  if (username && password) {
    return res.json({ success: true, message: 'Login successful', user: { username } });
  }
  res.status(400).json({ success: false, message: 'Username and password required' });
});

// Get products
app.get('/api/products', (req, res) => {
  res.json(products);
});

// Add new product
app.post('/api/products', (req, res) => {
  const { name, price } = req.body;
  if (!name || typeof price !== 'number') {
    return res.status(400).json({ success: false, message: 'Name and price are required' });
  }
  const newProduct = {
    id: products.length + 1,
    name,
    price,
  };
  products.push(newProduct);
  res.status(201).json({ success: true, product: newProduct });
});

// Start server
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
}); 