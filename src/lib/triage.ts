/**
 * Clinical Triage Rules Engine for High-Volume Outpatient Workflows.
 *
 * Implements deterministic clinical triage based on Emergency Triage protocols
 * (Manchester Triage System adapted for high-volume Indian Outpatient Departments).
 *
 * Safety Philosophy:
 * 1. Zero Diagnostic Speculation: Triage categorizes acuity and queue velocity, not diagnosis.
 * 2. Fail-Safe Escalation: When vitals are unrecorded or partially recorded, err strictly
 *    towards higher acuity to safeguard vulnerable and elderly patients.
 * 3. Transparent Explainability: Every decision produces a clinically verifiable rationale.
 */

import { TriageInput, TriageResult, Vitals } from '@/types/triage';

/** Keywords indicative of imminent life-threat or acute coronary/respiratory syndromes. */
const IMMEDIATE_SYMPTOM_PATTERNS = [
  'chest pain',
  'chest tightness',
  'tightness',
  'breathless',
  'shortness of breath',
  'unconscious',
  'collapse',
  'fainted',
  'unresponsive',
  'saas lene me dikkat',
  'chhati me dard',
  'chhati me jalan',
  'seene me dard',
  'chhati me dabav',
  'chhati me bhari pan',
];

/** Keywords indicative of loss of consciousness regardless of age. */
const UNCONSCIOUS_PATTERNS = [
  'unconscious',
  'collapse',
  'fainted',
  'unresponsive',
  'behoshi',
  'behosh',
];

/** Keywords indicative of acute distress requiring prompt physician evaluation. */
const SOON_ACUTE_PATTERNS = [
  'abdominal pain',
  'pet dard',
  'severe headache',
  'tez sar dard',
  'vomiting',
  'ulti',
  'dizziness',
  'chakkar',
  'fracture',
  'haddi tutna',
  'active bleeding',
  'khoon nikalna',
  'severe burn',
  'poisoning',
  'snake bite',
  'dog bite',
];

/** Non-specific systemic complaints requiring hemodynamic verification. */
const VAGUE_SYSTEMIC_PATTERNS = [
  'weakness',
  'kamzori',
  'ghabrahat',
  'uneasy',
  'bechaini',
  'lethargy',
  'malaise',
  'fatigue',
  'body ache',
];

/** Explicitly benign, low-acuity administrative or maintenance requests. */
const BENIGN_PATTERNS = [
  'refill',
  'routine follow up',
  'follow up',
  'follow-up',
  'report dikhana',
  'check reports',
  'rash',
  'khujli',
  'dressing change',
  'stitch removal',
  'certificate',
  'regular checkup',
];

/**
 * Checks whether an array of keyword phrases appears within a normalized text string.
 */
function matchesAnyPattern(text: string, patterns: string[]): string | null {
  const normalized = text.toLowerCase();
  for (const pattern of patterns) {
    if (normalized.includes(pattern)) {
      return pattern;
    }
  }
  return null;
}

/**
 * Detects cardiorespiratory presentations, including variations like "mild pain in chest",
 * "chest discomfort", "seene me dard", etc.
 */
function detectCardioRespiratoryPattern(text: string): string | null {
  const directMatch = matchesAnyPattern(text, IMMEDIATE_SYMPTOM_PATTERNS);
  if (directMatch) return directMatch;

  const norm = text.toLowerCase();
  const hasChestWord =
    norm.includes('chest') || norm.includes('chhati') || norm.includes('seene');
  const hasPainWord =
    norm.includes('pain') ||
    norm.includes('tight') ||
    norm.includes('press') ||
    norm.includes('dard') ||
    norm.includes('jalan') ||
    norm.includes('discomfort') ||
    norm.includes('heav') ||
    norm.includes('ache');

  if (hasChestWord && hasPainWord) {
    return 'chest pain/discomfort presentation';
  }

  return null;
}

/**
 * Validates whether all vital fields are absent or undefined.
 */
function areAllVitalsMissing(vitals: Vitals): boolean {
  return (
    vitals.systolicBp === undefined &&
    vitals.diastolicBp === undefined &&
    vitals.pulse === undefined &&
    vitals.spo2 === undefined &&
    vitals.temperature === undefined
  );
}

/**
 * Evaluates patient symptoms and physiological vitals to calculate a deterministic
 * triage priority level with factual clinical justification.
 *
 * Order of Evaluation:
 * 1. Immediate physiological compromise (Critical hypoxia, hemodynamic collapse, hypertensive crisis).
 * 2. Immediate presentation symptoms (High-risk acute coronary or respiratory syndrome if age > 35).
 * 3. Soon physiological instability (Sub-optimal SpO2, tachycardia/bradycardia, severe HTN, pyrexia).
 * 4. Soon acute distress symptoms (Abdominal pain, dizziness, severe pain, bleeding).
 * 5. Fail-safe missing vitals analysis (Elderly escalation, unverified systemic complaint escalation).
 * 6. Routine classification for benign complaints or stable physiology.
 *
 * @param input Patient demographic, complaint, and vitals snapshot.
 * @returns Deterministic TriageResult with priority, rationale, and matched rules.
 */
