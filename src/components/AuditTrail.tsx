'use client';

import React, { useState, useMemo } from 'react';
import { AuditEntry } from '@/types/triage';
import {
  ShieldCheck,
  Search,
  Download,
  ArrowRight,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';

interface AuditTrailProps {
  auditLogs: AuditEntry[];
  onRefresh: () => void;
}

export const AuditTrail: React.FC<AuditTrailProps> = ({ auditLogs, onRefresh }) => {
  const [filterOverridesOnly, setFilterOverridesOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredLogs = useMemo(() => {
    return auditLogs.filter((entry) => {
      if (filterOverridesOnly && entry.eventType !== 'CLINICAL_OVERRIDE') {
        return false;
      }
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchesToken = entry.tokenNumber.toLowerCase().includes(q);
        const matchesName = entry.patientName.toLowerCase().includes(q);
        const matchesReason = entry.justification.toLowerCase().includes(q);
        const matchesBadge = entry.staffBadge.toLowerCase().includes(q);
        return matchesToken || matchesName || matchesReason || matchesBadge;
      }
      return true;
    });
  }, [auditLogs, filterOverridesOnly, searchQuery]);

  const totalEvents = auditLogs.length;
  const overrideCount = auditLogs.filter((e) => e.eventType === 'CLINICAL_OVERRIDE').length;
  const registrationCount = auditLogs.filter((e) => e.eventType === 'TOKEN_ISSUED').length;
  const adherenceRate =
    registrationCount > 0
      ? Math.max(0, Math.round(((registrationCount - overrideCount) / registrationCount) * 100))
      : 100;

  const exportCSV = () => {
    const headers = [
      'Sequence',
      'Timestamp',
      'Token Number',
      'Patient Name',
      'Event Type',
      'Old Priority',
      'New Priority',
      'Clinical Justification',
      'Staff Badge ID',
    ];

    const rows = filteredLogs.map((log) => [
      log.auditSequence,
      log.timestamp,
      `"${log.tokenNumber}"`,
      `"${log.patientName}"`,
      log.eventType,
      log.oldPriority || 'N/A',
      log.newPriority,
      `"${log.justification.replace(/"/g, '""')}"`,
      `"${log.staffBadge.replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `opd_flow_compliance_audit_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatTimestamp = (isoString: string) => {
    try {
      const d = new Date(isoString);
      const datePart = d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
      const timePart = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      return `${datePart}, ${timePart}`;
    } catch {
      return isoString;
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Header and Compliance Summary */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-800">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              Hospital Compliance & Immutable Audit Trail
              <span className="text-[10px] bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200 uppercase font-mono font-semibold">
                NABH / Statutory Compliant
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              OPD Clinical Governance • Tamper-Evident Event Logging (WAL Journal)
            </p>
          </div>
        </div>

        {/* Export & Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold transition shadow-2xs"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold transition shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-emerald-700" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <span className="text-slate-500 text-xs block font-medium">Total Audited Events</span>
          <span className="text-2xl font-bold text-slate-900">{totalEvents}</span>
          <span className="text-[11px] text-slate-400 block mt-1">Immutable Log Records</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <span className="text-purple-700 text-xs block font-bold">Nurse Overrides</span>
          <span className="text-2xl font-bold text-purple-900">{overrideCount}</span>
          <span className="text-[11px] text-purple-600 block mt-1">Clinical Discretion Actions</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <span className="text-emerald-700 text-xs block font-bold">Triage Adherence</span>
          <span className="text-2xl font-bold text-emerald-800">{adherenceRate}%</span>
          <span className="text-[11px] text-emerald-600 block mt-1">System Rule Compliance</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <span className="text-blue-700 text-xs block font-bold">Registration Records</span>
          <span className="text-2xl font-bold text-blue-900">{registrationCount}</span>
          <span className="text-[11px] text-slate-400 block mt-1">Desk Tokens Triaged</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3 flex-1 min-w-70">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Token #, Patient Name, Staff Badge, or Justification..."
              className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterOverridesOnly(!filterOverridesOnly)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
              filterOverridesOnly
                ? 'bg-purple-50 text-purple-700 border-purple-300'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-purple-600" />
            <span>Overrides Only ({overrideCount})</span>
          </button>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-mono uppercase tracking-wider font-semibold">
                <th className="py-3 px-3">Seq #</th>
                <th className="py-3 px-3">Date &amp; Time</th>
                <th className="py-3 px-3">Token #</th>
                <th className="py-3 px-4">Patient Name</th>
                <th className="py-3 px-3">Event Type</th>
                <th className="py-3 px-3">Priority Shift</th>
                <th className="py-3 px-4 min-w-65">Triggered Reason / Nurse Justification</th>
                <th className="py-3 px-3">Staff Badge ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                    No audit records match the selected filter.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((entry) => {
                  const isOverride = entry.eventType === 'CLINICAL_OVERRIDE';
                  const isRegistration = entry.eventType === 'TOKEN_ISSUED';

                  return (
                    <tr
                      key={entry.id}
                      className={`hover:bg-slate-50 transition ${
                        isOverride ? 'bg-purple-50/30' : ''
                      }`}
                    >
                      {/* Seq */}
                      <td className="py-3 px-3 font-mono text-slate-400 text-[11px]">
                        #{entry.auditSequence}
                      </td>

                      {/* Timestamp */}
                      <td className="py-3 px-3 font-mono text-slate-600 whitespace-nowrap" title={entry.timestamp}>
                        {formatTimestamp(entry.timestamp)}
                      </td>

                      {/* Token # */}
                      <td className="py-3 px-3 font-mono font-bold text-slate-900">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                          #{entry.tokenNumber}
                        </span>
                      </td>

                      {/* Patient Name */}
                      <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                        {entry.patientName}
                      </td>

                      {/* Event Type */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                            isOverride
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : isRegistration
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {entry.eventType.replace('_', ' ')}
                        </span>
                      </td>

                      {/* Priority Shift */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {entry.oldPriority ? (
                            <>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                  entry.oldPriority === 'IMMEDIATE'
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : entry.oldPriority === 'SOON'
                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                }`}
                              >
                                {entry.oldPriority}
                              </span>
                              <ArrowRight className="w-3 h-3 text-slate-400" />
                            </>
                          ) : null}
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                              entry.newPriority === 'IMMEDIATE'
                                ? 'bg-rose-50 text-rose-700 border-rose-300'
                                : entry.newPriority === 'SOON'
                                ? 'bg-amber-50 text-amber-800 border-amber-300'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            }`}
                          >
                            {entry.newPriority}
                          </span>
                        </div>
                      </td>

                      {/* Triggered Reason / Justification */}
                      <td className="py-3 px-4 text-slate-800">
                        <span
                          className={`text-xs ${
                            isOverride ? 'font-semibold text-purple-900 italic' : 'text-slate-700'
                          }`}
                        >
                          {entry.justification}
                        </span>
                      </td>

                      {/* Staff Badge */}
                      <td className="py-3 px-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <UserCheck className="w-3 h-3 text-slate-400" />
                          <span>{entry.staffBadge}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
