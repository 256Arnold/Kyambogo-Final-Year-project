const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');

const router = express.Router();
const SALT_ROUNDS = 10;
const JWT_EXPIRY = '7d';

// POST /api/auth/signup — create user + profile, return JWT
router.post('/signup', async (req, res) => {
  try {
    const { role, email, password, ...profile } = req.body;
    if (!role || !email || !password) {
      return res.status(400).json({ error: 'role, email and password are required' });
    }
    const validRoles = ['resident', 'collector', 'kcca', 'kcca_officer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    const dbRole = role === 'kcca' ? 'kcca_officer' : role;

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const userResult = await client.query(
        `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3)
         RETURNING id, email, role, created_at`,
        [email.trim().toLowerCase(), passwordHash, dbRole]
      );
      const user = userResult.rows[0];
      const userId = user.id;
      const roleCol = dbRole;

      if (roleCol === 'resident') {
        const firstName = (profile.first_name || '').trim() || 'Resident';
        const lastName = (profile.last_name || '').trim() || 'User';
        await client.query(
          `INSERT INTO residents (user_id, first_name, last_name, phone, zone)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            userId,
            firstName,
            lastName,
            (profile.phone || '').trim() || null,
            (profile.zone || '').trim() || null
          ]
        );
      } else if (roleCol === 'kcca_officer') {
        await client.query(
          `INSERT INTO kcca_officers (user_id, first_name, last_name, department, jurisdiction, staff_id)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            userId,
            (profile.first_name || '').trim(),
            (profile.last_name || '').trim(),
            (profile.department || '').trim() || null,
            (profile.jurisdiction || '').trim() || null,
            (profile.staff_id || '').trim() || null
          ]
        );
      } else if (roleCol === 'collector') {
        await client.query(
          `INSERT INTO collectors (user_id, full_name, phone, company, truck_plate, primary_zone)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            userId,
            (profile.full_name || '').trim(),
            (profile.phone || '').trim() || null,
            (profile.company || '').trim() || null,
            (profile.truck_plate || '').trim() || null,
            (profile.primary_zone || '').trim() || null
          ]
        );
      }

      await client.query('COMMIT');
      const token = jwt.sign(
        { sub: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: JWT_EXPIRY }
      );
      return res.status(201).json({
        token,
        user: { id: user.id, email: user.email, role: user.role }
      });
    } catch (e) {
      await client.query('ROLLBACK');
      if (e.code === '23505') {
        return res.status(409).json({ error: 'An account with this email already exists' });
      }
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Signup error:', err);
    const message = process.env.NODE_ENV === 'development' ? (err.message || String(err)) : 'Registration failed';
    return res.status(500).json({ error: message });
  }
});

// POST /api/auth/signin — verify credentials, return JWT
router.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await pool.query(
      'SELECT id, email, password_hash, role FROM users WHERE email = $1',
      [email.trim().toLowerCase()]
    );
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );
    return res.json({
      token,
      user: { id: user.id, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error('Signin error:', err);
    return res.status(500).json({ error: 'Sign in failed' });
  }
});

module.exports = router;
