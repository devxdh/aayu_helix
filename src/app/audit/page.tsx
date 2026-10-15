'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AuditEntry, DEFAULT_STAFF_PROFILES, QueueSummary, StaffProfile } from '@/types/triage';
import { Header } from '@/components/Header';
import { AuditTrail } from '@/components/AuditTrail';

export default function AuditPage() {
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
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

  const fetchAuditData = useCallback(async () => {
    try {
      const [auditRes, queueRes] = await Promise.all([
        fetch('/api/audit', { cache: 'no-store' }),
        fetch('/api/queue', { cache: 'no-store' }),
      ]);

      if (auditRes.ok) {
        const auditData = await auditRes.json();
        if (auditData.success) setAuditLogs(auditData.logs);
      }

      if (queueRes.ok) {
        const queueData = await queueRes.json();
        if (queueData.success) {
          setSummary(queueData.summary);
          if (queueData.staffProfiles?.length) setStaffProfiles(queueData.staffProfiles);
        }
      }
    } catch {
      // Quiet poll error
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAuditData();

    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }
      fetchAuditData();
    }, 3000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchAuditData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchAuditData]);

  const handleReset = async () => {
    if (confirm('Reset patient queue to initial demonstration state?')) {
      const res = await fetch('/api/reset', { method: 'POST' });
      if (res.ok) await fetchAuditData();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <Header
        activeTab="AUDIT"
        useLinks={true}
        staffProfiles={staffProfiles}
        activeStaff={activeStaff}
        onStaffChange={setActiveStaff}
        isPolling={isPolling}
        onManualRefresh={fetchAuditData}
        onResetSeedData={handleReset}
        waitingCount={summary.totalWaiting}
        immediateCount={summary.immediateCount}
      />
      <main className="flex-1 pb-16">
        {isLoading && auditLogs.length === 0 ? (
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="flex flex-col items-center gap-3">
              <div className="w-7 h-7 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-slate-500 font-mono">
                Loading compliance audit ledger...
              </span>
            </div>
          </div>
        ) : (
          <AuditTrail auditLogs={auditLogs} onRefresh={fetchAuditData} />
        )}
      </main>
      <footer className="border-t border-slate-200 bg-white py-3 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2">
          <span>Dr. S.N. Medical College, Jodhpur • Statutory Compliance Ledger</span>
          <span className="font-mono text-[11px] text-slate-500">Aayu 2026 AI Medical Hackathon • Track 01</span>
        </div>
      </footer>
    </div>
  );
}
