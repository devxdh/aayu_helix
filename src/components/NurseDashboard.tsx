'use client';

import React, { useState, useEffect } from 'react';
import { Patient, PriorityLevel, QueueSummary, StaffProfile } from '@/types/triage';
import { OverrideModal } from './OverrideModal';
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  SlidersHorizontal,
  PhoneCall,
  Check,
  Search,
  X,
} from 'lucide-react';

interface NurseDashboardProps {
  patients: Patient[];
  summary: QueueSummary;
  activeStaff: StaffProfile;
  highlightedToken?: string | null;
  onCommitOverride: (
    patientId: string,
    newPriority: PriorityLevel,
    justification: string
  ) => Promise<void>;
  onUpdateStatus: (patientId: string, status: 'WAITING' | 'IN_CONSULTATION' | 'COMPLETED') => Promise<void>;
  onNavigateToRegister: () => void;
}

export const NurseDashboard: React.FC<NurseDashboardProps> = ({
  patients,
  summary,
  activeStaff,
  highlightedToken,
  onCommitOverride,
  onUpdateStatus,
  onNavigateToRegister,
}) => {
  const [selectedPatientForOverride, setSelectedPatientForOverride] = useState<Patient | null>(
    null
  );
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | PriorityLevel>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFocusedToken, setActiveFocusedToken] = useState<string | null>(highlightedToken || null);

  const scrollTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const fadeTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  const focusPatientCard = React.useCallback((token: string) => {
    setActiveFocusedToken(token);
    setPriorityFilter('ALL');
    setSearchQuery('');

    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);

    // Allow DOM to finish sorting and reflow before smooth scrolling
    scrollTimerRef.current = setTimeout(() => {
      const el = document.getElementById(`patient-card-${token}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 120);

    // Auto-dismiss the highlight after 5 seconds so it feels smooth and natural
    fadeTimerRef.current = setTimeout(() => {
      setActiveFocusedToken((current) => (current === token ? null : current));
    }, 5000);
  }, []);

  useEffect(() => {
    if (highlightedToken) {
      focusPatientCard(highlightedToken);
    }
  }, [highlightedToken, focusPatientCard]);

  useEffect(() => {
    return () => {
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, []);

  const handleCommitOverrideInternal = async (
    patientId: string,
    newPriority: PriorityLevel,
    justification: string
  ) => {
    const targetPatient = patients.find((p) => p.id === patientId);
    const token = targetPatient?.tokenNumber;
    await onCommitOverride(patientId, newPriority, justification);
    if (token) {
      focusPatientCard(token);
    }
  };

  const handleUpdateStatusInternal = async (
    patientId: string,
    status: 'WAITING' | 'IN_CONSULTATION' | 'COMPLETED'
  ) => {
    const targetPatient = patients.find((p) => p.id === patientId);
    const token = targetPatient?.tokenNumber;
    await onUpdateStatus(patientId, status);
    if (token && status !== 'COMPLETED') {
      focusPatientCard(token);
    }
  };

  const displayedPatients = patients.filter((p) => {
    if (priorityFilter !== 'ALL' && p.currentPriority !== priorityFilter) {
      return false;
    }
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      const matchesName = p.patientName.toLowerCase().includes(q);
      const matchesComplaint = p.chiefComplaint.toLowerCase().includes(q);
      const matchesToken = p.tokenNumber.toLowerCase().includes(q);
      if (!matchesName && !matchesComplaint && !matchesToken) {
        return false;
      }
    }
    return p.status === 'WAITING' || p.status === 'IN_CONSULTATION';
  });

  const [currentTime, setCurrentTime] = useState<number>(0);

  useEffect(() => {
    setCurrentTime(Date.now());
    const timer = setInterval(() => setCurrentTime(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  const formatWaitTime = (createdAt: string) => {
    if (!currentTime) return 'Just now';
    const elapsedMinutes = Math.max(
      0,
      Math.floor((currentTime - new Date(createdAt).getTime()) / (60 * 1000))
    );
    if (elapsedMinutes < 1) return 'Just now';
    if (elapsedMinutes === 1) return '1m ago';
    return `${elapsedMinutes}m ago`;
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Top Simple Summary Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Doctor & Nurse Queue</h2>
          <p className="text-xs text-slate-500">
            Sorted strictly by triage priority. Critical patients automatically jump to the top.
          </p>
        </div>

        {/* Acuity Filter Pills */}
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setPriorityFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition ${
              priorityFilter === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All ({summary.totalWaiting})
          </button>

          <button
            type="button"
            onClick={() => setPriorityFilter(priorityFilter === 'IMMEDIATE' ? 'ALL' : 'IMMEDIATE')}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition ${
              priorityFilter === 'IMMEDIATE'
                ? 'bg-red-600 text-white'
                : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200/80'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-red-600" />
            Immediate ({summary.immediateCount})
          </button>

          <button
            type="button"
            onClick={() => setPriorityFilter(priorityFilter === 'SOON' ? 'ALL' : 'SOON')}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition ${
              priorityFilter === 'SOON'
                ? 'bg-amber-600 text-white'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/80'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Soon ({summary.soonCount})
          </button>

          <button
            type="button"
            onClick={() => setPriorityFilter(priorityFilter === 'ROUTINE' ? 'ALL' : 'ROUTINE')}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition ${
              priorityFilter === 'ROUTINE'
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/80'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-600" />
            Routine ({summary.routineCount})
          </button>
        </div>
      </div>

      {/* Search & Filter Utility Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by patient name, symptoms (chest pain, fever, saas...), or token #..."
            className="w-full pl-10 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end text-xs text-slate-500 font-medium">
          {searchQuery ? (
            <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-lg text-xs font-semibold">
              Found {displayedPatients.length} match{displayedPatients.length === 1 ? '' : 'es'}
            </span>
          ) : (
            <span className="text-slate-400 text-xs">
              Showing {displayedPatients.length} active patient{displayedPatients.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </div>

      {/* Patient Queue Cards List */}
      <div className="space-y-3">
        {displayedPatients.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3 shadow-2xs">
            <div className="h-10 w-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
              {searchQuery ? <Search className="w-5 h-5 text-slate-400" /> : <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
            </div>
            <h3 className="text-sm font-bold text-slate-800">
              {searchQuery ? 'No Matching Patients Found' : 'Queue is Clear'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery
                ? `No active patients matched "${searchQuery}". Check the spelling or clear the search query.`
                : 'No patients are waiting under this filter.'}
            </p>
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg shadow-2xs transition"
              >
                Clear Search Filter
              </button>
            ) : (
              <button
                type="button"
                onClick={onNavigateToRegister}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition"
              >
                + Register New Patient
              </button>
            )}
          </div>
        ) : (
          displayedPatients.map((patient, index) => {
            const isImmediate = patient.currentPriority === 'IMMEDIATE';
            const isSoon = patient.currentPriority === 'SOON';
            const isRoutine = patient.currentPriority === 'ROUTINE';

            const hasAnyVitals =
              patient.vitals.systolicBp ||
              patient.vitals.pulse ||
              patient.vitals.spo2 ||
              patient.vitals.temperature;

            const isHighlighted = activeFocusedToken && patient.tokenNumber === activeFocusedToken;

            return (
              <div
                key={patient.id}
                id={`patient-card-${patient.tokenNumber}`}
                onClick={() => {
                  if (isHighlighted) setActiveFocusedToken(null);
                }}
                className={`bg-white rounded-2xl border transition-all duration-300 p-4 sm:p-5 shadow-2xs hover:shadow-xs relative ${
                  isHighlighted
                    ? 'ring-2 ring-blue-600 ring-offset-2 shadow-lg bg-blue-50/40'
                    : ''
                } ${
                  isImmediate
                    ? 'border-l-6 border-l-red-600 border-slate-200 bg-red-50/20'
                    : isSoon
                    ? 'border-l-6 border-l-amber-500 border-slate-200'
                    : 'border-l-6 border-l-emerald-500 border-slate-200'
                }`}
              >
                {isHighlighted && (
                  <div className="absolute -top-2.5 left-6 bg-blue-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-xs flex items-center gap-1.5 z-10 animate-in fade-in zoom-in-95 duration-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                    <span>Focused Patient #{patient.tokenNumber}</span>
                  </div>
                )}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left: Token & Patient Info */}
                  <div className="flex items-start gap-4">
                    {/* Big Clean Token Box */}
                    <div
                      className={`h-16 w-16 rounded-xl flex flex-col items-center justify-center shrink-0 font-mono border ${
                        isImmediate
                          ? 'bg-red-50 border-red-200 text-red-700'
                          : isSoon
                          ? 'bg-amber-50 border-amber-200 text-amber-800'
                          : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      }`}
                    >
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Token
                      </span>
                      <span className="text-2xl font-black">#{patient.tokenNumber}</span>
                      <span className="text-[9px] text-slate-500">#{index + 1} in line</span>
                    </div>

                    {/* Patient Core Info */}
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-bold text-slate-900">
                          {patient.patientName}
                        </span>
                        <span className="text-xs text-slate-500">
                          ({patient.age}y, {patient.gender.toLowerCase()})
                        </span>

                        {/* Priority Pill */}
                        <span
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 border ${
                            isImmediate
                              ? 'bg-red-100 text-red-800 border-red-300'
                              : isSoon
                              ? 'bg-amber-100 text-amber-900 border-amber-300'
                              : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          }`}
                        >
                          {isImmediate && <AlertTriangle className="w-3 h-3 text-red-600" />}
                          {isSoon && <Clock className="w-3 h-3 text-amber-600" />}
                          {isRoutine && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                          <span>{patient.currentPriority}</span>
                        </span>

                        {/* In Room Indicator */}
                        {patient.status === 'IN_CONSULTATION' && (
                          <span className="text-[11px] font-semibold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                            In Room With Doctor
                          </span>
                        )}

                        {patient.isOverridden && (
                          <span className="text-[10px] font-semibold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                            Nurse Overridden
                          </span>
                        )}

                        <span className="text-xs text-slate-400 font-mono ml-auto md:ml-0">
                          {formatWaitTime(patient.createdAt)}
                        </span>
                      </div>

                      {/* Complaint */}
                      <p className="text-xs text-slate-700">
                        <strong className="text-slate-900">Complaint:</strong> &ldquo;{patient.chiefComplaint}&rdquo;
                      </p>

                      {/* Clinical Reason */}
                      <p className="text-xs text-slate-600 font-medium">
                        <span className="text-slate-500">Clinical Reason: </span>
                        {patient.clinicalRationale}
                      </p>

                      {/* Vitals Summary Line */}
                      <div className="text-xs text-slate-600 pt-0.5 flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-500">Vitals:</span>
                        {hasAnyVitals ? (
                          <span className="font-mono text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                            {[
                              patient.vitals.systolicBp
                                ? `BP ${patient.vitals.systolicBp}/${patient.vitals.diastolicBp || '-'}`
                                : null,
                              patient.vitals.pulse ? `${patient.vitals.pulse} bpm` : null,
                              patient.vitals.spo2 ? `SpO2 ${patient.vitals.spo2}%` : null,
                              patient.vitals.temperature ? `${patient.vitals.temperature}°F` : null,
                            ]
                              .filter(Boolean)
                              .join(' • ')}
                          </span>
                        ) : (
                          <span className="font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                            Not Recorded (Safety Escalation Applied)
                          </span>
                        )}
                      </div>

                      {/* Nurse Override Note (if any) */}
                      {patient.isOverridden && (
                        <p className="text-xs text-purple-800 bg-purple-50 p-2 rounded-lg border border-purple-200 mt-1">
                          <strong>Override Note ({patient.overriddenBy}):</strong> &ldquo;{patient.overrideJustification}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right Action Buttons */}
                  <div className="flex md:flex-col items-center gap-2 shrink-0 pt-2 md:pt-0">
                    <button
                      type="button"
                      onClick={() => setSelectedPatientForOverride(patient)}
                      className="flex-1 md:flex-initial w-full px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 transition flex items-center justify-center gap-1.5"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5 text-slate-600" />
                      <span>Override</span>
                    </button>

                    {patient.status === 'WAITING' ? (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatusInternal(patient.id, 'IN_CONSULTATION')}
                        className="flex-1 md:flex-initial w-full px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition shadow-2xs flex items-center justify-center gap-1.5"
                      >
                        <PhoneCall className="w-3.5 h-3.5" />
                        <span>Call In</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatusInternal(patient.id, 'COMPLETED')}
                        className="flex-1 md:flex-initial w-full px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-2xs flex items-center justify-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Done</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Override Modal */}
      {selectedPatientForOverride && (
        <OverrideModal
          patient={selectedPatientForOverride}
          activeStaff={activeStaff}
          isOpen={true}
          onClose={() => setSelectedPatientForOverride(null)}
          onCommitOverride={handleCommitOverrideInternal}
        />
      )}
    </div>
  );
};
