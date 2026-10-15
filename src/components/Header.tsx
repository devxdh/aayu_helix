'use client';

import React from 'react';
import Link from 'next/link';
import { StaffProfile } from '@/types/triage';
import {
  RotateCcw,
  User,
} from 'lucide-react';

export type ActiveTab = 'DASHBOARD' | 'REGISTER' | 'AUDIT';

interface HeaderProps {
  activeTab: ActiveTab;
  onTabChange?: (tab: ActiveTab) => void;
  staffProfiles: StaffProfile[];
  activeStaff: StaffProfile;
  onStaffChange: (staff: StaffProfile) => void;
  isPolling: boolean;
  onManualRefresh: () => void;
  onResetSeedData: () => void;
  waitingCount: number;
  immediateCount: number;
  useLinks?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  staffProfiles,
  activeStaff,
  onStaffChange,
  onResetSeedData,
  waitingCount,
  immediateCount,
  useLinks = false,
}) => {
  return (
    <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-xs">
            +
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 tracking-tight text-base">Triage</span>
              <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
                Clinical OS
              </span>
            </div>
            <p className="text-[11px] text-slate-500 hidden sm:block">
              Clinical Prioritization & Queue System
            </p>
          </div>
        </div>

        {/* Minimal Navigation Tabs */}
        <nav className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          {useLinks ? (
            <>
              <Link
                href="/dashboard"
                className={`px-3.5 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                  activeTab === 'DASHBOARD'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Live Queue</span>
                {waitingCount > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      immediateCount > 0 ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {waitingCount}
                  </span>
                )}
              </Link>
              <Link
                href="/register"
                className={`px-3.5 py-1.5 rounded-lg transition ${
                  activeTab === 'REGISTER'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Register Patient
              </Link>
              <Link
                href="/audit"
                className={`px-3.5 py-1.5 rounded-lg transition ${
                  activeTab === 'AUDIT'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Audit Trail
              </Link>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onTabChange && onTabChange('DASHBOARD')}
                className={`px-3.5 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                  activeTab === 'DASHBOARD'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Live Queue</span>
                {waitingCount > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      immediateCount > 0 ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {waitingCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => onTabChange && onTabChange('REGISTER')}
                className={`px-3.5 py-1.5 rounded-lg transition ${
                  activeTab === 'REGISTER'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Register Patient
              </button>

              <button
                type="button"
                onClick={() => onTabChange && onTabChange('AUDIT')}
                className={`px-3.5 py-1.5 rounded-lg transition ${
                  activeTab === 'AUDIT'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Audit Trail
              </button>
            </>
          )}
        </nav>

        {/* Right Tools: Staff Selector & Reset */}
        <div className="flex items-center gap-2">
          {/* Staff dropdown pill */}
          <div className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 transition">
            <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <select
              aria-label="Staff Profile"
              value={activeStaff.id}
              onChange={(e) => {
                const found = staffProfiles.find((s) => s.id === e.target.value);
                if (found) onStaffChange(found);
              }}
              className="bg-transparent text-slate-800 text-xs font-medium focus:outline-none cursor-pointer max-w-35 truncate"
            >
              {staffProfiles.map((s) => (
                <option key={s.id} value={s.id} className="bg-white text-slate-800">
                  {s.name} ({s.badgeNumber})
                </option>
              ))}
            </select>
          </div>

          {/* Quick seed reset button */}
          <button
            type="button"
            onClick={onResetSeedData}
            title="Reset queue to demo test cases"
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 rounded-lg transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
