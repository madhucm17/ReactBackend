const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Configure multer for avatar uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/avatars';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
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

// Get user profile
router.get('/:username', async (req, res) => {
  try {
    const username = req.params.username;

    const [users] = await db.promise().query(`
      SELECT id, username, email, full_name, avatar, bio, created_at,
             (SELECT COUNT(*) FROM posts WHERE author_id = users.id AND status = 'published') as posts_count,
             (SELECT COUNT(*) FROM comments WHERE user_id = users.id) as comments_count
      FROM users
      WHERE username = ?
    `, [username]);

    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user: users[0] });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user profile
router.put('/profile', auth, upload.single('avatar'), [
  body('full_name').notEmpty().withMessage('Full name is required'),
  body('bio').optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { full_name, bio } = req.body;
    let avatar = req.user.avatar;

    if (req.file) {
      avatar = `/uploads/avatars/${req.file.filename}`;
      
      // Delete old avatar if exists
      if (req.user.avatar) {
        const oldAvatarPath = path.join(__dirname, '..', req.user.avatar);
        if (fs.existsSync(oldAvatarPath)) {
          fs.unlinkSync(oldAvatarPath);
        }
      }
    }

    await db.promise().query(
      'UPDATE users SET full_name = ?, bio = ?, avatar = ? WHERE id = ?',
      [full_name, bio, avatar, req.user.id]
    );

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's posts
router.get('/:username/posts', async (req, res) => {
  try {
    const username = req.params.username;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const [posts] = await db.promise().query(`
      SELECT p.*, u.username, u.full_name, u.avatar,
             (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count
      FROM posts p
      JOIN users u ON p.author_id = u.id
      WHERE u.username = ? AND p.status = 'published'
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `, [username, limit, offset]);

    const [countResult] = await db.promise().query(`
      SELECT COUNT(*) as total
      FROM posts p
      JOIN users u ON p.author_id = u.id
      WHERE u.username = ? AND p.status = 'published'
    `, [username]);

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

// Get user's comments
router.get('/:username/comments', async (req, res) => {
  try {
    const username = req.params.username;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const [comments] = await db.promise().query(`
      SELECT c.*, p.title as post_title, p.id as post_id,
             u.username, u.full_name, u.avatar
      FROM comments c
      JOIN posts p ON c.post_id = p.id
      JOIN users u ON c.user_id = u.id
      WHERE u.username = ? AND c.parent_id IS NULL
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `, [username, limit, offset]);

    const [countResult] = await db.promise().query(`
      SELECT COUNT(*) as total
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE u.username = ? AND c.parent_id IS NULL
    `, [username]);

    res.json({
      comments,
      pagination: {
        current: page,
        total: Math.ceil(countResult[0].total / limit),
        hasNext: page * limit < countResult[0].total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get user comments error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Search users
router.get('/search/:query', async (req, res) => {
  try {
    const query = req.params.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const [users] = await db.promise().query(`
      SELECT id, username, full_name, avatar, bio,
             (SELECT COUNT(*) FROM posts WHERE author_id = users.id AND status = 'published') as posts_count
      FROM users
      WHERE username LIKE ? OR full_name LIKE ?
      ORDER BY posts_count DESC, username ASC
      LIMIT ? OFFSET ?
    `, [`%${query}%`, `%${query}%`, limit, offset]);

    const [countResult] = await db.promise().query(
      'SELECT COUNT(*) as total FROM users WHERE username LIKE ? OR full_name LIKE ?',
      [`%${query}%`, `%${query}%`]
    );

    res.json({
      users,
      pagination: {
        current: page,
        total: Math.ceil(countResult[0].total / limit),
        hasNext: page * limit < countResult[0].total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get top users (by post count)
router.get('/top/contributors', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const [users] = await db.promise().query(`
      SELECT u.id, u.username, u.full_name, u.avatar, u.bio,
             COUNT(p.id) as posts_count,
             SUM(p.views) as total_views,
             SUM(p.likes) as total_likes
      FROM users u
      LEFT JOIN posts p ON u.id = p.author_id AND p.status = 'published'
      GROUP BY u.id
      HAVING posts_count > 0
      ORDER BY posts_count DESC, total_views DESC
      LIMIT ?
    `, [limit]);

    res.json({ users });
  } catch (error) {
    console.error('Get top users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
