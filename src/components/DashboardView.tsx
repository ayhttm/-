import React, { useState, useEffect } from 'react';
import { DashboardData } from '../types';
import { readPersisted, writePersisted } from '../lib/persistedState';
import {
  Package,
  CircleDollarSign,
  ArrowDownToLine,
  Send,
  AlertTriangle,
  XCircle,
  Calendar,
  RefreshCw,
  TrendingUp,
  PieChart as PieChartIcon
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

interface DashboardViewProps {
  token: string;
  onNavigateToTab: (tab: any) => void;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];

export const DashboardView: React.FC<DashboardViewProps> = ({ token, onNavigateToTab }) => {
  const [range, setRangeState] = useState<'all' | 'today' | 'week' | 'month' | 'year' | 'custom'>(() =>
    readPersisted('inventory_dashboard_range', 'month')
  );
  const setRange = (val: 'all' | 'today' | 'week' | 'month' | 'year' | 'custom') => {
    setRangeState(val);
    writePersisted('inventory_dashboard_range', val);
  };
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ range, startDate, endDate });
      const res = await fetch(`/api/dashboard?${query.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch (e) {
      console.error('Failed to load dashboard:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [range, startDate, endDate]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        <span>กำลังโหลดข้อมูลแดชบอร์ด...</span>
      </div>
    );
  }

  const summary = data?.summary || {
    totalItems: 0,
    totalStockValue: 0,
    totalInQty: 0,
    totalOutQty: 0,
    totalOutValue: 0,
    outOfStockCount: 0,
    lowStockCount: 0
  };

  const catPieData = Object.entries(data?.catOutMap || {}).map(([name, value]) => ({
    name,
    value
  }));

  return (
    <div className="space-y-6">
      {/* Title & Date Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/[0.03] backdrop-blur-md p-5 rounded-2xl border border-white/10 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2 font-sans tracking-wide">
            <TrendingUp className="w-5 h-5 text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]" />
            ภาพรวมระบบคลังวัสดุอุปกรณ์
          </h2>
          <p className="text-xs font-mono text-cyan-400/70 tracking-wide mt-0.5">
            SUMMARY & TELEMETRY // STOCK IN, OUT & VALUATION
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Calendar className="w-4 h-4 text-cyan-400/80 hidden md:block" />
          <div className="flex rounded-xl bg-black/40 p-1 border border-white/10 font-mono">
            {(['today', 'week', 'month', 'year', 'all'] as const).map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1 rounded-lg transition font-medium ${
                  range === r
                    ? 'bg-gradient-to-r from-cyan-500/30 to-blue-500/30 text-cyan-200 border border-cyan-400/40 shadow-[0_0_10px_rgba(34,211,238,0.3)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {r === 'today'
                  ? 'วันนี้'
                  : r === 'week'
                  ? '7 วัน'
                  : r === 'month'
                  ? 'เดือนนี้'
                  : r === 'year'
                  ? 'ปีนี้'
                  : 'ทั้งหมด'}
              </button>
            ))}
          </div>

          <button
            onClick={fetchDashboard}
            className="p-2 bg-white/5 hover:bg-white/10 text-cyan-400 rounded-xl border border-white/10 transition shadow-[0_0_10px_rgba(34,211,238,0.15)]"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="bg-white/[0.03] backdrop-blur-md border border-white/10 p-4 rounded-2xl space-y-2 hover:border-cyan-400/30 transition-all duration-200 shadow-[0_0_15px_rgba(0,0,0,0.3)]">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>วัสดุทั้งหมด</span>
            <Package className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100 font-mono tracking-tight">{summary.totalItems}</div>
          <div className="text-[11px] font-mono text-slate-500">รายการในฐานข้อมูล</div>
        </div>

        <div className="bg-white/[0.03] backdrop-blur-md border border-white/10 p-4 rounded-2xl space-y-2 hover:border-emerald-400/40 transition-all duration-200 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>มูลค่าสต็อกรวม</span>
            <CircleDollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono tracking-tight shadow-[0_0_10px_rgba(16,185,129,0.2)]">
            ฿{summary.totalStockValue.toLocaleString()}
          </div>
          <div className="text-[11px] font-mono text-slate-500">ประเมินตามราคาหน่วย</div>
        </div>

        <div className="bg-white/[0.03] backdrop-blur-md border border-white/10 p-4 rounded-2xl space-y-2 hover:border-cyan-400/40 transition-all duration-200 shadow-[0_0_15px_rgba(34,211,238,0.1)]">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>ปริมาณรับเข้า</span>
            <ArrowDownToLine className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-cyan-300 font-mono tracking-tight">
            {summary.totalInQty.toLocaleString()}
          </div>
          <div className="text-[11px] font-mono text-slate-500">หน่วยนับที่รับเข้า</div>
        </div>

        <div className="bg-white/[0.03] backdrop-blur-md border border-white/10 p-4 rounded-2xl space-y-2 hover:border-purple-400/40 transition-all duration-200 shadow-[0_0_15px_rgba(168,85,247,0.1)]">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>มูลค่าเบิกออก</span>
            <Send className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-purple-300 font-mono tracking-tight">
            ฿{summary.totalOutValue.toLocaleString()}
          </div>
          <div className="text-[11px] font-mono text-slate-500">{summary.totalOutQty} หน่วยนับ</div>
        </div>

        <button
          onClick={() => onNavigateToTab('items')}
          className="bg-amber-500/5 backdrop-blur-md border border-amber-500/30 hover:border-amber-400 p-4 rounded-2xl space-y-2 text-left transition duration-200 shadow-[0_0_15px_rgba(245,158,11,0.1)]"
        >
          <div className="flex items-center justify-between text-amber-400 text-xs font-mono">
            <span>วัสดุใกล้หมด</span>
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold text-amber-300 font-mono tracking-tight">{summary.lowStockCount}</div>
          <div className="text-[11px] font-mono text-amber-400/80">ต่ำกว่า Min Stock</div>
        </button>

        <button
          onClick={() => onNavigateToTab('items')}
          className="bg-rose-500/5 backdrop-blur-md border border-rose-500/30 hover:border-rose-400 p-4 rounded-2xl space-y-2 text-left transition duration-200 shadow-[0_0_15px_rgba(244,63,94,0.1)]"
        >
          <div className="flex items-center justify-between text-rose-400 text-xs font-mono">
            <span>วัสดุหมดคลัง</span>
            <XCircle className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold text-rose-400 font-mono tracking-tight">{summary.outOfStockCount}</div>
          <div className="text-[11px] font-mono text-rose-400/80">ยอดคงเหลือ = 0</div>
        </button>
      </div>

      {/* Visual Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top 10 Most Withdrawn Items */}
        <div className="lg:col-span-2 bg-white/[0.03] backdrop-blur-md border border-white/10 p-5 rounded-2xl space-y-4 shadow-[0_0_20px_rgba(0,0,0,0.4)]">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              10 อันดับวัสดุที่มีการเบิกมากที่สุด
            </h3>
            <span className="text-xs font-mono text-cyan-400/60">(UNITS)</span>
          </div>

          <div className="h-64 w-full">
            {data?.topWithdrawn && data.topWithdrawn.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.topWithdrawn} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis type="number" stroke="#64748b" fontSize={11} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    stroke="#94a3b8"
                    fontSize={11}
                    width={130}
                    tickFormatter={val => (val.length > 15 ? `${val.substring(0, 15)}...` : val)}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#020617',
                      borderColor: 'rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                      color: '#f8fafc',
                      fontSize: '12px',
                      boxShadow: '0 0 15px rgba(0,0,0,0.8)'
                    }}
                  />
                  <Bar dataKey="qty" fill="#22d3ee" radius={[0, 6, 6, 0]} name="จำนวนที่เบิก" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs font-mono text-slate-500">
                NO WITHDRAWAL TELEMETRY IN RANGE
              </div>
            )}
          </div>
        </div>

        {/* Category Breakdown Donut Chart */}
        <div className="bg-white/[0.03] backdrop-blur-md border border-white/10 p-5 rounded-2xl space-y-4 shadow-[0_0_20px_rgba(0,0,0,0.4)]">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <PieChartIcon className="w-4 h-4 text-cyan-400" />
            มูลค่าการเบิกแบ่งตามหมวดหมู่
          </h3>

          <div className="h-64 w-full">
            {catPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={catPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {catPieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => `฿${Number(val).toLocaleString()}`}
                    contentStyle={{
                      backgroundColor: '#020617',
                      borderColor: 'rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                      color: '#f8fafc',
                      fontSize: '12px'
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }}
                    layout="horizontal"
                    verticalAlign="bottom"
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs font-mono text-slate-500">
                NO CATEGORY WITHDRAWALS
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Stock In */}
        <div className="bg-white/[0.03] backdrop-blur-md border border-white/10 p-5 rounded-2xl space-y-3 shadow-[0_0_20px_rgba(0,0,0,0.4)]">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <ArrowDownToLine className="w-4 h-4 text-cyan-400" />
              การรับวัสดุเข้าคลังล่าสุด
            </h3>
            <button
              onClick={() => onNavigateToTab('stockin')}
              className="text-xs font-mono text-cyan-400 hover:text-cyan-300 transition hover:underline"
            >
              VIEW ALL →
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-300">
              <thead className="bg-black/40 text-cyan-400/80 font-mono text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="p-2.5">REF NO.</th>
                  <th className="p-2.5">ITEM NAME</th>
                  <th className="p-2.5 text-right">QTY</th>
                  <th className="p-2.5 text-right">VALUE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {data?.recentStockIn && data.recentStockIn.length > 0 ? (
                  data.recentStockIn.map(s => (
                    <tr key={s.stockin_id} className="hover:bg-white/5 transition">
                      <td className="p-2.5 font-medium text-cyan-300">{s.stockin_no}</td>
                      <td className="p-2.5 font-sans font-medium text-slate-100">{s.item_name}</td>
                      <td className="p-2.5 text-right font-semibold text-emerald-400">
                        +{s.quantity} {s.unit}
                      </td>
                      <td className="p-2.5 text-right font-medium text-slate-300">
                        ฿{(Number(s.total_amount) || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-slate-500 font-mono">
                      NO RECENT STOCK IN RECORDS
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Requests */}
        <div className="bg-white/[0.03] backdrop-blur-md border border-white/10 p-5 rounded-2xl space-y-3 shadow-[0_0_20px_rgba(0,0,0,0.4)]">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Send className="w-4 h-4 text-purple-400" />
              คำขอเบิกวัสดุล่าสุด
            </h3>
            <button
              onClick={() => onNavigateToTab('requests')}
              className="text-xs font-mono text-cyan-400 hover:text-cyan-300 transition hover:underline"
            >
              VIEW ALL →
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-300">
              <thead className="bg-black/40 text-cyan-400/80 font-mono text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="p-2.5">REQ NO.</th>
                  <th className="p-2.5">REQUESTER</th>
                  <th className="p-2.5">ITEM</th>
                  <th className="p-2.5 text-right">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data?.recentRequests && data.recentRequests.length > 0 ? (
                  data.recentRequests.map(r => (
                    <tr key={r.request_id} className="hover:bg-white/5 transition">
                      <td className="p-2.5 font-mono font-medium text-purple-300">{r.request_no}</td>
                      <td className="p-2.5 font-sans">{r.requester_name}</td>
                      <td className="p-2.5 font-sans text-slate-100">{r.item_name}</td>
                      <td className="p-2.5 text-right">
                        <span
                          className={`px-2 py-0.5 rounded-md font-mono font-semibold text-[10px] ${
                            r.status === 'approved'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : r.status === 'rejected'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {r.status === 'approved'
                            ? 'APPROVED'
                            : r.status === 'rejected'
                            ? 'REJECTED'
                            : 'PENDING'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-slate-500 font-mono">
                      NO RECENT REQUESTS
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
