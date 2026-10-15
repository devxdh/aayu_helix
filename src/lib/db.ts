/**
 * SQLite Database Engine for Triage.
 *
 * Built with `better-sqlite3` - the fastest, zero-latency synchronous SQLite engine for Node.js.
 * Benefits:
 * - In-process execution with 0ms network latency.
 * - Single persistent file (`data/triage.db`) with zero external database dependencies.
 * - Atomic Write-Ahead Logging (WAL) for high concurrency and crash resilience.
 * - Automatic schema migration and seed initialization on application boot.
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { Patient, AuditEntry, TriageInput } from '@/types/triage';
import { evaluateTriage } from './triage';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'triage.db');

let dbInstance: Database.Database | null = null;

export const SEED_PATIENTS_DATA = [
  {
    tokenNumber: '87',
    name: 'Ramprasad Sharma',
    age: 60,
    gender: 'MALE' as const,
    complaint: 'Tightness in chest, severe sweating',
    vitals: { systolicBp: 155, diastolicBp: 95, pulse: 112, spo2: 93, temperature: 98.4 },
    minutesAgo: 4,
    staffBadge: 'TO-108 (Triage Officer Dr. Mathur)',
  },
  {
    tokenNumber: '102',
    name: 'Savitri Bai',
    age: 52,
    gender: 'FEMALE' as const,
    complaint: 'chhati me dard aur saas lene me bahut dikkat',
    vitals: { systolicBp: 160, diastolicBp: 98, pulse: 124, spo2: 86, temperature: 99.1 },
    minutesAgo: 6,
    staffBadge: 'SN-402 (Staff Nurse Sunita)',
  },
  {
    tokenNumber: '114',
    name: 'Gopal Lal',
    age: 58,
    gender: 'MALE' as const,
    complaint: 'Severe occipital headache, epistaxis and blurred vision',
    vitals: { systolicBp: 218, diastolicBp: 122, pulse: 92, spo2: 97, temperature: 98.6 },
    minutesAgo: 9,
    staffBadge: 'TO-108 (Triage Officer Dr. Mathur)',
  },
  {
    tokenNumber: '129',
    name: 'Mohammed Irfan',
    age: 19,
    gender: 'MALE' as const,
    complaint: 'Acute collapse following direct cricket ball impact to chest',
    vitals: { systolicBp: 88, diastolicBp: 54, pulse: 136, spo2: 91, temperature: 97.9 },
    minutesAgo: 2,
    staffBadge: 'SN-402 (Staff Nurse Sunita)',
  },
  {
    tokenNumber: '62',
    name: 'Kamla Devi',
    age: 62,
    gender: 'FEMALE' as const,
    complaint: 'Chakkar and ghabrahat',
    vitals: {},
    minutesAgo: 16,
    staffBadge: 'SN-402 (Staff Nurse Sunita)',
  },
  {
    tokenNumber: '54',
    name: 'Rajesh Bishnoi',
    age: 45,
    gender: 'MALE' as const,
    complaint: 'Pet dard and vomiting for 2 days',
    vitals: { systolicBp: 138, diastolicBp: 88, pulse: 108, spo2: 97, temperature: 100.2 },
    minutesAgo: 14,
    staffBadge: 'SN-402 (Staff Nurse Sunita)',
  },
  {
    tokenNumber: '71',
    name: 'Sunita Gurjar',
    age: 29,
    gender: 'FEMALE' as const,
    complaint: 'High grade pyrexia, chills and severe body ache for 3 days',
    vitals: { systolicBp: 110, diastolicBp: 70, pulse: 116, spo2: 96, temperature: 102.8 },
    minutesAgo: 19,
    staffBadge: 'DA-014 (Desk Assistant Ramesh)',
  },
  {
    tokenNumber: '77',
    name: 'Master Aarav',
    age: 4,
    gender: 'MALE' as const,
    complaint: 'Continuous barking stridor cough and respiratory distress',
    vitals: { pulse: 138, spo2: 92, temperature: 101.4 },
    minutesAgo: 21,
    staffBadge: 'SN-402 (Staff Nurse Sunita)',
  },
  {
    tokenNumber: '83',
    name: 'Rameshwar Prasad',
    age: 68,
    gender: 'MALE' as const,
    complaint: 'Severe chronic osteoarthritis knee pain flare-up',
    vitals: { systolicBp: 178, diastolicBp: 102, pulse: 76, spo2: 96, temperature: 98.2 },
    minutesAgo: 24,
    staffBadge: 'DA-014 (Desk Assistant Ramesh)',
  },
  {
    tokenNumber: '23',
    name: 'Priya Verma',
    age: 24,
    gender: 'FEMALE' as const,
    complaint: 'Routine thyroid refill follow-up',
    vitals: { systolicBp: 118, diastolicBp: 76, pulse: 72, spo2: 99, temperature: 98.2 },
    minutesAgo: 38,
    staffBadge: 'DA-014 (Desk Assistant Ramesh)',
  },
  {
    tokenNumber: '31',
    name: 'Dr. Anil Vyas (Retd)',
    age: 70,
    gender: 'MALE' as const,
    complaint: 'Routine follow up for lipid profile review',
    vitals: { systolicBp: 124, diastolicBp: 80, pulse: 68, spo2: 98, temperature: 98.0 },
    minutesAgo: 32,
    staffBadge: 'DA-014 (Desk Assistant Ramesh)',
  },
  {
    tokenNumber: '42',
    name: 'Manju Choudhary',
    age: 38,
    gender: 'FEMALE' as const,
    complaint: 'Mild generalized weakness and seasonal sneezing',
    vitals: { systolicBp: 120, diastolicBp: 78, pulse: 74, spo2: 99, temperature: 98.6 },
    minutesAgo: 29,
    staffBadge: 'DA-014 (Desk Assistant Ramesh)',
  },
  {
    tokenNumber: '91',
    name: 'Manish Soni',
    age: 31,
    gender: 'MALE' as const,
    complaint: 'Dressing change and stitch removal post-biopsy',
    vitals: { pulse: 74, spo2: 98 },
    minutesAgo: 11,
    staffBadge: 'DA-014 (Desk Assistant Ramesh)',
  },
  {
    tokenNumber: '95',
    name: 'Geeta Meena',
    age: 26,
    gender: 'FEMALE' as const,
    complaint: 'Second trimester routine calcium & iron refill',
    vitals: { systolicBp: 112, diastolicBp: 72, pulse: 80, spo2: 99, temperature: 98.4 },
    minutesAgo: 7,
    staffBadge: 'DA-014 (Desk Assistant Ramesh)',
  },
];

/**
 * Ensures data directory exists and returns the singleton better-sqlite3 instance.
 */
