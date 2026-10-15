'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AuditEntry, DEFAULT_STAFF_PROFILES, Patient, PriorityLevel, QueueSummary, StaffProfile } from '@/types/triage';
import { Header, ActiveTab } from '@/components/Header';
import { RegistrationDesk } from '@/components/RegistrationDesk';
import { NurseDashboard } from '@/components/NurseDashboard';
import { AuditTrail } from '@/components/AuditTrail';

export default function OPDPlatformPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('DASHBOARD');
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
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>(DEFAULT_STAFF_PROFILES);
  const [activeStaff, setActiveStaff] = useState<StaffProfile>(DEFAULT_STAFF_PROFILES[0]);
  const [highlightedToken, setHighlightedToken] = useState<string | null>(null);
  const [isPolling] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const queueEtagRef = React.useRef<string | null>(null);

  // Fetch queue data with ETag support
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
        // Not modified: Queue data has not changed, 0 bytes transferred
        return;
      }

      const etag = res.headers.get('ETag');
      if (etag) queueEtagRef.current = etag;

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setPatients(data.patients);
          setSummary(data.summary);
          if (data.staffProfiles && data.staffProfiles.length > 0) {
            setStaffProfiles(data.staffProfiles);
          }
        }
      }
    } catch {
      // Quiet poll error
    }
  }, []);

  // Fetch audit logs
  const fetchAuditData = useCallback(async () => {
    try {
      const res = await fetch('/api/audit', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setAuditLogs(data.logs);
        }
      }
    } catch {
      // Quiet poll error
    }
  }, []);

  // Combined fetch for initial boot or manual refresh
  const refreshAll = useCallback(async () => {
    await Promise.all([fetchQueueData(), fetchAuditData()]);
    setIsLoading(false);
  }, [fetchQueueData, fetchAuditData]);

  // Initial load + smart adaptive polling hook
  useEffect(() => {
    refreshAll();

    const interval = setInterval(() => {
      // Pause polling if user is tabbed away or window is minimized
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }

      // Smart tab-aware polling: only poll what the nurse is actively viewing
      if (activeTab === 'DASHBOARD') {
        fetchQueueData();
      } else if (activeTab === 'AUDIT') {
        fetchAuditData();
      }
    }, 3000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (activeTab === 'DASHBOARD') fetchQueueData();
        if (activeTab === 'AUDIT') fetchAuditData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [activeTab, refreshAll, fetchQueueData, fetchAuditData]);

  // Handle clinical nurse override
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

    await refreshAll();
  };

  // Handle patient status updates (e.g. Call in, complete)
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
      await refreshAll();
    }
  };

  // Reset to default seed queue
  const handleResetSeedData = async () => {
    if (confirm('Reset patient queue to initial demonstration state?')) {
      const res = await fetch('/api/reset', { method: 'POST' });
      if (res.ok) {
        await refreshAll();
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Universal Institutional Header & Workstation Switcher */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        staffProfiles={staffProfiles}
        activeStaff={activeStaff}
        onStaffChange={setActiveStaff}
        isPolling={isPolling}
        onManualRefresh={refreshAll}
        onResetSeedData={handleResetSeedData}
        waitingCount={summary.totalWaiting}
        immediateCount={summary.immediateCount}
      />

      {/* Main Workstation View Area */}
      <main className="flex-1 pb-16">
        {isLoading && patients.length === 0 ? (
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-slate-500 font-mono">
                Connecting to Hospital Queue Store...
              </span>
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'REGISTER' && (
              <RegistrationDesk
                activeStaff={activeStaff}
                onPatientIssued={refreshAll}
                onNavigateToDashboard={(token) => {
                  if (token) setHighlightedToken(token);
                  setActiveTab('DASHBOARD');
                  setTimeout(() => {
                    if (token) {
                      const el = document.getElementById(`patient-card-${token}`);
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                  }, 100);
                }}
              />
            )}

            {activeTab === 'DASHBOARD' && (
              <NurseDashboard
                patients={patients}
                summary={summary}
                activeStaff={activeStaff}
                highlightedToken={highlightedToken}
                onCommitOverride={handleCommitOverride}
                onUpdateStatus={handleUpdateStatus}
                onNavigateToRegister={() => setActiveTab('REGISTER')}
              />
            )}

            {activeTab === 'AUDIT' && (
              <AuditTrail auditLogs={auditLogs} onRefresh={fetchAuditData} />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-3.5 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2">
          <span>
            Dr. S.N. Medical College, Jodhpur • Triage Clinical Prioritization System
          </span>
          <span className="font-mono text-[11px] text-slate-500">
            Emergency & Outpatient Care
          </span>
        </div>
      </footer>
    </div>
  );
}
