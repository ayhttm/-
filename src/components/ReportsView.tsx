import React, { useState, useEffect } from 'react';
import { Category, User } from '../types';
import { readPersisted, writePersisted } from '../lib/persistedState';
import {
  FileBarChart2,
  Download,
  Filter,
  FileSpreadsheet,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';

interface ReportsViewProps {
  categories: Category[];
  token: string;
  currentUser: User | null;
  onSyncGoogleSheet: () => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  categories,
  token,
  currentUser,
  onSyncGoogleSheet
}) => {
  const isAdmin = currentUser?.role === 'Admin';
  const [reportType, setReportTypeState] = useState<
    'balance' | 'low' | 'out_of_stock' | 'in' | 'out' | 'requests'
  >(() => {
    const saved = readPersisted<'balance' | 'low' | 'out_of_stock' | 'in' | 'out' | 'requests'>(
      'inventory_reports_type',
      'balance'
    );
    if (!isAdmin && saved !== 'balance') return 'balance';
    return saved;
  });
  const setReportType = (val: 'balance' | 'low' | 'out_of_stock' | 'in' | 'out' | 'requests') => {
    setReportTypeState(val);
    writePersisted('inventory_reports_type', val);
  };
  const [selectedCategory, setSelectedCategoryState] = useState(() =>
    readPersisted<string>('inventory_reports_category', 'all')
  );
  const setSelectedCategory = (val: string) => {
    setSelectedCategoryState(val);
    writePersisted('inventory_reports_category', val);
  };
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        type: reportType,
        category_id: selectedCategory
      });
      const res = await fetch(`/api/reports?${query.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        alert(json.message);
      }
    } catch (e) {
      console.error('Failed to load report:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [reportType, selectedCategory]);

  const exportCSV = () => {
    if (data.length === 0) return;

    let headers: string[] = [];
    let rows: any[] = [];

    if (reportType === 'balance' || reportType === 'low' || reportType === 'out_of_stock') {
      headers = ['รหัสวัสดุ', 'ชื่อวัสดุ', 'หมวดหมู่', 'ยอดคงเหลือ', 'หน่วยนับ', 'ราคา/หน่วย', 'มูลค่ารวม', 'สถานะ'];
      rows = data.map(i => [
        i.item_code,
        `"${i.item_name}"`,
        `"${i.category_name}"`,
        i.current_balance,
        i.unit,
        i.unit_price,
        i.total_value,
        i.status
      ]);
    } else if (reportType === 'in') {
      headers = ['เลขที่รับเข้า', 'วันที่', 'รายการ', 'ผู้ขาย', 'จำนวน', 'ราคาต่อหน่วย', 'มูลค่ารวม', 'ผู้รับเข้า'];
      rows = data.map(i => [
        i.stockin_no,
        i.stockin_date,
        `"${i.item_name}"`,
        `"${i.supplier || ''}"`,
        i.quantity,
        i.unit_price,
        i.total_amount,
        `"${i.created_by}"`
      ]);
    } else if (reportType === 'out' || reportType === 'requests') {
      headers = ['เลขที่คำขอ', 'เลขที่ตัดสต็อก', 'วันที่', 'ผู้ขอเบิก', 'ฝ่าย/กลุ่มงาน', 'รายการ', 'จำนวน', 'มูลค่า', 'สถานะ'];
      rows = data.map(i => [
        i.request_no,
        i.stockout_no || '-',
        i.request_date,
        `"${i.requester_name}"`,
        `"${i.department}"`,
        `"${i.item_name}"`,
        i.quantity,
        i.total_amount,
        i.status
      ]);
    }

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `inventory_report_${reportType}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/[0.03] backdrop-blur-md p-5 rounded-2xl border border-white/10 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <FileBarChart2 className="w-5 h-5 text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]" />
            รายงานสรุปและส่งออกข้อมูล (Reports)
          </h2>
          <p className="text-xs font-mono text-cyan-400/70 tracking-wide mt-0.5">
            ANALYTICS & EXPORT ENGINE // CSV DISPATCH & GOOGLE SHEETS LIVE SYNC
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono">
          <button
            onClick={exportCSV}
            disabled={data.length === 0}
            className="px-3.5 py-2 bg-white/5 hover:bg-white/10 text-slate-200 disabled:opacity-40 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-white/10 transition shadow"
          >
            <Download className="w-4 h-4 text-cyan-400" />
            <span>EXPORT CSV</span>
          </button>

          <button
            onClick={onSyncGoogleSheet}
            className="px-3.5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-[0_0_15px_rgba(16,185,129,0.3)]"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>SYNC GOOGLE SHEETS</span>
          </button>
        </div>
      </div>

      {/* Tabs & Category Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white/[0.03] backdrop-blur-md border border-white/10 p-3 rounded-2xl shadow-[0_0_15px_rgba(0,0,0,0.3)]">
        <div className="flex flex-wrap gap-1 bg-black/40 p-1 rounded-xl text-xs font-mono border border-white/10">
          <button
            onClick={() => setReportType('balance')}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              reportType === 'balance'
                ? 'bg-gradient-to-r from-cyan-500/30 to-blue-500/30 text-cyan-200 border border-cyan-400/40 shadow-[0_0_10px_rgba(34,211,238,0.3)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            วัสดุคงเหลือ
          </button>
          <button
            onClick={() => setReportType('low')}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              reportType === 'low'
                ? 'bg-gradient-to-r from-cyan-500/30 to-blue-500/30 text-cyan-200 border border-cyan-400/40 shadow-[0_0_10px_rgba(34,211,238,0.3)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            ใกล้หมด
          </button>
          <button
            onClick={() => setReportType('out_of_stock')}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              reportType === 'out_of_stock'
                ? 'bg-gradient-to-r from-cyan-500/30 to-blue-500/30 text-cyan-200 border border-cyan-400/40 shadow-[0_0_10px_rgba(34,211,238,0.3)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            หมดคลัง
          </button>

          {isAdmin && (
            <>
              <button
                onClick={() => setReportType('in')}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${
                  reportType === 'in'
                    ? 'bg-gradient-to-r from-cyan-500/30 to-blue-500/30 text-cyan-200 border border-cyan-400/40 shadow-[0_0_10px_rgba(34,211,238,0.3)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                ประวัติรับเข้า
              </button>
              <button
                onClick={() => setReportType('out')}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${
                  reportType === 'out'
                    ? 'bg-gradient-to-r from-cyan-500/30 to-blue-500/30 text-cyan-200 border border-cyan-400/40 shadow-[0_0_10px_rgba(34,211,238,0.3)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                ประวัติการเบิก
              </button>
              <button
                onClick={() => setReportType('requests')}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${
                  reportType === 'requests'
                    ? 'bg-gradient-to-r from-cyan-500/30 to-blue-500/30 text-cyan-200 border border-cyan-400/40 shadow-[0_0_10px_rgba(34,211,238,0.3)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                คำขอทั้งหมด
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <Filter className="w-4 h-4 text-cyan-400/60" />
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="px-3 py-1.5 bg-black/40 border border-white/10 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-400 shadow-inner"
          >
            <option value="all">ทุกหมวดหมู่ ({categories.length})</option>
            {categories.map(c => (
              <option key={c.category_id} value={c.category_id}>
                {c.category_name}
              </option>
            ))}
          </select>

          <button
            onClick={fetchReport}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Report Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-3 bg-slate-800/60 border-b border-slate-800 flex justify-between items-center text-xs text-slate-400">
          <span>
            แสดงรายการทั้งหมด: <strong className="text-emerald-400">{data.length}</strong> รายการ
          </span>
          <span className="text-[11px]">พิมพ์รายงานกด Ctrl+P หรือเลือกดาวน์โหลด CSV</span>
        </div>

        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-xs text-left text-slate-300">
            <thead className="bg-slate-800/90 text-slate-400 uppercase font-semibold sticky top-0">
              {reportType === 'balance' || reportType === 'low' || reportType === 'out_of_stock' ? (
                <tr>
                  <th className="p-3">รหัสวัสดุ</th>
                  <th className="p-3">ชื่อรายการวัสดุ</th>
                  <th className="p-3">หมวดหมู่</th>
                  <th className="p-3 text-right">ยอดคงเหลือ</th>
                  <th className="p-3 text-right">ราคา/หน่วย</th>
                  <th className="p-3 text-right">มูลค่ารวม</th>
                  <th className="p-3 text-center">สถานะ</th>
                </tr>
              ) : reportType === 'in' ? (
                <tr>
                  <th className="p-3">เลขที่รับ</th>
                  <th className="p-3">วันที่</th>
                  <th className="p-3">รายการวัสดุ</th>
                  <th className="p-3">ผู้ขาย</th>
                  <th className="p-3 text-right">จำนวน</th>
                  <th className="p-3 text-right">ราคา/หน่วย</th>
                  <th className="p-3 text-right">มูลค่ารวม</th>
                </tr>
              ) : (
                <tr>
                  <th className="p-3">เลขที่คำขอ</th>
                  <th className="p-3">เลขที่ตัดสต็อก</th>
                  <th className="p-3">ผู้ขอเบิก</th>
                  <th className="p-3">รายการ</th>
                  <th className="p-3 text-right">จำนวน</th>
                  <th className="p-3 text-right">มูลค่า</th>
                  <th className="p-3 text-center">สถานะ</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-slate-800">
              {data.length > 0 ? (
                data.map((row, idx) => {
                  if (reportType === 'balance' || reportType === 'low' || reportType === 'out_of_stock') {
                    return (
                      <tr key={idx} className="hover:bg-slate-800/40">
                        <td className="p-3 font-mono font-medium text-emerald-400">{row.item_code}</td>
                        <td className="p-3 font-semibold text-slate-100">{row.item_name}</td>
                        <td className="p-3 text-slate-400">{row.category_name}</td>
                        <td className="p-3 text-right font-bold text-slate-200">
                          {row.current_balance} {row.unit}
                        </td>
                        <td className="p-3 text-right">฿{(Number(row.unit_price) || 0).toLocaleString()}</td>
                        <td className="p-3 text-right font-semibold text-emerald-400">
                          ฿{(Number(row.total_value) || 0).toLocaleString()}
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              row.status === 'หมด'
                                ? 'bg-rose-500/20 text-rose-300'
                                : row.status === 'ใกล้หมด'
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-emerald-500/20 text-emerald-300'
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    );
                  } else if (reportType === 'in') {
                    return (
                      <tr key={idx} className="hover:bg-slate-800/40">
                        <td className="p-3 font-mono text-cyan-300">{row.stockin_no}</td>
                        <td className="p-3">{row.stockin_date}</td>
                        <td className="p-3 font-semibold text-slate-100">{row.item_name}</td>
                        <td className="p-3 text-slate-400">{row.supplier || '-'}</td>
                        <td className="p-3 text-right font-bold text-emerald-400">
                          +{row.quantity} {row.unit}
                        </td>
                        <td className="p-3 text-right">฿{row.unit_price}</td>
                        <td className="p-3 text-right font-medium">฿{row.total_amount?.toLocaleString()}</td>
                      </tr>
                    );
                  } else {
                    return (
                      <tr key={idx} className="hover:bg-slate-800/40">
                        <td className="p-3 font-mono text-purple-300">{row.request_no}</td>
                        <td className="p-3 font-mono text-emerald-400">{row.stockout_no || '-'}</td>
                        <td className="p-3">
                          <div className="font-medium text-slate-100">{row.requester_name}</div>
                          <div className="text-[10px] text-slate-500">{row.department}</div>
                        </td>
                        <td className="p-3 text-slate-200">{row.item_name}</td>
                        <td className="p-3 text-right font-bold text-amber-300">
                          {row.quantity} {row.unit}
                        </td>
                        <td className="p-3 text-right">฿{row.total_amount?.toLocaleString()}</td>
                        <td className="p-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              row.status === 'approved'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : row.status === 'rejected'
                                ? 'bg-rose-500/20 text-rose-300'
                                : 'bg-amber-500/20 text-amber-300'
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    );
                  }
                })
              ) : (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    ไม่พบข้อมูลสำหรับเงื่อนไขรายงานนี้
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
