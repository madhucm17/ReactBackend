const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Get comments for a post
router.get('/post/:postId', async (req, res) => {
  try {
    const postId = req.params.postId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const [comments] = await db.promise().query(`
      SELECT c.*, u.username, u.full_name, u.avatar,
             (SELECT COUNT(*) FROM comments WHERE parent_id = c.id) as replies_count
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.post_id = ? AND c.parent_id IS NULL
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `, [postId, limit, offset]);

    const [countResult] = await db.promise().query(
      'SELECT COUNT(*) as total FROM comments WHERE post_id = ? AND parent_id IS NULL',
      [postId]
    );

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

// Get replies for a comment
router.get('/comment/:commentId/replies', async (req, res) => {
  try {
    const commentId = req.params.commentId;

    const [replies] = await db.promise().query(`
      SELECT c.*, u.username, u.full_name, u.avatar
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.parent_id = ?
      ORDER BY c.created_at ASC
    `, [commentId]);

    res.json({ replies });
  } catch (error) {
    console.error('Get replies error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add comment
router.post('/', auth, [
  body('content').notEmpty().withMessage('Comment content is required'),
  body('post_id').isInt().withMessage('Valid post ID is required'),
  body('parent_id').optional().isInt().withMessage('Valid parent comment ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { content, post_id, parent_id } = req.body;

    // Verify post exists
    const [posts] = await db.promise().query(
      'SELECT * FROM posts WHERE id = ? AND status = "published"',
      [post_id]
    );

    if (posts.length === 0) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Verify parent comment exists if provided
    if (parent_id) {
      const [parentComments] = await db.promise().query(
        'SELECT * FROM comments WHERE id = ? AND post_id = ?',
        [parent_id, post_id]
      );

      if (parentComments.length === 0) {
        return res.status(404).json({ message: 'Parent comment not found' });
      }
    }

    const [result] = await db.promise().query(
      'INSERT INTO comments (content, post_id, user_id, parent_id) VALUES (?, ?, ?, ?)',
      [content, post_id, req.user.id, parent_id || null]
    );

    // Get the created comment with user info
    const [comments] = await db.promise().query(`
      SELECT c.*, u.username, u.full_name, u.avatar
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `, [result.insertId]);

    res.status(201).json({
      message: 'Comment added successfully',
      comment: comments[0]
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update comment
router.put('/:id', auth, [
  body('content').notEmpty().withMessage('Comment content is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const commentId = req.params.id;
    const { content } = req.body;

    // Check if user owns the comment
    const [comments] = await db.promise().query(
      'SELECT * FROM comments WHERE id = ? AND user_id = ?',
      [commentId, req.user.id]
    );

    if (comments.length === 0) {
      return res.status(404).json({ message: 'Comment not found or access denied' });
    }

    await db.promise().query(
      'UPDATE comments SET content = ? WHERE id = ?',
      [content, commentId]
    );

    res.json({ message: 'Comment updated successfully' });
  } catch (error) {
    console.error('Update comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete comment
router.delete('/:id', auth, async (req, res) => {
  try {
    const commentId = req.params.id;

    // Check if user owns the comment or is admin
    const [comments] = await db.promise().query(
      'SELECT * FROM comments WHERE id = ? AND (user_id = ? OR ? = "admin")',
      [commentId, req.user.id, req.user.role]
    );

    if (comments.length === 0) {
      return res.status(404).json({ message: 'Comment not found or access denied' });
    }

    // Delete comment and all its replies
    await db.promise().query(
      'DELETE FROM comments WHERE id = ? OR parent_id = ?',
      [commentId, commentId]
    );

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's comments
router.get('/user/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const [comments] = await db.promise().query(`
      SELECT c.*, p.title as post_title, p.id as post_id,
             u.username, u.full_name, u.avatar
      FROM comments c
      JOIN posts p ON c.post_id = p.id
      JOIN users u ON c.user_id = u.id
      WHERE c.user_id = ? AND c.parent_id IS NULL
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `, [userId, limit, offset]);

    const [countResult] = await db.promise().query(
      'SELECT COUNT(*) as total FROM comments WHERE user_id = ? AND parent_id IS NULL',
      [userId]
    );

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

module.exports = router;