export function getDb(): Database.Database {
  if (!dbInstance) {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    dbInstance = new Database(DB_PATH);

    // High performance and safety pragmas
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('synchronous = NORMAL');
    dbInstance.pragma('foreign_keys = ON');
    dbInstance.pragma('busy_timeout = 5000');
  }

  return dbInstance;
}

export function isSqliteConfigured(): boolean {
  return true;
}

// Backward compatibility alias
export const isPostgresConfigured = isSqliteConfigured;

interface PatientRow {
  id: string;
  token_number: string;
  patient_name: string;
  age: number;
  gender: string;
  chief_complaint: string;
  vitals: string;
  system_priority: string;
  current_priority: string;
  clinical_rationale: string;
  matched_rules: string;
  is_fail_safe_escalation: number;
  is_overridden: number;
  override_reason: string | null;
  overridden_by: string | null;
  overridden_at: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface AuditRow {
  id: string;
  audit_sequence: number;
  timestamp: string;
  token_number: string;
  patient_id: string;
  patient_name: string;
  event_type: string;
  old_priority: string | null;
  new_priority: string;
  justification: string;
  staff_badge: string;
}

/**
 * Initializes SQLite schema, tables, indexes, and seeds initial dataset if empty.
 */
export function initializeDatabase(): boolean {
  try {
    const db = getDb();

    // 1. Create Patients Table
    db.exec(`
      CREATE TABLE IF NOT EXISTS patients (
        id TEXT PRIMARY KEY,
        token_number TEXT NOT NULL UNIQUE,
        patient_name TEXT NOT NULL,
        age INTEGER NOT NULL,
        gender TEXT NOT NULL,
        chief_complaint TEXT NOT NULL,
        vitals TEXT NOT NULL DEFAULT '{}',
        system_priority TEXT NOT NULL,
        current_priority TEXT NOT NULL,
        clinical_rationale TEXT NOT NULL,
        matched_rules TEXT NOT NULL DEFAULT '[]',
        is_fail_safe_escalation INTEGER NOT NULL DEFAULT 0,
        is_overridden INTEGER NOT NULL DEFAULT 0,
        override_reason TEXT,
        overridden_by TEXT,
        overridden_at TEXT,
        status TEXT NOT NULL DEFAULT 'WAITING',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // 2. Create Audit Logs Table
    db.exec(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        audit_sequence INTEGER NOT NULL,
        timestamp TEXT NOT NULL DEFAULT (datetime('now')),
        token_number TEXT NOT NULL,
        patient_id TEXT NOT NULL,
        patient_name TEXT NOT NULL,
        event_type TEXT NOT NULL,
        old_priority TEXT,
        new_priority TEXT NOT NULL,
        justification TEXT NOT NULL,
        staff_badge TEXT NOT NULL
      );
    `);

    // 3. Performance Indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_patients_status_priority ON patients(status, current_priority);
      CREATE INDEX IF NOT EXISTS idx_patients_created_at ON patients(created_at);
      CREATE INDEX IF NOT EXISTS idx_patients_token ON patients(token_number);
      CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp DESC);
    `);

    // 4. Seed if empty
    const countRow = db.prepare('SELECT COUNT(*) as count FROM patients').get() as { count: number };
    if (countRow.count === 0) {
      seedDatabase(false);
    }

    return true;
  } catch (err) {
    console.warn('[SQLite] Initialization warning:', err);
    return false;
  }
}

/**
 * Seeds default clinical scenario patients and immutable audit trail.
 */
export function seedDatabase(force: boolean = false): boolean {
  try {
    const db = getDb();

    if (force) {
      db.prepare('DELETE FROM audit_logs').run();
      db.prepare('DELETE FROM patients').run();
    }

    const countRow = db.prepare('SELECT COUNT(*) as count FROM patients').get() as { count: number };
    if (countRow.count > 0 && !force) {
      return true;
    }

    const insertPatient = db.prepare(`
      INSERT OR REPLACE INTO patients (
        id, token_number, patient_name, age, gender, chief_complaint, vitals,
        system_priority, current_priority, clinical_rationale, matched_rules,
        is_fail_safe_escalation, is_overridden, status, created_at, updated_at
      ) VALUES (
        @id, @token_number, @patient_name, @age, @gender, @chief_complaint, @vitals,
        @system_priority, @current_priority, @clinical_rationale, @matched_rules,
        @is_fail_safe_escalation, @is_overridden, @status, @created_at, @updated_at
      )
    `);

    const insertAudit = db.prepare(`
      INSERT OR REPLACE INTO audit_logs (
        id, audit_sequence, timestamp, token_number, patient_id, patient_name,
        event_type, old_priority, new_priority, justification, staff_badge
      ) VALUES (
        @id, @audit_sequence, @timestamp, @token_number, @patient_id, @patient_name,
        @event_type, @old_priority, @new_priority, @justification, @staff_badge
      )
    `);

    const baseTime = Date.now();
    let seq = 100;

    const seedTransaction = db.transaction(() => {
      for (const s of SEED_PATIENTS_DATA) {
        seq++;
        const arrivedTime = new Date(baseTime - s.minutesAgo * 60 * 1000).toISOString();
        const input: TriageInput = {
          patientName: s.name,
          age: s.age,
          gender: s.gender,
          chiefComplaint: s.complaint,
          vitals: s.vitals,
        };

        const triage = evaluateTriage(input, arrivedTime);
        const patientId = `pat-${s.tokenNumber}`;

        insertPatient.run({
          id: patientId,
          token_number: s.tokenNumber,
          patient_name: s.name,
          age: s.age,
          gender: s.gender,
          chief_complaint: s.complaint,
          vitals: JSON.stringify(s.vitals),
          system_priority: triage.priority,
          current_priority: triage.priority,
          clinical_rationale: triage.clinicalRationale,
          matched_rules: JSON.stringify(triage.matchedRules),
          is_fail_safe_escalation: triage.isFailSafeEscalation ? 1 : 0,
          is_overridden: 0,
          status: 'WAITING',
          created_at: arrivedTime,
          updated_at: arrivedTime,
        });

        insertAudit.run({
          id: `audit-${arrivedTime}-${seq}`,
          audit_sequence: seq,
          timestamp: arrivedTime,
          token_number: s.tokenNumber,
          patient_id: patientId,
          patient_name: s.name,
          event_type: 'TOKEN_ISSUED',
          old_priority: null,
          new_priority: triage.priority,
          justification: triage.clinicalRationale,
          staff_badge: s.staffBadge,
        });
      }
    });

    seedTransaction();
    return true;
  } catch (err) {
    console.error('[SQLite] Seed error:', err);
    return false;
  }
}

/**
 * Reads all patients from SQLite and parses JSON columns.
 */
export function getPatientsFromSqlite(): Patient[] {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM patients ORDER BY created_at ASC').all() as PatientRow[];

    return rows.map((r) => {
      let parsedVitals = {};
      try {
        parsedVitals = JSON.parse(r.vitals || '{}');
      } catch {
        parsedVitals = {};
      }

      let parsedRules: string[] = [];
      try {
        parsedRules = JSON.parse(r.matched_rules || '[]');
      } catch {
        parsedRules = [];
      }

      return {
        id: r.id,
        tokenNumber: r.token_number,
        patientName: r.patient_name,
        age: r.age,
        gender: r.gender as Patient['gender'],
        chiefComplaint: r.chief_complaint,
        vitals: parsedVitals,
        systemPriority: r.system_priority as Patient['systemPriority'],
        currentPriority: r.current_priority as Patient['currentPriority'],
        clinicalRationale: r.clinical_rationale,
        matchedRules: parsedRules,
        isFailSafeEscalation: Boolean(r.is_fail_safe_escalation),
        isOverridden: Boolean(r.is_overridden),
        overrideJustification: r.override_reason || undefined,
        overriddenBy: r.overridden_by || undefined,
        overriddenAt: r.overridden_at || undefined,
        status: r.status as Patient['status'],
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    });
  } catch (err) {
    console.warn('[SQLite] getPatientsFromSqlite error:', err);
    return [];
  }
}

/**
 * Reads all audit log entries from SQLite.
 */
export function getAuditLogsFromSqlite(): AuditEntry[] {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM audit_logs ORDER BY audit_sequence ASC').all() as AuditRow[];

    return rows.map((r) => ({
      id: r.id,
      auditSequence: r.audit_sequence,
      timestamp: r.timestamp,
      tokenNumber: r.token_number,
      patientId: r.patient_id,
      patientName: r.patient_name,
      eventType: r.event_type as AuditEntry['eventType'],
      oldPriority: (r.old_priority as AuditEntry['oldPriority']) || undefined,
      newPriority: r.new_priority as AuditEntry['newPriority'],
      justification: r.justification,
      staffBadge: r.staff_badge,
    }));
  } catch (err) {
    console.warn('[SQLite] getAuditLogsFromSqlite error:', err);
    return [];
  }
}

/**
 * Inserts or updates a patient record in SQLite.
 */
export function savePatientToSqlite(patient: Patient): void {
  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO patients (
        id, token_number, patient_name, age, gender, chief_complaint, vitals,
        system_priority, current_priority, clinical_rationale, matched_rules,
        is_fail_safe_escalation, is_overridden, override_reason, overridden_by,
        overridden_at, status, created_at, updated_at
      ) VALUES (
        @id, @token_number, @patient_name, @age, @gender, @chief_complaint, @vitals,
        @system_priority, @current_priority, @clinical_rationale, @matched_rules,
        @is_fail_safe_escalation, @is_overridden, @override_reason, @overridden_by,
        @overridden_at, @status, @created_at, @updated_at
      )
      ON CONFLICT(id) DO UPDATE SET
        current_priority = excluded.current_priority,
        is_overridden = excluded.is_overridden,
        override_reason = excluded.override_reason,
        overridden_by = excluded.overridden_by,
        overridden_at = excluded.overridden_at,
        status = excluded.status,
        updated_at = excluded.updated_at
    `).run({
      id: patient.id,
      token_number: patient.tokenNumber,
      patient_name: patient.patientName,
      age: patient.age,
      gender: patient.gender,
      chief_complaint: patient.chiefComplaint,
      vitals: JSON.stringify(patient.vitals),
      system_priority: patient.systemPriority,
      current_priority: patient.currentPriority,
      clinical_rationale: patient.clinicalRationale,
      matched_rules: JSON.stringify(patient.matchedRules),
      is_fail_safe_escalation: patient.isFailSafeEscalation ? 1 : 0,
      is_overridden: patient.isOverridden ? 1 : 0,
      override_reason: patient.overrideJustification || null,
      overridden_by: patient.overriddenBy || null,
      overridden_at: patient.overriddenAt || null,
      status: patient.status,
      created_at: patient.createdAt,
      updated_at: patient.updatedAt,
    });
  } catch (err) {
    console.warn('[SQLite] savePatientToSqlite warning:', err);
  }
}

