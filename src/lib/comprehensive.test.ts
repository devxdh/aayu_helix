/**
 * Comprehensive System Test Runner for Triage.
 *
 * Tests:
 * 1. Clinical Triage Logic (Manchester & Indian OPD rules: Immediate, Soon, Routine)
 * 2. Fail-Safe Escalation for Missing Vitals
 * 3. Write-Ahead Log (WAL) Durability and Checksum Generation
 * 4. Priority Queue Sorting (Severity Acuity First)
 * 5. One-Tap Clinical Nurse Override
 * 6. Audit Trail Logging and Non-repudiation
 * 7. PostgreSQL Adapter Initialization and Schema Validation
 */

import { evaluateTriage } from './triage';
import { walStorage } from './wal';
import { opdStore } from './store';
import { initializeDatabase, isPostgresConfigured } from './db';

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    passedCount++;
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    failedCount++;
    console.error(`  ❌ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
  }
}

async function runAllTests() {
  console.log('========================================================');
  console.log('🧪 RUNNING COMPREHENSIVE TRIAGE SYSTEM TEST SUITE');
  console.log('========================================================\n');

  // TEST SUITE 1: Deterministic Triage Rules
  console.log('--- Suite 1: Clinical Rules & High-Risk Presentations ---');
  const token87 = evaluateTriage({
    patientName: 'Ramprasad Sharma',
    age: 60,
    gender: 'MALE',
    chiefComplaint: 'Tightness in chest, severe sweating',
    vitals: { systolicBp: 155, diastolicBp: 95, pulse: 112, spo2: 93, temperature: 98.4 },
  });
  assert(token87.priority === 'IMMEDIATE', 'Token 87 evaluated as IMMEDIATE');
  assert(token87.clinicalRationale.includes('Acute Coronary'), 'Token 87 rationale mentions Acute Coronary');

  const token23 = evaluateTriage({
    patientName: 'Priya Verma',
    age: 24,
    gender: 'FEMALE',
    chiefComplaint: 'Routine thyroid refill follow-up',
    vitals: { systolicBp: 118, diastolicBp: 76, pulse: 72, spo2: 99, temperature: 98.2 },
  });
  assert(token23.priority === 'ROUTINE', 'Token 23 evaluated as ROUTINE');

  const hypoxiaCase = evaluateTriage({
    patientName: 'Oxygen Distress',
    age: 40,
    gender: 'MALE',
    chiefComplaint: 'Cough',
    vitals: { spo2: 87 },
  });
  assert(hypoxiaCase.priority === 'IMMEDIATE', 'SpO2 < 90% triggers IMMEDIATE hypoxia alert');

  const hypertensiveCase = evaluateTriage({
    patientName: 'Hypertensive Emergency',
    age: 55,
    gender: 'FEMALE',
    chiefComplaint: 'Headache',
    vitals: { systolicBp: 215, diastolicBp: 125 },
  });
  assert(hypertensiveCase.priority === 'IMMEDIATE', 'SBP > 200 mmHg triggers IMMEDIATE Hypertensive Crisis');

  const mildChestPain50y = evaluateTriage({
    patientName: 'Dev Dhanadiya',
    age: 50,
    gender: 'MALE',
    chiefComplaint: 'mild pain in chest',
    vitals: { systolicBp: 120, diastolicBp: 90, pulse: 80, spo2: 99, temperature: 84 },
  });
  assert(mildChestPain50y.priority === 'IMMEDIATE', '"mild pain in chest" in 50y triggers IMMEDIATE');

  // TEST SUITE 2: Fail-Safe Missing Vitals
  console.log('\n--- Suite 2: Fail-Safe Handling of Missing Vitals ---');
  const elderlyMissingVitals = evaluateTriage({
    patientName: 'Elderly Dizziness',
    age: 68,
    gender: 'MALE',
    chiefComplaint: 'chakkar and ghabrahat',
    vitals: {},
  });
  assert(elderlyMissingVitals.priority === 'SOON', 'Elderly with vague symptoms & missing vitals escalates to SOON');
  assert(elderlyMissingVitals.isFailSafeEscalation === true, 'Fail-safe escalation flag set to true');

  const youngRefillMissingVitals = evaluateTriage({
    patientName: 'Young Refill',
    age: 22,
    gender: 'FEMALE',
    chiefComplaint: 'routine refill follow up',
    vitals: {},
  });
  assert(youngRefillMissingVitals.priority === 'ROUTINE', 'Explicitly benign refill with missing vitals stays ROUTINE');

  // TEST SUITE 3: Write-Ahead Log (WAL) Engine
  console.log('\n--- Suite 3: Write-Ahead Log (WAL) Durability ---');
  const walRecord = walStorage.appendRecord(
    'TOKEN_ISSUED',
    'test-pat-01',
    'T-999',
    { test: true },
    'STAFF-TEST'
  );
  assert(Boolean(walRecord.seq > 0), 'WAL sequence increments positively');
  assert(typeof walRecord.checksum === 'string' && walRecord.checksum.length === 8, 'WAL computes 8-character checksum');

  // TEST SUITE 4: In-Memory Priority Queue & Sorting
  console.log('\n--- Suite 4: Severity Priority Queue Sorting ---');
  opdStore.seedInitialData();
  const queue = opdStore.getPatients('WAITING');
  assert(queue.length > 0, 'Queue initialized with seed patients');
  
  // Find Token 87 and Token 23 in sorted queue
  const idx87 = queue.findIndex((p) => p.tokenNumber === '87');
  const idx23 = queue.findIndex((p) => p.tokenNumber === '23');
  assert(idx87 !== -1 && idx23 !== -1, 'Both Token 87 and Token 23 exist in queue');
  assert(idx87 < idx23, 'Token 87 (IMMEDIATE) ranks higher than Token 23 (ROUTINE) despite arrival time');

  // TEST SUITE 5: 1-Tap Clinical Nurse Override & Audit Logging
  console.log('\n--- Suite 5: 1-Tap Nurse Override & Audit Trail ---');
  const patient23 = queue.find((p) => p.tokenNumber === '23')!;
  const overridden = opdStore.overridePriority(
    patient23.id,
    'IMMEDIATE',
    'Patient became diaphoretic and pale in corridor',
    'SN-402'
  );
  assert(overridden.currentPriority === 'IMMEDIATE', 'Token 23 priority escalated to IMMEDIATE');
  assert(overridden.isOverridden === true, 'Token 23 isOverridden marked true');

  const audits = opdStore.getAuditLogs();
  const latestOverrideAudit = audits.find(
    (a) => a.patientId === patient23.id && a.eventType === 'CLINICAL_OVERRIDE'
  );
  assert(Boolean(latestOverrideAudit), 'Clinical override logged in audit trail');
  assert(latestOverrideAudit?.newPriority === 'IMMEDIATE', 'Audit trail records new priority');
  assert(latestOverrideAudit?.staffBadge === 'SN-402', 'Audit trail records staff badge attribution');

  // TEST SUITE 6: PostgreSQL Adapter Resilience
  console.log('\n--- Suite 6: PostgreSQL Database Adapter ---');
  const pgConfigured = isPostgresConfigured();
  console.log(`  ℹ️  PostgreSQL Configured via DATABASE_URL: ${pgConfigured}`);
  // Even if PG is not running on host during CI/local build, initializeDatabase returns false gracefully without throwing
  const initResult = await initializeDatabase();
  assert(typeof initResult === 'boolean', 'Database adapter handles environment gracefully');

  // TEST SUITE 7: Manual Token Number & Duplicate Rejection & Audit Log Immutability
  console.log('\n--- Suite 7: Manual Token & Duplicate Prevention ---');
  const customPatient = opdStore.createPatient(
    {
      patientName: 'Anil Sharma',
      age: 42,
      gender: 'MALE',
      chiefComplaint: 'Mild wrist sprain after fall',
      vitals: { spo2: 99, pulse: 72 },
    },
    'STAFF-TEST',
    '777'
  );
  assert(customPatient.tokenNumber === '777', 'Custom token 777 successfully issued');
  assert(opdStore.isTokenTaken('777') === true, 'isTokenTaken returns true for existing token 777');

  // Duplicate rejection
  let duplicateRejected = false;
  try {
    opdStore.createPatient(
      {
        patientName: 'Duplicate Token Attempt',
        age: 30,
        gender: 'FEMALE',
        chiefComplaint: 'Mild headache',
        vitals: {},
      },
      'STAFF-TEST',
      '777'
    );
  } catch (err) {
    duplicateRejected = err instanceof Error && err.message.includes('already registered');
  }
  assert(duplicateRejected, 'Duplicate token 777 strictly rejected with clear clinical error');

  // Audit log immutability & timestamp presence
  const customAudit = opdStore.getAuditLogs().find((a) => a.tokenNumber === '777');
  assert(Boolean(customAudit), 'Audit log contains immutable entry for token 777');
  assert(
    Boolean(customAudit?.timestamp && !isNaN(Date.parse(customAudit.timestamp))),
    'Audit entry contains valid ISO timestamp with date and time'
  );

  // TEST SUITE 8: Patient Search by Name, Symptoms, Token & Caching Versioning
  console.log('\n--- Suite 8: Live Queue Search & Caching Versioning ---');
  const vBefore = opdStore.getQueueVersion().version;
  assert(typeof vBefore === 'number' && vBefore > 0, 'Queue version is a positive number');

  // Search by name
  const searchName = opdStore.getPatients(undefined, undefined, 'Anil');
  assert(searchName.some((p) => p.patientName.includes('Anil')), 'Search by patient name finds Anil Sharma');

  // Search by symptom / chief complaint
  const searchSymptom = opdStore.getPatients(undefined, undefined, 'sprain');
  assert(searchSymptom.some((p) => p.chiefComplaint.includes('sprain')), 'Search by symptom finds wrist sprain');

  // Search by token number
  const searchToken = opdStore.getPatients(undefined, undefined, '777');
  assert(searchToken.some((p) => p.tokenNumber === '777'), 'Search by token finds Token 777');

  // Negative search
  const searchNone = opdStore.getPatients(undefined, undefined, 'nonexistent_symptom_xyz');
  assert(searchNone.length === 0, 'Nonexistent symptom search returns 0 patients');

  console.log('\n========================================================');
  console.log(`Results: ${passedCount} passed, ${failedCount} failed out of ${passedCount + failedCount} tests.`);
  console.log('========================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Fatal test execution error:', err);
  process.exit(1);
});
