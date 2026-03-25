import { PrismaClient } from '@prisma/client';

function buildPrismaClient() {
    const url = process.env.DATABASE_URL;
    // Supabase connection pooler (port 6543) uses PgBouncer in transaction mode.
    // Prisma's prepared statements conflict with it, causing "prepared statement already exists".
    // Fix: append pgbouncer=true to disable prepared statements when using the pooler.
    if (url?.includes(':6543') && !url.includes('pgbouncer=true')) {
        const separator = url.includes('?') ? '&' : '?';
        return new PrismaClient({
            datasources: { db: { url: url + separator + 'pgbouncer=true' } }
        });
    }
    return new PrismaClient();
}

const globalForPrisma = globalThis;
export const prisma = globalForPrisma.prisma ?? buildPrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
