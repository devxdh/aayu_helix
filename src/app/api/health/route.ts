import { NextResponse } from 'next/server';
import { checkDbHealth } from '@/lib/db';
import { opdStore } from '@/lib/store';

/**
 * GET /api/health
 * Production healthcheck endpoint for Docker, AWS ALB/ECS, or monitoring tools.
 */
export async function GET() {
  const timestamp = new Date().toISOString();
  const dbHealth = checkDbHealth();
  const queueSummary = opdStore.getQueueSummary();

  const isHealthy = dbHealth.status === 'connected';

  return NextResponse.json(
    {
      status: isHealthy ? 'healthy' : 'degraded',
      service: 'triage',
      version: '1.0.0',
      timestamp,
      environment: process.env.NODE_ENV || 'production',
      database: {
        engine: 'sqlite',
        status: dbHealth.status,
        latencyMs: dbHealth.latencyMs,
      },
      queue: {
        activeWaiting: queueSummary.totalWaiting,
        immediateCases: queueSummary.immediateCount,
      },
    },
    { status: isHealthy ? 200 : 503 }
  );
}
