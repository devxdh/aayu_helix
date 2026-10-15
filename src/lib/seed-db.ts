/**
 * SQLite Database Seed Script for Triage.
 *
 * Can be run stand-alone (`npx tsx src/lib/seed-db.ts`) or invoked automatically on server boot.
 * Executes:
 * 1. Schema DDL creation in data/triage.db
 * 2. Populates realistic clinical patient scenarios
 * 3. Seeds corresponding immutable audit log entries
 */

import { initializeDatabase, seedDatabase } from './db';

export function runSeed(force: boolean = false): boolean {
  initializeDatabase();
  return seedDatabase(force);
}

// Allow CLI execution: `npx tsx src/lib/seed-db.ts`
if (require.main === module) {
  try {
    const success = runSeed(true);
    if (success) {
      console.log('✅ SQLite schema & seed dataset successfully initialized in data/triage.db!');
      process.exit(0);
    } else {
      console.error('❌ Failed seeding SQLite.');
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Seed execution error:', err);
    process.exit(1);
  }
}
