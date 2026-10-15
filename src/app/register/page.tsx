'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { DEFAULT_STAFF_PROFILES, QueueSummary, StaffProfile } from '@/types/triage';
import { Header } from '@/components/Header';
import { RegistrationDesk } from '@/components/RegistrationDesk';

export default function RegisterPage() {
  const router = useRouter();
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

  const fetchQueueSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/queue', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setSummary(data.summary);
          if (data.staffProfiles?.length) setStaffProfiles(data.staffProfiles);
        }
      }
    } catch {
      // Quiet poll error
    }
  }, []);

  useEffect(() => {
    fetchQueueSummary();
    const interval = setInterval(fetchQueueSummary, 2000);
    return () => clearInterval(interval);
  }, [fetchQueueSummary]);

  const handleReset = async () => {
    if (confirm('Reset patient queue to initial demonstration state?')) {
      const res = await fetch('/api/reset', { method: 'POST' });
      if (res.ok) await fetchQueueSummary();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <Header
        activeTab="REGISTER"
        useLinks={true}
        staffProfiles={staffProfiles}
        activeStaff={activeStaff}
        onStaffChange={setActiveStaff}
        isPolling={true}
        onManualRefresh={fetchQueueSummary}
        onResetSeedData={handleReset}
        waitingCount={summary.totalWaiting}
        immediateCount={summary.immediateCount}
      />
      <main className="flex-1 pb-16">
        <RegistrationDesk
          activeStaff={activeStaff}
          onPatientIssued={fetchQueueSummary}
          onNavigateToDashboard={(token) => {
            router.push(token ? `/dashboard?token=${token}` : '/dashboard');
          }}
        />
      </main>
      <footer className="border-t border-slate-200/80 bg-white py-3.5 text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium text-slate-700">OPD Patient Registration Counter</span>
          <span className="font-mono text-[11px] text-slate-400">Intelligent Token Intake</span>
        </div>
      </footer>
    </div>
  );
}