export function evaluateTriage(input: TriageInput, timestamp?: string): TriageResult {
  const { age, chiefComplaint, vitals } = input;
  const matchedRules: string[] = [];
  const normalizedComplaint = (chiefComplaint || '').trim().toLowerCase();
  const evaluatedAt = timestamp || '';

  // -------------------------------------------------------------------------
  // 1. TIER 1 EVALUATION: IMMEDIATE (RED)
  // -------------------------------------------------------------------------

  // 1a. SpO2 Critical Hypoxia (< 90%)
  if (vitals.spo2 !== undefined && vitals.spo2 < 90) {
    matchedRules.push(`Critical Hypoxia: SpO2 ${vitals.spo2}% (< 90%)`);
    return {
      priority: 'IMMEDIATE',
      clinicalRationale: `Critical Hypoxia: SpO2 ${vitals.spo2}% (< 90%). Imminent risk of respiratory failure; requires immediate resuscitation.`,
      matchedRules,
      isFailSafeEscalation: false,
      evaluatedAt,
    };
  }

  // 1b. Severe Hemodynamic Instability (Pulse > 130 bpm OR Pulse < 40 bpm)
  if (vitals.pulse !== undefined && (vitals.pulse > 130 || vitals.pulse < 40)) {
    matchedRules.push(`Severe Hemodynamic Instability: Pulse ${vitals.pulse} bpm (<40 or >130)`);
    return {
      priority: 'IMMEDIATE',
      clinicalRationale: `Severe Hemodynamic Instability: Pulse ${vitals.pulse} bpm (< 40 or > 130 bpm). Risk of cardiogenic shock or malignant arrhythmia.`,
      matchedRules,
      isFailSafeEscalation: false,
      evaluatedAt,
    };
  }

  // 1c. Hypertensive Crisis (Systolic BP > 200 mmHg)
  if (vitals.systolicBp !== undefined && vitals.systolicBp > 200) {
    matchedRules.push(`Hypertensive Crisis: SBP ${vitals.systolicBp} mmHg (> 200)`);
    return {
      priority: 'IMMEDIATE',
      clinicalRationale: `Hypertensive Crisis: Systolic BP ${vitals.systolicBp} mmHg (> 200 mmHg). High risk of acute end-organ damage or cerebrovascular accident.`,
      matchedRules,
      isFailSafeEscalation: false,
      evaluatedAt,
    };
  }

  // 1d. Unconscious / Collapse presentation (Absolute Immediate regardless of age)
  const unconsciousMatch = matchesAnyPattern(normalizedComplaint, UNCONSCIOUS_PATTERNS);
  if (unconsciousMatch) {
    matchedRules.push(`Altered Mental Status / Collapse: "${unconsciousMatch}"`);
    return {
      priority: 'IMMEDIATE',
      clinicalRationale: `Critical Presentation: Acute loss of consciousness or collapse ("${unconsciousMatch}"). Airway and neurological safety priority.`,
      matchedRules,
      isFailSafeEscalation: false,
      evaluatedAt,
    };
  }

  // 1e. High-Risk Acute Coronary / Respiratory Presentation
  // Symptoms containing chest pain/tightness, breathlessness, etc. -> if age > 35, prioritize IMMEDIATE
  const immediateSymptomMatch = detectCardioRespiratoryPattern(normalizedComplaint);
  if (immediateSymptomMatch) {
    if (age > 35) {
      matchedRules.push(
        `High-Risk Acute Coronary/Respiratory: "${immediateSymptomMatch}" in patient >35y (${age}y)`
      );
      return {
        priority: 'IMMEDIATE',
        clinicalRationale: `High-Risk Acute Coronary / Respiratory presentation ("${immediateSymptomMatch}" in ${age}-year-old). Immediate ECG and triage physician review mandatory.`,
        matchedRules,
        isFailSafeEscalation: false,
        evaluatedAt,
      };
    } else {
      // Younger patient with chest tightness / breathlessness -> Still escalated to SOON
      matchedRules.push(`Acute Cardiorespiratory Complaint: "${immediateSymptomMatch}" (age ${age}y <= 35)`);
      return {
        priority: 'SOON',
        clinicalRationale: `Acute Cardiorespiratory Complaint in Young Adult (age ${age}y). Requires urgent clinical assessment to rule out pleurisy, pneumothorax, or myocarditis.`,
        matchedRules,
        isFailSafeEscalation: false,
        evaluatedAt,
      };
    }
  }

// -------------------------------------------------------------------------
  // 2. PARTIAL / MISSING VITALS FAIL-SAFE CHECK (PRIORITY OVER ACUTE SYMPTOMS)
  // If vitals are completely absent, non-specific symptoms in elderly must
  // trigger explicit fail-safe escalation.
  // -------------------------------------------------------------------------
  const allVitalsMissing = areAllVitalsMissing(vitals);
  const vagueMatch = matchesAnyPattern(normalizedComplaint, [
    ...VAGUE_SYSTEMIC_PATTERNS,
    'chakkar',
    'dizziness',
  ]);
  const benignMatch = matchesAnyPattern(normalizedComplaint, BENIGN_PATTERNS);

  if (allVitalsMissing) {
    // Explicitly benign complaint with zero vitals -> ROUTINE
    if (benignMatch) {
      matchedRules.push(`Benign Outpatient Presentation: "${benignMatch}" with unrecorded vitals`);
      return {
        priority: 'ROUTINE',
        clinicalRationale: 'Clinically stable complaint; standard outpatient review.',
        matchedRules,
        isFailSafeEscalation: false,
        evaluatedAt,
      };
    }

    // Non-specific systemic complaints with zero vitals -> Fail-safe escalation
    if (vagueMatch) {
      if (age >= 55) {
        matchedRules.push(`Elderly Safety Escalation: Age ${age}y >= 55 with unrecorded vitals and "${vagueMatch}"`);
        return {
          priority: 'SOON',
          clinicalRationale:
            'Elderly patient (>=55y) with unrecorded vitals; auto-escalated for bedside assessment.',
          matchedRules,
          isFailSafeEscalation: true,
          evaluatedAt,
        };
      } else {
        matchedRules.push(
          `Safety Escalation: Unverified hemodynamics with systemic complaint "${vagueMatch}"`
        );
        return {
          priority: 'SOON',
          clinicalRationale:
            'Unverified hemodynamics with systemic complaint; safety-first escalation.',
          matchedRules,
          isFailSafeEscalation: true,
          evaluatedAt,
        };
      }
    }

    // Any other symptom in patient >= 55 with zero recorded vitals
    if (age >= 55) {
      matchedRules.push(`Elderly Safeguard: Age ${age}y >= 55 with unrecorded vitals`);
      return {
        priority: 'SOON',
        clinicalRationale:
          'Elderly patient (>=55y) with unrecorded vitals; auto-escalated for bedside assessment.',
        matchedRules,
        isFailSafeEscalation: true,
        evaluatedAt,
      };
    }
  }

  // -------------------------------------------------------------------------
  // 3. TIER 2 EVALUATION: SOON (YELLOW) - OBJECTIVE VITALS & ACUTE DISTRESS
  // -------------------------------------------------------------------------

  // 3a. Sub-optimal Oxygenation (SpO2 90%–94%)
  if (vitals.spo2 !== undefined && vitals.spo2 >= 90 && vitals.spo2 <= 94) {
    matchedRules.push(`Sub-optimal Oxygenation: SpO2 ${vitals.spo2}% (90-94%)`);
  }

  // 3b. Tachycardia / Marked Bradycardia (Pulse 105–130 bpm OR 45–50 bpm)
  if (
    vitals.pulse !== undefined &&
    ((vitals.pulse >= 105 && vitals.pulse <= 130) || (vitals.pulse >= 45 && vitals.pulse <= 50))
  ) {
    matchedRules.push(`Hemodynamic Derangement: Pulse ${vitals.pulse} bpm`);
  }

  // 3c. Severe Stage 2/3 Hypertension (Systolic BP 180–200 mmHg)
  if (vitals.systolicBp !== undefined && vitals.systolicBp >= 180 && vitals.systolicBp <= 200) {
    matchedRules.push(`Severe Hypertension: SBP ${vitals.systolicBp} mmHg (180-200)`);
  }

  // 3d. High-Grade Pyrexia (Temperature >= 101.5°F)
  if (vitals.temperature !== undefined && vitals.temperature >= 101.5) {
    matchedRules.push(`High-Grade Pyrexia: Temp ${vitals.temperature}°F (>= 101.5°F)`);
  }

  // 3e. Symptoms containing acute distress
  const acuteDistressMatch = matchesAnyPattern(normalizedComplaint, SOON_ACUTE_PATTERNS);
  if (acuteDistressMatch) {
    matchedRules.push(`Acute Distress Symptom: "${acuteDistressMatch}"`);
  }

  // If any of the SOON triggers fired from objective vitals or acute distress symptoms:
  if (matchedRules.length > 0) {
    const rationaleDetails = matchedRules.join('; ');
    return {
      priority: 'SOON',
      clinicalRationale: `Urgent Physiological/Clinical Presentation: ${rationaleDetails}. Requires physician review within 30 minutes.`,
      matchedRules,
      isFailSafeEscalation: false,
      evaluatedAt,
    };
  }


  // -------------------------------------------------------------------------
  // 4. TIER 3 EVALUATION: ROUTINE (GREEN)
  // -------------------------------------------------------------------------
  matchedRules.push('Normal physiology and low-acuity complaint');
  return {
    priority: 'ROUTINE',
    clinicalRationale:
      'Clinically stable complaint; standard outpatient review.',
    matchedRules,
    isFailSafeEscalation: false,
    evaluatedAt,
  };
}
