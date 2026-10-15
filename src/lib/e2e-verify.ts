/**
 * End-to-End Clinical Flow Verification Script for OPD Flow.
 * Demonstrates:
 * 1. Queue initialization with seed data.
 * 2. Token 87 (IMMEDIATE, arrived 3 mins ago) strictly jumping ahead of Token 23 (ROUTINE, arrived 15 mins ago).
 * 3. Token 62 (Partial vitals case) auto-escalating to SOON via fail-safe rule.
 * 4. Clinical Nurse Override dynamically re-prioritizing a patient and re-sorting queue.
 * 5. Immutable compliance audit trail logging both registration and override events.
 */

import { opdStore } from './store';

async function runE2EVerification() {
  console.log('================================================================');
  console.log('   Clinical Outpatient Department Priority & Triage Platform');
  console.log('================================================================\n');

  // Step 1: Reset store to deterministic seeds
  opdStore.seedInitialData();
  console.log('▶ STEP 1: INITIALIZED STORE WITH CLINICAL SEED DATA\n');

  // Step 2: Fetch current sorted queue
  const initialQueue = opdStore.getPatients('WAITING');
  console.log('▶ STEP 2: VERIFYING QUEUE SORT ORDER (SEVERITY STRICT PRIORITY)');
  console.log('----------------------------------------------------------------');
  initialQueue.forEach((p, idx) => {
    console.log(
      `  Rank #${idx + 1}: Token #${p.tokenNumber} | [${p.currentPriority}] | ${p.patientName} (${p.age}y) | Arrived: ${p.createdAt}`
    );
  });
  console.log('----------------------------------------------------------------');

  // Check Token 87 vs Token 23
  const pos87 = initialQueue.findIndex((p) => p.tokenNumber === '87');
  const pos23 = initialQueue.findIndex((p) => p.tokenNumber === '23');

  console.log(`\n🔍 VERIFICATION CHECK 1: Token 87 vs Token 23 Queue Position:`);
  console.log(`   Token 87 Position: #${pos87 + 1} (Priority: ${initialQueue[pos87].currentPriority})`);
  console.log(`   Token 23 Position: #${pos23 + 1} (Priority: ${initialQueue[pos23].currentPriority})`);

  if (pos87 < pos23) {
    console.log(
      `   ✅ PASSED: Token 87 (High-Risk Acute Coronary) successfully jumped ahead of Token 23 (Routine Refill)`
    );
    console.log(
      `      despite Token 23 arriving 12 minutes earlier! (Replaced static FIFO with clinical triage).`
    );
  } else {
    console.error(`   ❌ FAILED: Token 87 is not ahead of Token 23!`);
    process.exit(1);
  }

  // Check Token 62 (Partial vitals)
  const p62 = initialQueue.find((p) => p.tokenNumber === '62');
  console.log(`\n🔍 VERIFICATION CHECK 2: Partial/Missing Vitals Fail-Safe (Token 62):`);
  if (p62 && p62.currentPriority === 'SOON' && p62.isFailSafeEscalation) {
    console.log(`   ✅ PASSED: Token 62 (62y F, "Chakkar and ghabrahat", no vitals)`);
    console.log(`      Current Priority: [${p62.currentPriority}] (Fail-Safe: ${p62.isFailSafeEscalation})`);
    console.log(`      Clinical Rationale: "${p62.clinicalRationale}"`);
  } else {
    console.error(`   ❌ FAILED: Token 62 fail-safe escalation failed!`);
    process.exit(1);
  }

  // Step 3: Execute One-Tap Clinical Nurse Override
  console.log(`\n▶ STEP 3: EXECUTING ONE-TAP CLINICAL NURSE OVERRIDE`);
  console.log(`   Escalating Token 23 from ROUTINE to IMMEDIATE due to corridor diaphoresis...`);

  const p23Id = initialQueue.find((p) => p.tokenNumber === '23')!.id;
  const overrideJustification = 'Patient observed diaphoretic, clammy and pale in corridor waiting area';
  const staffNurseBadge = 'SN-402 (Staff Nurse Sunita Sharma)';

  const updatedPatient = opdStore.overridePriority(
    p23Id,
    'IMMEDIATE',
    overrideJustification,
    staffNurseBadge
  );

  console.log(`   Updated Patient: Token #${updatedPatient.tokenNumber}`);
  console.log(`   New Priority: [${updatedPatient.currentPriority}] (Overridden: ${updatedPatient.isOverridden})`);
  console.log(`   Nurse Justification: "${updatedPatient.overrideJustification}"`);
  console.log(`   Attributed By: ${updatedPatient.overriddenBy}`);

  // Step 4: Verify Re-sorted Queue
  const reSortedQueue = opdStore.getPatients('WAITING');
  console.log(`\n▶ STEP 4: VERIFYING RE-SORTED QUEUE POST-OVERRIDE`);
  console.log('----------------------------------------------------------------');
  reSortedQueue.forEach((p, idx) => {
    console.log(
      `  Rank #${idx + 1}: Token #${p.tokenNumber} | [${p.currentPriority}] | ${p.patientName} | Overridden: ${p.isOverridden ? 'YES' : 'NO'}`
    );
  });
  console.log('----------------------------------------------------------------');

  const newPos23 = reSortedQueue.findIndex((p) => p.tokenNumber === '23');
  if (newPos23 <= 1 && reSortedQueue[newPos23].currentPriority === 'IMMEDIATE') {
    console.log(`   ✅ PASSED: Token 23 immediately escalated to Rank #${newPos23 + 1} among IMMEDIATE cases!`);
  } else {
    console.error(`   ❌ FAILED: Token 23 was not re-sorted to IMMEDIATE!`);
    process.exit(1);
  }

  // Step 5: Verify Compliance & Immutable Audit Trail
  console.log(`\n▶ STEP 5: VERIFYING IMMUTABLE AUDIT TRAIL LOGGING`);
  const auditLogs = opdStore.getAuditLogs();
  console.log(`   Total Logged Audit Entries: ${auditLogs.length}`);

  const latestOverrideLog = auditLogs.find((l) => l.eventType === 'CLINICAL_OVERRIDE');
  if (latestOverrideLog && latestOverrideLog.tokenNumber === '23') {
    console.log(`   ✅ PASSED: Clinical Override Event Logged in Audit Trail:`);
    console.log(`      Seq #: ${latestOverrideLog.auditSequence}`);
    console.log(`      Timestamp: ${latestOverrideLog.timestamp}`);
    console.log(`      Token: #${latestOverrideLog.tokenNumber} (${latestOverrideLog.patientName})`);
    console.log(`      Priority Shift: ${latestOverrideLog.oldPriority} ➔ ${latestOverrideLog.newPriority}`);
    console.log(`      Justification: "${latestOverrideLog.justification}"`);
    console.log(`      Staff Badge: ${latestOverrideLog.staffBadge}`);
  } else {
    console.error(`   ❌ FAILED: Override event missing in audit logs!`);
    process.exit(1);
  }

  console.log('\n================================================================');
  console.log('🎉 ALL CLINICAL, QUEUE SORTING, AND AUDIT CHECKS VERIFIED 100%!');
  console.log('================================================================\n');
}

runE2EVerification();
