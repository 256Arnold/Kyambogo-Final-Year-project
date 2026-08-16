const express = require('express');
const { pool } = require('../db');
const { authenticate, requireRole, normalizeRole } = require('../middleware/auth');

const router = express.Router();

const VALID_STATUSES = [
  'pending_assignment',
  'paid_pending_assignment',
  'assigned',
  'in_progress',
  'completed',
  'disputed',
  'cancelled'
];

const VALID_PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'];

function normalizeStatus(status) {
  return status || 'pending_assignment';
}

function isValidLatitude(value) {
  const num = Number(value);
  return Number.isFinite(num) && num >= -90 && num <= 90;
}

function isValidLongitude(value) {
  const num = Number(value);
  return Number.isFinite(num) && num >= -180 && num <= 180;
}

function getUserRoleId(client, userId) {
  return client.query('SELECT role FROM users WHERE id = $1', [userId]);
}

async function getResidentProfileId(client, userId) {
  const result = await client.query('SELECT id FROM residents WHERE user_id = $1', [userId]);
  return result.rows[0]?.id || null;
}

async function getCollectorProfileId(client, userId) {
  const result = await client.query('SELECT id FROM collectors WHERE user_id = $1', [userId]);
  return result.rows[0]?.id || null;
}

async function createNotification(client, { userId, requestId, type, message }) {
  if (!userId) return;
  await client.query(
    `INSERT INTO notifications (user_id, request_id, type, message, created_at)
     VALUES ($1, $2, $3, $4, now())`,
    [userId, requestId || null, type || 'request_update', message || 'Request updated',]
  );
}

router.use(authenticate);

