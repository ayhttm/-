import React from 'react';
import { User } from '../types';
import {
  LayoutDashboard,
  Boxes,
  ArrowDownToLine,
  Send,
  FolderKanban,
  FileBarChart2,
  Users,
  FileSpreadsheet
} from 'lucide-react';

export type TabType =
  | 'dashboard'
  | 'items'
  | 'stockin'
  | 'requests'
  | 'masterdata'
  | 'reports'
  | 'users'
  | 'googlesheets';

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  currentUser: User | null;
  notifications: {
    pending_users: number;
    pending_approvals: number;
  };
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  notifications
}) => {
  const navItems = [
    {
      id: 'dashboard' as TabType,
      label: 'แดชบอร์ดภาพรวม',
      icon: LayoutDashboard,
      adminOnly: false
    },
    {
      id: 'items' as TabType,
      label: 'คลังวัสดุอุปกรณ์',
      icon: Boxes,
      adminOnly: false
    },
    {
      id: 'stockin' as TabType,
      label: 'รับวัสดุเข้าคลัง',
      icon: ArrowDownToLine,
      adminOnly: true
    },
    {
      id: 'requests' as TabType,
      label: 'ขอเบิกวัสดุอุปกรณ์',
      icon: Send,
      adminOnly: false,
      badge: notifications.pending_approvals > 0 ? notifications.pending_approvals : undefined
    },
    {
      id: 'masterdata' as TabType,
      label: 'จัดการหมวดหมู่ & ฝ่าย',
      icon: FolderKanban,
      adminOnly: true
    },
    {
      id: 'reports' as TabType,
      label: 'รายงาน & ส่งออก',
      icon: FileBarChart2,
      adminOnly: false
    },
    {
      id: 'users' as TabType,
      label: 'จัดการผู้ใช้งาน',
      icon: Users,
      adminOnly: true,
      badge: notifications.pending_users > 0 ? notifications.pending_users : undefined
    },
    {
      id: 'googlesheets' as TabType,
      label: 'Google Sheets Live Sync',
      icon: FileSpreadsheet,
      adminOnly: false
    }
  ];

  const filteredNav = navItems.filter(item => !item.adminOnly || currentUser?.role === 'Admin');

  return (
    <aside className="w-64 bg-white/[0.02] border-r border-white/10 backdrop-blur-md shrink-0 min-h-[calc(100vh-4rem)] p-4 flex flex-col justify-between">
      <div className="space-y-1">
        <div className="px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-widest text-cyan-400/80">
          MAIN // NAVIGATION
        </div>
        {filteredNav.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 ${
                isActive
                  ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-200 border border-cyan-400/40 shadow-[0_0_15px_rgba(34,211,238,0.25)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]' : 'text-slate-400'}`} />
                <span className={isActive ? 'font-semibold tracking-wide' : ''}>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 border border-amber-400/40 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.4)] animate-pulse">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="pt-4 border-t border-white/10 text-[11px] font-mono text-slate-500 space-y-1">
        <div className="font-medium text-slate-400 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          ORG: สำนักงานก้าวหน้าพัฒนา
        </div>
        <div className="text-[10px] text-slate-600">ID: 10DfYf1oM8Vzp5NSIk9...</div>
      </div>
    </aside>
  );
};
