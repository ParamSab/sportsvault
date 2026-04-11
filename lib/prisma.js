import { PrismaClient } from '@prisma/client';

function buildPrismaClient() {
    const url = process.env.DATABASE_URL;

    // Supabase transaction pooler (port 6543) uses PgBouncer which doesn't support
    // prepared statements. Append pgbouncer=true to disable them.
    const datasourceUrl =
        url?.includes(':6543') && !url.includes('pgbouncer=true')
            ? url + (url.includes('?') ? '&' : '?') + 'pgbouncer=true'
            : url;

    return new PrismaClient({
        datasources: datasourceUrl ? { db: { url: datasourceUrl } } : undefined,
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });
}

const globalForPrisma = globalThis;
export const prisma = globalForPrisma.prisma ?? buildPrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
