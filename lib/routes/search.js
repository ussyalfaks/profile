const express = require('express');
const prisma = require('../prisma');
const { formatProfile } = require('../formatter');
const { parseQuery } = require('../query-parser');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const { q, page: rawPage = '1', limit: rawLimit = '10' } = req.query;

    if (!q || typeof q !== 'string' || q.trim() === '') {
      return res.status(400).json({ status: 'error', message: 'Invalid query parameters' });
    }

    const page = parseInt(rawPage, 10);
    const limit = parseInt(rawLimit, 10);
    if (isNaN(page) || page < 1) {
      return res.status(422).json({ status: 'error', message: 'page must be a positive integer' });
    }
    if (isNaN(limit) || limit < 1) return res.status(422).json({ status: 'error', message: 'limit must be a positive integer' });
    if (limit > 50) return res.status(422).json({ status: 'error', message: 'limit must not exceed 50' });

    const filters = parseQuery(q.trim());

    if (Object.keys(filters).length === 0) {
      return res.status(422).json({ status: 'error', message: 'Unable to interpret query' });
    }

    // Build Prisma where clause from parsed filters
    const where = {};

    if (filters.gender) {
      where.gender = { equals: filters.gender, mode: 'insensitive' };
    }
    if (filters.age_group) {
      where.age_group = { equals: filters.age_group, mode: 'insensitive' };
    }
    if (filters.country_id) {
      where.country_id = { equals: filters.country_id, mode: 'insensitive' };
    }
    if (filters.min_age !== undefined || filters.max_age !== undefined) {
      where.age = {};
      if (filters.min_age !== undefined) where.age.gte = filters.min_age;
      if (filters.max_age !== undefined) where.age.lte = filters.max_age;
    }

    const skip = (page - 1) * limit;

    const [total, profiles] = await Promise.all([
      prisma.profile.count({ where }),
      prisma.profile.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return res.status(200).json({
      status: 'success',
      page,
      limit,
      total,
      data: profiles.map(formatProfile),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