/**
 * Updates priority override in SQLite.
 */
export function updateOverrideInSqlite(
  patientId: string,
  newPriority: string,
  justification: string,
  staffBadge: string,
  nowIso: string
): void {
  try {
    const db = getDb();
    db.prepare(`
      UPDATE patients
      SET current_priority = @newPriority,
          is_overridden = 1,
          override_reason = @justification,
          overridden_by = @staffBadge,
          overridden_at = @nowIso,
          updated_at = @nowIso
      WHERE id = @patientId
    `).run({
      patientId,
      newPriority,
      justification,
      staffBadge,
      nowIso,
    });
  } catch (err) {
    console.warn('[SQLite] updateOverrideInSqlite warning:', err);
  }
}

/**
 * Updates patient consultation status in SQLite.
 */
export function updateStatusInSqlite(patientId: string, status: string, nowIso: string): void {
  try {
    const db = getDb();
    db.prepare(`
      UPDATE patients
      SET status = @status,
          updated_at = @nowIso
      WHERE id = @patientId
    `).run({ patientId, status, nowIso });
  } catch (err) {
    console.warn('[SQLite] updateStatusInSqlite warning:', err);
  }
}

/**
 * Appends an audit log entry in SQLite.
 */
export function appendAuditLogToSqlite(entry: AuditEntry): void {
  try {
    const db = getDb();
    db.prepare(`
      INSERT OR REPLACE INTO audit_logs (
        id, audit_sequence, timestamp, token_number, patient_id, patient_name,
        event_type, old_priority, new_priority, justification, staff_badge
      ) VALUES (
        @id, @audit_sequence, @timestamp, @token_number, @patient_id, @patient_name,
        @event_type, @old_priority, @new_priority, @justification, @staff_badge
      )
    `).run({
      id: entry.id,
      audit_sequence: entry.auditSequence,
      timestamp: entry.timestamp,
      token_number: entry.tokenNumber,
      patient_id: entry.patientId,
      patient_name: entry.patientName,
      event_type: entry.eventType,
      old_priority: entry.oldPriority || null,
      new_priority: entry.newPriority,
      justification: entry.justification,
      staff_badge: entry.staffBadge,
    });
  } catch (err) {
    console.warn('[SQLite] appendAuditLogToSqlite warning:', err);
  }
}

/**
 * Health check diagnostics.
 */
export function checkDbHealth(): { status: string; latencyMs: number; engine: string } {
  try {
    const start = performance.now();
    const db = getDb();
    db.prepare('SELECT 1 as ping').get();
    const latencyMs = Number((performance.now() - start).toFixed(2));
    return { status: 'connected', latencyMs, engine: 'sqlite' };
  } catch (err) {
    return {
      status: `error: ${err instanceof Error ? err.message : 'failed'}`,
      latencyMs: -1,
      engine: 'sqlite',
    };
  }
}
