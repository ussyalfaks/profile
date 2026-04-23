const express = require('express');
const cors = require('cors');
const { uuidv7 } = require('uuidv7');
const prisma = require('./prisma');
const { enrichName, UpstreamError } = require('./enrichment');
const { formatProfile } = require('./formatter');
const profilesRouter = require('./routes/profiles');
const searchRouter = require('./routes/search');

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

// Health check
app.get('/', (_req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Profile Intelligence Service is running',
    endpoints: {
      create: 'POST /api/profiles',
      list: 'GET /api/profiles',
      search: 'GET /api/profiles/search',
      get: 'GET /api/profiles/:id',
      delete: 'DELETE /api/profiles/:id',
    },
  });
});

// ---------- POST /api/profiles ----------
app.post('/api/profiles', async (req, res, next) => {
  try {
    const body = req.body || {};

    if ('name' in body && typeof body.name !== 'string') {
      return res.status(422).json({
        status: 'error',
        message: 'Invalid type: name must be a string',
      });
    }

    const rawName = body.name;
    if (rawName === undefined || rawName === null || rawName.trim() === '') {
      return res.status(400).json({
        status: 'error',
        message: 'Name is required and cannot be empty',
      });
    }

    const name = rawName.trim().toLowerCase();
    const existing = await prisma.profile.findUnique({ where: { name } });
    if (existing) {
      return res.status(200).json({
        status: 'success',
        message: 'Profile already exists',
        data: formatProfile(existing),
      });
    }

    const enriched = await enrichName(name);

    let profile;
    try {
      profile = await prisma.profile.create({
        data: { id: uuidv7(), name, ...enriched },
      });
    } catch (err) {
      if (err.code === 'P2002') {
        const winner = await prisma.profile.findUnique({ where: { name } });
        return res.status(200).json({
          status: 'success',
          message: 'Profile already exists',
          data: formatProfile(winner),
        });
      }
      throw err;
    }

    return res.status(201).json({
      status: 'success',
      data: formatProfile(profile),
    });
  } catch (err) {
    if (err instanceof UpstreamError) {
      return res.status(502).json({
        status: '502',
        message: `${err.apiName} returned an invalid response`,
      });
    }
    next(err);
  }
});

// IMPORTANT: /search must be mounted before /:id to prevent Express
// matching "search" as a UUID parameter.
app.use('/api/profiles/search', searchRouter);
app.use('/api/profiles', profilesRouter);

// ---------- GET /api/profiles/:id ----------
app.get('/api/profiles/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!UUID_REGEX.test(id)) {
      return res.status(404).json({ status: 'error', message: 'Profile not found' });
    }

    const profile = await prisma.profile.findUnique({ where: { id } });
    if (!profile) {
      return res.status(404).json({ status: 'error', message: 'Profile not found' });
    }

    return res.status(200).json({ status: 'success', data: formatProfile(profile) });
  } catch (err) {
    next(err);
  }
});

// ---------- DELETE /api/profiles/:id ----------
app.delete('/api/profiles/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!UUID_REGEX.test(id)) {
      return res.status(404).json({ status: 'error', message: 'Profile not found' });
    }

    try {
      await prisma.profile.delete({ where: { id } });
    } catch (err) {
      if (err.code === 'P2025') {
        return res.status(404).json({ status: 'error', message: 'Profile not found' });
      }
      throw err;
    }

    return res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// Malformed JSON
app.use((err, _req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ status: 'error', message: 'Invalid JSON body' });
  }
  next(err);
});

// 404
app.use((_req, res) => {
  res.status(404).json({ status: 'error', message: 'Route not found' });
});

// Global error handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ status: 'error', message: 'Internal server error' });
});

module.exports = app;
