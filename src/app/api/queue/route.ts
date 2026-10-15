import { NextResponse } from 'next/server';
import { opdStore, DEFAULT_STAFF_PROFILES } from '@/lib/store';
import { PatientStatus, TriageInput } from '@/types/triage';


/**
 * GET /api/queue
 * Returns active patient queue sorted strictly by triage severity, then arrival time.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status') as PatientStatus | null;
    const dateParam = searchParams.get('date'); // Format: YYYY-MM-DD
    const searchParam = searchParams.get('search'); // Name, symptom, or token query

    const { version, lastModified } = opdStore.getQueueVersion();
    const etag = `"${version}-${statusParam || 'all'}-${dateParam || 'all'}-${searchParam || 'none'}"`;
    const clientEtag = request.headers.get('if-none-match');

    if (clientEtag === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          'ETag': etag,
          'Cache-Control': 'no-cache, must-revalidate',
          'Last-Modified': new Date(lastModified).toUTCString(),
        },
      });
    }

    const patients = opdStore.getPatients(
      statusParam || undefined,
      dateParam || undefined,
      searchParam || undefined
    );
    const summary = opdStore.getQueueSummary();

    return NextResponse.json(
      {
        success: true,
        patients,
        summary,
        staffProfiles: DEFAULT_STAFF_PROFILES,
        version,
      },
      {
        headers: {
          'ETag': etag,
          'Cache-Control': 'no-cache, must-revalidate',
          'Last-Modified': new Date(lastModified).toUTCString(),
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch queue';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * POST /api/queue
 * Registers a new patient token and executes deterministic triage.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { patientName, age, gender, chiefComplaint, vitals, staffBadge, tokenNumber } = body;

    if (!patientName || typeof patientName !== 'string' || patientName.trim() === '') {
      return NextResponse.json({ success: false, error: 'Patient Name is required.' }, { status: 400 });
    }

    if (age === undefined || typeof age !== 'number' || age < 0 || age > 130) {
      return NextResponse.json({ success: false, error: 'Valid age (0-130) is required.' }, { status: 400 });
    }

    if (!gender || !['MALE', 'FEMALE', 'OTHER'].includes(gender)) {
      return NextResponse.json({ success: false, error: 'Valid gender is required.' }, { status: 400 });
    }

    if (!chiefComplaint || typeof chiefComplaint !== 'string' || chiefComplaint.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Chief complaint is required.' },
        { status: 400 }
      );
    }

    const triageInput: TriageInput = {
      patientName: patientName.trim(),
      age: Math.round(age),
      gender,
      chiefComplaint: chiefComplaint.trim(),
      vitals: vitals || {},
    };

    const effectiveBadge = (staffBadge && typeof staffBadge === 'string' && staffBadge.trim()) || 'Desk Assistant (General)';

    if (tokenNumber !== undefined && tokenNumber !== null && String(tokenNumber).trim() !== '') {
      const candidateToken = String(tokenNumber).trim();
      if (opdStore.isTokenTaken(candidateToken)) {
        return NextResponse.json(
          {
            success: false,
            error: `Token #${candidateToken} is already registered. Please choose an unused token number or leave blank to auto-generate.`,
          },
          { status: 409 }
        );
      }
    }

    const patient = opdStore.createPatient(
      triageInput,
      effectiveBadge,
      tokenNumber ? String(tokenNumber).trim() : undefined
    );

    return NextResponse.json({
      success: true,
      patient,
      message: `Token #${patient.tokenNumber} successfully triaged as [${patient.currentPriority}]`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to register patient';
    const isConflict = message.includes('already registered');
    return NextResponse.json({ success: false, error: message }, { status: isConflict ? 409 : 500 });
  }
}
