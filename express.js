const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcrypt');

const app = express();
app.use(express.json());
app.use(cors());

// --- Database Connection ---
// Set your MySQL credentials here
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '9347984229', // Your MySQL password
  database: 'amazon_clone'
});

db.connect(err => { 
  if (err) {
    console.error('MySQL connection failed:', err.message);
    return;
  }
  console.log('Connected to MySQL Database');
});

// --- AUTH ENDPOINTS ---

app.post('/api/auth/signup', async (req, res) => {
  const { email, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  
  db.query('INSERT INTO users (email, password) VALUES (?, ?)', [email, hashed], (err, result) => {
    if (err) return res.status(500).json({ message: "User exists or DB error" });
    res.json({ user: { id: result.insertId, email, name: email.split('@')[0] } });
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
    if (err || results.length === 0) return res.status(401).json({ message: "User not found" });
    const match = await bcrypt.compare(password, results[0].password);
    if (!match) return res.status(401).json({ message: "Invalid credentials" });
    
    res.json({ user: { id: results[0].id, email, name: email.split('@')[0] } });
  });
});

// --- PRODUCT ENDPOINTS ---

app.get('/api/products', (req, res) => {
  db.query('SELECT * FROM products', (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
});

// --- CART ENDPOINTS ---

app.get('/api/cart', (req, res) => {
  const { userId } = req.query;
  const q = `
    SELECT c.quantity, p.* FROM cart c 
    JOIN products p ON c.product_id = p.id 
    WHERE c.user_id = ?`;
  db.query(q, [userId], (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results.map(r => ({ ...r, productId: r.id })));
  });
});

app.post('/api/cart', (req, res) => {
  const { userId, productId, quantity } = req.body;
  const q = 'INSERT INTO cart (user_id, product_id, quantity) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantity = quantity + ?';
  db.query(q, [userId, productId, quantity, quantity], (err) => {
    if (err) return res.status(500).json(err);
    // Return updated cart
    res.redirect(`/api/cart?userId=${userId}`);
  });
});

app.put('/api/cart/update', (req, res) => {
  const { userId, productId, quantity } = req.body;
  db.query('UPDATE cart SET quantity = ? WHERE user_id = ? AND product_id = ?', [quantity, userId, productId], (err) => {
    if (err) return res.status(500).json(err);
    res.redirect(`/api/cart?userId=${userId}`);
  });
});

app.delete('/api/cart/:productId', (req, res) => {
  const { productId } = req.params;
  const { userId } = req.query;
  db.query('DELETE FROM cart WHERE user_id = ? AND product_id = ?', [userId, productId], (err) => {
    if (err) return res.status(500).json(err);
    res.redirect(`/api/cart?userId=${userId}`);
  });
});

// --- ORDER ENDPOINTS ---

app.post('/api/orders', (req, res) => {
  const { userId, total, items } = req.body;
  const itemsJson = JSON.stringify(items);
  
  db.query('INSERT INTO orders (user_id, total, items_json) VALUES (?, ?, ?)', [userId, total, itemsJson], (err, result) => {
    if (err) return res.status(500).json(err);
    // Clear cart
    db.query('DELETE FROM cart WHERE user_id = ?', [userId]);
    res.json({ order: { id: result.insertId, total, items_json: itemsJson, created_at: new Date() } });
  });
});

app.get('/api/orders', (req, res) => {
  const { userId } = req.query;
  db.query('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [userId], (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));