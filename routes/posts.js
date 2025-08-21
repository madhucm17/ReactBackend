const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/posts';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'post-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Get all published posts
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';

    let query = `
      SELECT p.*, u.username, u.full_name, u.avatar,
             (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count
      FROM posts p
      JOIN users u ON p.author_id = u.id
      WHERE p.status = 'published'
    `;
    
    let countQuery = `
      SELECT COUNT(*) as total
      FROM posts p
      JOIN users u ON p.author_id = u.id
      WHERE p.status = 'published'
    `;

    const params = [];
    if (search) {
      query += ' AND (p.title LIKE ? OR p.content LIKE ?)';
      countQuery += ' AND (p.title LIKE ? OR p.content LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [posts] = await db.promise().query(query, params);
    const [countResult] = await db.promise().query(countQuery, search ? [`%${search}%`, `%${search}%`] : []);

    res.json({
      posts,
      pagination: {
        current: page,
        total: Math.ceil(countResult[0].total / limit),
        hasNext: page * limit < countResult[0].total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single post
router.get('/:id', async (req, res) => {
  try {
    const postId = req.params.id;

    // Increment view count
    await db.promise().query('UPDATE posts SET views = views + 1 WHERE id = ?', [postId]);

    const [posts] = await db.promise().query(`
      SELECT p.*, u.username, u.full_name, u.avatar, u.bio,
             (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count
      FROM posts p
      JOIN users u ON p.author_id = u.id
      WHERE p.id = ? AND p.status = 'published'
    `, [postId]);

    if (posts.length === 0) {
      return res.status(404).json({ message: 'Post not found' });
    }

    res.json({ post: posts[0] });
  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new post
router.post('/', auth, upload.single('featured_image'), [
  body('title').notEmpty().withMessage('Title is required'),
  body('content').notEmpty().withMessage('Content is required'),
  body('excerpt').optional(),
  body('status').isIn(['draft', 'published']).withMessage('Invalid status')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, content, excerpt, status } = req.body;
    const featured_image = req.file ? `/uploads/posts/${req.file.filename}` : null;

    const [result] = await db.promise().query(
      'INSERT INTO posts (title, content, excerpt, featured_image, author_id, status) VALUES (?, ?, ?, ?, ?, ?)',
      [title, content, excerpt, featured_image, req.user.id, status]
    );

    res.status(201).json({
      message: 'Post created successfully',
      postId: result.insertId
    });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update post
router.put('/:id', auth, upload.single('featured_image'), [
  body('title').notEmpty().withMessage('Title is required'),
  body('content').notEmpty().withMessage('Content is required'),
  body('excerpt').optional(),
  body('status').isIn(['draft', 'published']).withMessage('Invalid status')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const postId = req.params.id;
    const { title, content, excerpt, status } = req.body;

    // Check if user owns the post or is admin
    const [posts] = await db.promise().query(
      'SELECT * FROM posts WHERE id = ? AND (author_id = ? OR ? = "admin")',
      [postId, req.user.id, req.user.role]
    );

    if (posts.length === 0) {
      return res.status(404).json({ message: 'Post not found or access denied' });
    }

    let featured_image = posts[0].featured_image;
    if (req.file) {
      featured_image = `/uploads/posts/${req.file.filename}`;
      
      // Delete old image if exists
      if (posts[0].featured_image) {
        const oldImagePath = path.join(__dirname, '..', posts[0].featured_image);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
    }

    await db.promise().query(
      'UPDATE posts SET title = ?, content = ?, excerpt = ?, featured_image = ?, status = ? WHERE id = ?',
      [title, content, excerpt, featured_image, status, postId]
    );

    res.json({ message: 'Post updated successfully' });
  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete post
router.delete('/:id', auth, async (req, res) => {
  try {
    const postId = req.params.id;

    // Check if user owns the post or is admin
    const [posts] = await db.promise().query(
      'SELECT * FROM posts WHERE id = ? AND (author_id = ? OR ? = "admin")',
      [postId, req.user.id, req.user.role]
    );

    if (posts.length === 0) {
      return res.status(404).json({ message: 'Post not found or access denied' });
    }

    // Delete featured image if exists
    if (posts[0].featured_image) {
      const imagePath = path.join(__dirname, '..', posts[0].featured_image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await db.promise().query('DELETE FROM posts WHERE id = ?', [postId]);

    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Like/Unlike post
router.post('/:id/like', auth, async (req, res) => {
  try {
    const postId = req.params.id;

    // Check if already liked
    const [likes] = await db.promise().query(
      'SELECT * FROM likes WHERE user_id = ? AND post_id = ?',
      [req.user.id, postId]
    );

    if (likes.length > 0) {
      // Unlike
      await db.promise().query(
        'DELETE FROM likes WHERE user_id = ? AND post_id = ?',
        [req.user.id, postId]
      );
      await db.promise().query(
        'UPDATE posts SET likes = likes - 1 WHERE id = ?',
        [postId]
      );
      res.json({ message: 'Post unliked', liked: false });
    } else {
      // Like
      await db.promise().query(
        'INSERT INTO likes (user_id, post_id) VALUES (?, ?)',
        [req.user.id, postId]
      );
      await db.promise().query(
        'UPDATE posts SET likes = likes + 1 WHERE id = ?',
        [postId]
      );
      res.json({ message: 'Post liked', liked: true });
    }
  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's posts
router.get('/user/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const [posts] = await db.promise().query(`
      SELECT p.*, u.username, u.full_name, u.avatar,
             (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count
      FROM posts p
      JOIN users u ON p.author_id = u.id
      WHERE p.author_id = ? AND p.status = 'published'
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `, [userId, limit, offset]);

    const [countResult] = await db.promise().query(
      'SELECT COUNT(*) as total FROM posts WHERE author_id = ? AND status = "published"',
      [userId]
    );

    res.json({
      posts,
      pagination: {
        current: page,
        total: Math.ceil(countResult[0].total / limit),
        hasNext: page * limit < countResult[0].total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get user posts error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
