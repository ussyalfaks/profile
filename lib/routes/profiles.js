const express = require('express');
const prisma = require('../prisma');
const { formatProfile } = require('../formatter');

const router = express.Router();

const VALID_SORT_FIELDS = ['age', 'created_at', 'gender_probability'];
const VALID_ORDER = ['asc', 'desc'];

function validationError(res, message) {
  return res.status(422).json({ status: 'error', message });
}

router.get('/', async (req, res, next) => {
  try {
    const {
      gender,
      age_group,
      country_id,
      min_age,
      max_age,
      min_gender_probability,
      min_country_probability,
      sort_by = 'created_at',
      order = 'desc',
      page: rawPage = '1',
      limit: rawLimit = '10',
    } = req.query;

    // Validate sort
    if (!VALID_SORT_FIELDS.includes(sort_by)) {
      return validationError(res, `Invalid sort_by. Must be one of: ${VALID_SORT_FIELDS.join(', ')}`);
    }
    if (!VALID_ORDER.includes(order)) {
      return validationError(res, 'Invalid order. Must be asc or desc');
    }

    // Validate and parse pagination
    const page = parseInt(rawPage, 10);
    const limit = parseInt(rawLimit, 10);
    if (isNaN(page) || page < 1) return validationError(res, 'page must be a positive integer');
    if (isNaN(limit) || limit < 1) return validationError(res, 'limit must be a positive integer');
    if (limit > 50) return validationError(res, 'limit must not exceed 50');

    // Build where clause
    const where = {};

    if (gender !== undefined) {
      if (typeof gender !== 'string' || gender.trim() === '') {
        return validationError(res, 'Invalid gender');
      }
      where.gender = { equals: gender.toLowerCase(), mode: 'insensitive' };
    }

    if (age_group !== undefined) {
      if (typeof age_group !== 'string' || age_group.trim() === '') {
        return validationError(res, 'Invalid age_group');
      }
      where.age_group = { equals: age_group.toLowerCase(), mode: 'insensitive' };
    }

    if (country_id !== undefined) {
      if (typeof country_id !== 'string' || country_id.trim() === '') {
        return validationError(res, 'Invalid country_id');
      }
      where.country_id = { equals: country_id.toUpperCase(), mode: 'insensitive' };
    }

    if (min_age !== undefined) {
      const v = parseInt(min_age, 10);
      if (isNaN(v)) return validationError(res, 'min_age must be an integer');
      where.age = { ...where.age, gte: v };
    }

    if (max_age !== undefined) {
      const v = parseInt(max_age, 10);
      if (isNaN(v)) return validationError(res, 'max_age must be an integer');
      where.age = { ...where.age, lte: v };
    }

    if (min_gender_probability !== undefined) {
      const v = parseFloat(min_gender_probability);
      if (isNaN(v)) return validationError(res, 'min_gender_probability must be a number');
      where.gender_probability = { gte: v };
    }

    if (min_country_probability !== undefined) {
      const v = parseFloat(min_country_probability);
      if (isNaN(v)) return validationError(res, 'min_country_probability must be a number');
      where.country_probability = { gte: v };
    }

    const skip = (page - 1) * limit;

    const [total, profiles] = await Promise.all([
      prisma.profile.count({ where }),
      prisma.profile.findMany({
        where,
        orderBy: { [sort_by]: order },
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
