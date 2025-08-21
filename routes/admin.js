const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { adminAuth } = require('../middleware/auth');

const router = express.Router();

// Get dashboard statistics
router.get('/dashboard', adminAuth, async (req, res) => {
  try {
    // Total users
    const [userCount] = await db.promise().query('SELECT COUNT(*) as count FROM users');
    
    // Total posts
    const [postCount] = await db.promise().query('SELECT COUNT(*) as count FROM posts');
    
    // Published posts
    const [publishedCount] = await db.promise().query('SELECT COUNT(*) as count FROM posts WHERE status = "published"');
    
    // Draft posts
    const [draftCount] = await db.promise().query('SELECT COUNT(*) as count FROM posts WHERE status = "draft"');
    
    // Total comments
    const [commentCount] = await db.promise().query('SELECT COUNT(*) as count FROM comments');
    
    // Total views
    const [viewCount] = await db.promise().query('SELECT SUM(views) as count FROM posts');
    
    // Total likes
    const [likeCount] = await db.promise().query('SELECT SUM(likes) as count FROM posts');
    
    // Recent posts
    const [recentPosts] = await db.promise().query(`
      SELECT p.*, u.username, u.full_name
      FROM posts p
      JOIN users u ON p.author_id = u.id
      ORDER BY p.created_at DESC
      LIMIT 5
    `);
    
    // Recent users
    const [recentUsers] = await db.promise().query(`
      SELECT id, username, email, full_name, created_at
      FROM users
      ORDER BY created_at DESC
      LIMIT 5
    `);

    res.json({
      stats: {
        totalUsers: userCount[0].count,
        totalPosts: postCount[0].count,
        publishedPosts: publishedCount[0].count,
        draftPosts: draftCount[0].count,
        totalComments: commentCount[0].count,
        totalViews: viewCount[0].count || 0,
        totalLikes: likeCount[0].count || 0
      },
      recentPosts,
      recentUsers
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all users (admin)
router.get('/users', adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';

    let query = `
      SELECT u.*,
             (SELECT COUNT(*) FROM posts WHERE author_id = u.id) as posts_count,
             (SELECT COUNT(*) FROM comments WHERE user_id = u.id) as comments_count
      FROM users u
    `;
    
    let countQuery = 'SELECT COUNT(*) as total FROM users u';
    const params = [];

    if (search) {
      query += ' WHERE u.username LIKE ? OR u.email LIKE ? OR u.full_name LIKE ?';
      countQuery += ' WHERE u.username LIKE ? OR u.email LIKE ? OR u.full_name LIKE ?';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY u.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [users] = await db.promise().query(query, params);
    const [countResult] = await db.promise().query(countQuery, search ? [`%${search}%`, `%${search}%`, `%${search}%`] : []);

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
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user role
router.put('/users/:id/role', adminAuth, [
  body('role').isIn(['user', 'admin']).withMessage('Invalid role')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.params.id;
    const { role } = req.body;

    // Prevent admin from removing their own admin role
    if (userId == req.user.id && role === 'user') {
      return res.status(400).json({ message: 'Cannot remove your own admin role' });
    }

    await db.promise().query(
      'UPDATE users SET role = ? WHERE id = ?',
      [role, userId]
    );

    res.json({ message: 'User role updated successfully' });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete user
router.delete('/users/:id', adminAuth, async (req, res) => {
  try {
    const userId = req.params.id;

    // Prevent admin from deleting themselves
    if (userId == req.user.id) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    await db.promise().query('DELETE FROM users WHERE id = ?', [userId]);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all posts (admin)
router.get('/posts', adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status || '';
    const search = req.query.search || '';

    let query = `
      SELECT p.*, u.username, u.full_name,
             (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count
      FROM posts p
      JOIN users u ON p.author_id = u.id
    `;
    
    let countQuery = `
      SELECT COUNT(*) as total
      FROM posts p
      JOIN users u ON p.author_id = u.id
    `;
    
    const params = [];
    const whereConditions = [];

    if (status) {
      whereConditions.push('p.status = ?');
      params.push(status);
    }

    if (search) {
      whereConditions.push('(p.title LIKE ? OR p.content LIKE ? OR u.username LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
      countQuery += ' WHERE ' + whereConditions.join(' AND ');
    }

    query += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [posts] = await db.promise().query(query, params);
    const [countResult] = await db.promise().query(countQuery, params.slice(0, -2));

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

// Update post status
router.put('/posts/:id/status', adminAuth, [
  body('status').isIn(['draft', 'published']).withMessage('Invalid status')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const postId = req.params.id;
    const { status } = req.body;

    await db.promise().query(
      'UPDATE posts SET status = ? WHERE id = ?',
      [status, postId]
    );

    res.json({ message: 'Post status updated successfully' });
  } catch (error) {
    console.error('Update post status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete post (admin)
router.delete('/posts/:id', adminAuth, async (req, res) => {
  try {
    const postId = req.params.id;

    await db.promise().query('DELETE FROM posts WHERE id = ?', [postId]);

    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all comments (admin)
router.get('/comments', adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';

    let query = `
      SELECT c.*, u.username, u.full_name, p.title as post_title
      FROM comments c
      JOIN users u ON c.user_id = u.id
      JOIN posts p ON c.post_id = p.id
    `;
    
    let countQuery = `
      SELECT COUNT(*) as total
      FROM comments c
      JOIN users u ON c.user_id = u.id
      JOIN posts p ON c.post_id = p.id
    `;
    
    const params = [];
    if (search) {
      query += ' WHERE c.content LIKE ? OR u.username LIKE ? OR p.title LIKE ?';
      countQuery += ' WHERE c.content LIKE ? OR u.username LIKE ? OR p.title LIKE ?';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY c.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [comments] = await db.promise().query(query, params);
    const [countResult] = await db.promise().query(countQuery, search ? [`%${search}%`, `%${search}%`, `%${search}%`] : []);

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
    console.error('Get comments error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete comment (admin)
router.delete('/comments/:id', adminAuth, async (req, res) => {
  try {
    const commentId = req.params.id;

    await db.promise().query('DELETE FROM comments WHERE id = ? OR parent_id = ?', [commentId, commentId]);

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get analytics
router.get('/analytics', adminAuth, async (req, res) => {
  try {
    // Posts by month (last 12 months)
    const [postsByMonth] = await db.promise().query(`
      SELECT DATE_FORMAT(created_at, '%Y-%m') as month,
             COUNT(*) as count
      FROM posts
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY month
      ORDER BY month
    `);

    // Users by month (last 12 months)
    const [usersByMonth] = await db.promise().query(`
      SELECT DATE_FORMAT(created_at, '%Y-%m') as month,
             COUNT(*) as count
      FROM users
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY month
      ORDER BY month
    `);

    // Top posts by views
    const [topPostsByViews] = await db.promise().query(`
      SELECT p.title, p.views, p.likes, u.username
      FROM posts p
      JOIN users u ON p.author_id = u.id
      WHERE p.status = 'published'
      ORDER BY p.views DESC
      LIMIT 10
    `);

    // Top posts by likes
    const [topPostsByLikes] = await db.promise().query(`
      SELECT p.title, p.views, p.likes, u.username
      FROM posts p
      JOIN users u ON p.author_id = u.id
      WHERE p.status = 'published'
      ORDER BY p.likes DESC
      LIMIT 10
    `);

    res.json({
      postsByMonth,
      usersByMonth,
      topPostsByViews,
      topPostsByLikes
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
