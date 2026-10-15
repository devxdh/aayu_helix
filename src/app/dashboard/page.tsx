'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DEFAULT_STAFF_PROFILES, Patient, PriorityLevel, QueueSummary, StaffProfile } from '@/types/triage';
import { Header } from '@/components/Header';
import { NurseDashboard } from '@/components/NurseDashboard';

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenParam = searchParams.get('token');
  const [highlightedToken, setHighlightedToken] = useState<string | null>(tokenParam);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [summary, setSummary] = useState<QueueSummary>({
    totalWaiting: 0,
    immediateCount: 0,
    soonCount: 0,
    routineCount: 0,
    inConsultationCount: 0,
    completedCount: 0,
    overriddenCount: 0,
    averageWaitMinutes: 0,
  });
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>(DEFAULT_STAFF_PROFILES);
  const [activeStaff, setActiveStaff] = useState<StaffProfile>(DEFAULT_STAFF_PROFILES[0]);
  const [isPolling] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const queueEtagRef = React.useRef<string | null>(null);

  const fetchQueueData = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (queueEtagRef.current) {
        headers['If-None-Match'] = queueEtagRef.current;
      }

      const res = await fetch('/api/queue', {
        headers,
        cache: 'no-store',
      });

      if (res.status === 304) {
        return;
      }

      const etag = res.headers.get('ETag');
      if (etag) queueEtagRef.current = etag;

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setPatients(data.patients);
          setSummary(data.summary);
          if (data.staffProfiles?.length) setStaffProfiles(data.staffProfiles);
        }
      }
    } catch {
      // Quiet poll error
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueueData();

    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }
      fetchQueueData();
    }, 3000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchQueueData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchQueueData]);

  useEffect(() => {
    if (tokenParam) {
      setHighlightedToken(tokenParam);
    }
  }, [tokenParam]);

  const handleCommitOverride = async (
    patientId: string,
    newPriority: PriorityLevel,
    justification: string
  ) => {
    const res = await fetch(`/api/queue/${patientId}/override`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        newPriority,
        justification,
        staffBadge: `[${activeStaff.badgeNumber}] ${activeStaff.name}`,
      }),
    });

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to commit override');
    }

    if (data.patient?.tokenNumber) {
      setHighlightedToken(data.patient.tokenNumber);
    }

    await fetchQueueData();
  };

  const handleUpdateStatus = async (
    patientId: string,
    status: 'WAITING' | 'IN_CONSULTATION' | 'COMPLETED'
  ) => {
    const res = await fetch(`/api/queue/${patientId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status,
        staffBadge: `[${activeStaff.badgeNumber}] ${activeStaff.name}`,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.patient?.tokenNumber && status !== 'COMPLETED') {
        setHighlightedToken(data.patient.tokenNumber);
      }
      await fetchQueueData();
    }
  };

  const handleReset = async () => {
    if (confirm('Reset patient queue to initial demonstration state?')) {
      const res = await fetch('/api/reset', { method: 'POST' });
      if (res.ok) await fetchQueueData();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <Header
        activeTab="DASHBOARD"
        useLinks={true}
        staffProfiles={staffProfiles}
        activeStaff={activeStaff}
        onStaffChange={setActiveStaff}
        isPolling={isPolling}
        onManualRefresh={fetchQueueData}
        onResetSeedData={handleReset}
        waitingCount={summary.totalWaiting}
        immediateCount={summary.immediateCount}
      />
      <main className="flex-1 pb-16">
        {isLoading && patients.length === 0 ? (
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="flex flex-col items-center gap-3">
              <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-slate-500 font-mono">
                Loading live clinical queue...
              </span>
            </div>
          </div>
        ) : (
          <NurseDashboard
            patients={patients}
            summary={summary}
            activeStaff={activeStaff}
            highlightedToken={highlightedToken}
            onCommitOverride={handleCommitOverride}
            onUpdateStatus={handleUpdateStatus}
            onNavigateToRegister={() => router.push('/register')}
          />
        )}
      </main>
      <footer className="border-t border-slate-200 bg-white py-3 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2">
          <span>Dr. S.N. Medical College, Jodhpur • Nursing & Triage Workstation</span>
          <span className="font-mono text-[11px] text-slate-500">Aayu 2026 AI Medical Hackathon • Track 01</span>
        </div>
      </footer>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-slate-50">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
