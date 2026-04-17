// Prisma client singleton.
// On Vercel each serverless invocation may reuse the same Node process, so
// we cache the client on globalThis to avoid opening a new connection pool
// on every function call.

const { PrismaClient } = require('@prisma/client');

const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.__prisma__ ||
  new PrismaClient({
    log: ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__prisma__ = prisma;
}

module.exports = prisma;
