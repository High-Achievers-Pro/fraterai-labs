import { NextResponse } from 'next/server';
import { getPortalSummary } from '@/lib/server/summary';

// proxy.ts already guards /api/portal/* (see repo-root proxy.ts matcher),
// so this route needs no auth check of its own.
export const GET = async () => NextResponse.json(await getPortalSummary());