router.post('/', async (req, res) => {
  try {
    const user = req.user;
    const role = normalizeRole(user.role);
    if (role !== 'resident') {
      return res.status(403).json({ error: 'Only residents can create collection requests' });
    }

    const {
      waste_type,
      volume,
      zone,
      pickup_address,
      latitude,
      longitude,
      preferred_date,
      preferred_time,
      notes,
      amount_ugx,
      payment_status
    } = req.body || {};

    if (!pickup_address && (!latitude || !longitude)) {
      return res.status(400).json({ error: 'pickup_address or latitude/longitude is required' });
    }

    if (latitude !== undefined && latitude !== null && !isValidLatitude(latitude)) {
      return res.status(400).json({ error: 'latitude must be between -90 and 90' });
    }
    if (longitude !== undefined && longitude !== null && !isValidLongitude(longitude)) {
      return res.status(400).json({ error: 'longitude must be between -180 and 180' });
    }

    const residentId = await getResidentProfileId(await pool.connect(), user.sub);
    if (!residentId) {
      return res.status(404).json({ error: 'Resident profile not found' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const status = normalizeStatus('pending_assignment');
      const paymentState = VALID_PAYMENT_STATUSES.includes(payment_status) ? payment_status : 'pending';
      const amount = Number(amount_ugx || 0);

      const result = await client.query(
        `INSERT INTO collection_requests (
          resident_id, waste_type, volume, zone, pickup_address, latitude, longitude,
          preferred_date, preferred_time, notes, amount_ugx, payment_status, status,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now(), now())
         RETURNING *`,
        [
          residentId,
          waste_type || 'household',
          volume || 'medium',
          zone || null,
          pickup_address || null,
          latitude !== undefined && latitude !== null ? Number(latitude) : null,
          longitude !== undefined && longitude !== null ? Number(longitude) : null,
          preferred_date || null,
          preferred_time || null,
          notes || null,
          Number.isFinite(amount) ? amount : 0,
          paymentState,
          status
        ]
      );

      const request = result.rows[0];
      await createNotification(client, {
        userId: user.sub,
        requestId: request.id,
        type: 'request_created',
        message: 'Your collection request has been created.'
      });

      await client.query('COMMIT');
      return res.status(201).json({ request });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Create request error:', error);
    return res.status(500).json({ error: 'Failed to create request' });
  }
});

router.get('/', async (req, res) => {
  try {
    const user = req.user;
    const role = normalizeRole(user.role);

    const client = await pool.connect();
    try {
      if (role === 'resident') {
        const residentId = await getResidentProfileId(client, user.sub);
        if (!residentId) {
          return res.json({ requests: [] });
        }
        const result = await client.query(
          'SELECT * FROM collection_requests WHERE resident_id = $1 ORDER BY created_at DESC',
          [residentId]
        );
        return res.json({ requests: result.rows });
      }

      if (role === 'collector') {
        const collectorId = await getCollectorProfileId(client, user.sub);
        if (!collectorId) {
          return res.json({ requests: [] });
        }
        const result = await client.query(
          'SELECT * FROM collection_requests WHERE collector_id = $1 ORDER BY created_at DESC',
          [collectorId]
        );
        return res.json({ requests: result.rows });
      }

      if (role === 'kcca_officer') {
        const result = await client.query('SELECT * FROM collection_requests ORDER BY created_at DESC');
        return res.json({ requests: result.rows });
      }

      return res.status(403).json({ error: 'Unsupported role' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('List requests error:', error);
    return res.status(500).json({ error: 'Failed to load requests' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const user = req.user;
    const role = normalizeRole(user.role);
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM collection_requests WHERE id = $1', [req.params.id]);
      const request = result.rows[0];
      if (!request) {
        return res.status(404).json({ error: 'Request not found' });
      }

      const residentId = await getResidentProfileId(client, user.sub);
      const collectorId = await getCollectorProfileId(client, user.sub);

      const isOwner = residentId && request.resident_id === residentId;
      const isAssignedCollector = collectorId && request.collector_id === collectorId;
      const isAdmin = role === 'kcca_officer';

      if (!(isOwner || isAssignedCollector || isAdmin)) {
        return res.status(403).json({ error: 'You do not have access to this request' });
      }

      return res.json({ request });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get request error:', error);
    return res.status(500).json({ error: 'Failed to load request' });
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const user = req.user;
    const role = normalizeRole(user.role);
    const { status } = req.body || {};
    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const client = await pool.connect();
    try {
      const requestRes = await client.query('SELECT * FROM collection_requests WHERE id = $1', [req.params.id]);
      const request = requestRes.rows[0];
      if (!request) {
        return res.status(404).json({ error: 'Request not found' });
      }

      const residentId = await getResidentProfileId(client, user.sub);
      const collectorId = await getCollectorProfileId(client, user.sub);
      const isOwner = residentId && request.resident_id === residentId;
      const isCollector = collectorId && request.collector_id === collectorId;
      const isAdmin = role === 'kcca_officer';

      const allowedByRole = {
        resident: ['pending_assignment', 'paid_pending_assignment'],
        collector: ['assigned', 'in_progress', 'completed'],
        kcca_officer: VALID_STATUSES
      };

      if (!isAdmin && !((role === 'resident' && isOwner) || (role === 'collector' && isCollector))) {
        return res.status(403).json({ error: 'You are not authorized to update this request' });
      }

      if (!allowedByRole[role] || !allowedByRole[role].includes(status)) {
        return res.status(403).json({ error: 'This role cannot set that status' });
      }

      const nextStatus = status;
      const updates = ['status = $1', 'updated_at = now()'];
      const values = [nextStatus];
      let idx = 2;

      if (nextStatus === 'completed') {
        updates.push(`completed_at = $${idx}`);
        values.push(new Date());
        idx += 1;
      }

      if (role === 'collector' && nextStatus === 'in_progress') {
        updates.push(`assigned_at = COALESCE(assigned_at, now())`);
      }

      if (role === 'kcca_officer' && nextStatus === 'assigned') {
        updates.push(`assigned_at = $${idx}`);
        values.push(new Date());
        idx += 1;
      }

      values.push(req.params.id);
      const query = `UPDATE collection_requests SET ${updates.join(', ')} WHERE id = $${idx}`;
      await client.query(query, values);

      if (nextStatus === 'assigned' && role === 'kcca_officer') {
        await createNotification(client, {
          userId: request.resident_id ? await client.query('SELECT user_id FROM residents WHERE id = $1', [request.resident_id]).then(r => r.rows[0]?.user_id) : null,
          requestId: request.id,
          type: 'request_assigned',
          message: 'A driver has been assigned to your collection request.'
        });
      }

      if (nextStatus === 'completed') {
        const residentUserId = await client.query('SELECT user_id FROM residents WHERE id = $1', [request.resident_id]).then(r => r.rows[0]?.user_id);
        await createNotification(client, {
          userId: residentUserId,
          requestId: request.id,
          type: 'collection_completed',
          message: 'Your collection request has been completed.'
        });
      }

      const updated = await client.query('SELECT * FROM collection_requests WHERE id = $1', [req.params.id]);
      return res.json({ request: updated.rows[0] });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Update status error:', error);
    return res.status(500).json({ error: 'Failed to update request status' });
  }
});

module.exports = router;
