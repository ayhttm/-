import React from 'react';
import { User, GoogleAuthStatus } from '../types';
import {
  Package,
  Bell,
  User as UserIcon,
  LogOut,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface HeaderProps {
  currentUser: User | null;
  googleAuth: GoogleAuthStatus;
  notifications: {
    pending_users: number;
    pending_approvals: number;
    my_updated_requests: number;
  };
  onOpenProfile: () => void;
  onOpenGooglePanel: () => void;
  onLogout: () => void;
  onNavigateToRequests: () => void;
  onNavigateToUsers: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  googleAuth,
  notifications,
  onOpenProfile,
  onOpenGooglePanel,
  onLogout,
  onNavigateToRequests,
  onNavigateToUsers
}) => {
  const totalNotifications =
    notifications.pending_users + notifications.pending_approvals + notifications.my_updated_requests;

  return (
    <header className="bg-black/30 backdrop-blur-md text-white border-b border-white/10 sticky top-0 z-30 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo & App Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 border border-cyan-400/30 flex items-center justify-center text-white shadow-[0_0_15px_rgba(34,211,238,0.4)]">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-wide text-slate-100 flex items-center gap-2">
              ระบบคลังวัสดุอุปกรณ์
              <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 shadow-[0_0_10px_rgba(34,211,238,0.2)]">
                NEBULA // G-SHEETS SYNC
              </span>
            </h1>
            <p className="text-[11px] font-mono text-cyan-400/70 tracking-wider uppercase">INVENTORY COMMAND CENTER</p>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          {/* Google Sheets Status Badge */}
          <button
            onClick={onOpenGooglePanel}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono tracking-wide border transition-all duration-200 ${
              googleAuth.connected && !googleAuth.error
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                : 'bg-amber-500/10 border-amber-500/40 text-amber-300 hover:bg-amber-500/20 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
            }`}
            title="จัดการการเชื่อมต่อ Google Sheets"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span className="hidden md:inline font-mono">
              {googleAuth.connected && !googleAuth.error
                ? 'LIVE SYNC: ACTIVE'
                : googleAuth.connected
                  ? 'SHEET ERROR'
                  : 'CONNECT SHEETS'}
            </span>
            {googleAuth.connected && !googleAuth.error ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            )}
          </button>

          {/* Notifications Dropdown / Badges */}
          {totalNotifications > 0 && (
            <div className="relative group">
              <button className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition relative">
                <Bell className="w-5 h-5 text-cyan-400" />
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center shadow-[0_0_10px_rgba(244,63,94,0.6)] animate-pulse">
                  {totalNotifications}
                </span>
              </button>

              <div className="absolute right-0 mt-2 w-72 bg-slate-950/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_0_25px_rgba(0,0,0,0.8)] p-3 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 z-50">
                <h4 className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-widest mb-2 border-b border-white/10 pb-1">
                  TELEMETRY NOTIFICATIONS
                </h4>
                <div className="space-y-2">
                  {notifications.pending_approvals > 0 && (
                    <button
                      onClick={onNavigateToRequests}
                      className="w-full text-left p-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs flex justify-between items-center transition"
                    >
                      <span>มีคำขอเบิกที่รอการอนุมัติ</span>
                      <span className="font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200">
                        {notifications.pending_approvals}
                      </span>
                    </button>
                  )}
                  {notifications.pending_users > 0 && (
                    <button
                      onClick={onNavigateToUsers}
                      className="w-full text-left p-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 text-xs flex justify-between items-center transition"
                    >
                      <span>มีผู้ใช้งานรออนุมัติบัญชี</span>
                      <span className="font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-200">
                        {notifications.pending_users}
                      </span>
                    </button>
                  )}
                  {notifications.my_updated_requests > 0 && (
                    <button
                      onClick={onNavigateToRequests}
                      className="w-full text-left p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs flex justify-between items-center transition"
                    >
                      <span>คำขอเบิกได้รับการอัปเดต</span>
                      <span className="font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-200">
                        {notifications.my_updated_requests}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* User Profile Badge */}
          {currentUser && (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <button
                onClick={onOpenProfile}
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-800 transition"
              >
                <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-sm text-white shadow">
                  {currentUser.fullname.charAt(0)}
                </div>
                <div className="text-left hidden lg:block">
                  <div className="text-xs font-semibold text-slate-200 leading-tight">
                    {currentUser.fullname}
                  </div>
                  <div className="text-[10px] text-emerald-400 font-medium">
                    {currentUser.role} ({currentUser.department || 'ไม่ระบุ'})
                  </div>
                </div>
              </button>

              <button
                onClick={onLogout}
                className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                title="ออกจากระบบ"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
