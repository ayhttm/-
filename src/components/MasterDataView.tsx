import React, { useState } from 'react';
import { Category, Department } from '../types';
import { FolderKanban, Plus, Edit, Trash2, X, CheckCircle2, AlertCircle } from 'lucide-react';

interface MasterDataViewProps {
  categories: Category[];
  departments: Department[];
  token: string;
  onRefresh: () => void;
}

export const MasterDataView: React.FC<MasterDataViewProps> = ({
  categories,
  departments,
  token,
  onRefresh
}) => {
  const [activeTab, setActiveTab] = useState<'categories' | 'departments'>('categories');

  // Category Modal State
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');

  // Department Modal State
  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deptName, setDeptName] = useState('');

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Category Save
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const payload = {
        ...(editingCat ? { category_id: editingCat.category_id } : {}),
        category_name: catName,
        description: catDesc,
        status: 'active'
      };

      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (json.success) {
        setMessage({ type: 'success', text: json.message });
        setTimeout(() => {
          setCatModalOpen(false);
          onRefresh();
        }, 1000);
      } else {
        setMessage({ type: 'error', text: json.message });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('ยืนยันการลบหมวดหมู่นี้?')) return;
    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) onRefresh();
      else alert(json.message);
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Department Save
  const handleSaveDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const payload = {
        ...(editingDept ? { department_id: editingDept.department_id } : {}),
        department_name: deptName,
        status: 'active'
      };

      const res = await fetch('/api/departments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (json.success) {
        setMessage({ type: 'success', text: json.message });
        setTimeout(() => {
          setDeptModalOpen(false);
          onRefresh();
        }, 1000);
      } else {
        setMessage({ type: 'error', text: json.message });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDepartment = async (id: string) => {
    if (!confirm('ยืนยันการลบฝ่าย/กลุ่มงานนี้?')) return;
    try {
      const res = await fetch(`/api/departments/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) onRefresh();
      else alert(json.message);
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/[0.03] backdrop-blur-md p-5 rounded-2xl border border-white/10 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]" />
            จัดการข้อมูลหลัก (Master Data)
          </h2>
          <p className="text-xs font-mono text-cyan-400/70 tracking-wide mt-0.5">
            MASTER ENTITIES // CATEGORY & DEPARTMENT CONFIGURATION
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-black/40 p-1 rounded-xl text-xs font-mono border border-white/10">
          <button
            onClick={() => setActiveTab('categories')}
            className={`px-4 py-1.5 rounded-lg font-medium transition ${
              activeTab === 'categories'
                ? 'bg-gradient-to-r from-cyan-500/30 to-blue-500/30 text-cyan-200 border border-cyan-400/40 shadow-[0_0_10px_rgba(34,211,238,0.3)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            หมวดหมู่ ({categories.length})
          </button>
          <button
            onClick={() => setActiveTab('departments')}
            className={`px-4 py-1.5 rounded-lg font-medium transition ${
              activeTab === 'departments'
                ? 'bg-gradient-to-r from-cyan-500/30 to-blue-500/30 text-cyan-200 border border-cyan-400/40 shadow-[0_0_10px_rgba(34,211,238,0.3)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            ฝ่าย / กลุ่มงาน ({departments.length})
          </button>
        </div>
      </div>

      {/* Categories Content */}
      {activeTab === 'categories' && (
        <div className="bg-white/[0.03] backdrop-blur-md border border-white/10 rounded-2xl p-5 space-y-4 shadow-[0_0_25px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="text-sm font-bold text-slate-200">หมวดหมู่รายการวัสดุ</h3>
            <button
              onClick={() => {
                setEditingCat(null);
                setCatName('');
                setCatDesc('');
                setCatModalOpen(true);
              }}
              className="px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 rounded-xl text-xs font-mono font-bold flex items-center gap-1 transition shadow-[0_0_10px_rgba(16,185,129,0.3)]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>ADD CATEGORY</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-300">
              <thead className="bg-black/50 text-cyan-400/80 font-mono text-[10px] uppercase tracking-wider border-b border-white/10">
                <tr>
                  <th className="p-3">CATEGORY NAME</th>
                  <th className="p-3">DESCRIPTION</th>
                  <th className="p-3 text-center">STATUS</th>
                  <th className="p-3 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {categories.map(c => (
                  <tr key={c.category_id} className="hover:bg-white/5 transition">
                    <td className="p-3 font-semibold text-slate-100">{c.category_name}</td>
                    <td className="p-3 text-slate-400">{c.description || '-'}</td>
                    <td className="p-3 text-center font-mono">
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold text-[10px]">
                        ACTIVE
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-1">
                      <button
                        onClick={() => {
                          setEditingCat(c);
                          setCatName(c.category_name);
                          setCatDesc(c.description);
                          setCatModalOpen(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(c.category_id)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Departments Content */}
      {activeTab === 'departments' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-200">รายชื่อฝ่าย / กลุ่มงานในองค์กร</h3>
            <button
              onClick={() => {
                setEditingDept(null);
                setDeptName('');
                setDeptModalOpen(true);
              }}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>เพิ่มกลุ่มงาน</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-300">
              <thead className="bg-slate-800/80 text-slate-400 uppercase font-semibold">
                <tr>
                  <th className="p-3">ชื่อกลุ่มงาน / ฝ่าย</th>
                  <th className="p-3 text-center">สถานะ</th>
                  <th className="p-3 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {departments.map(d => (
                  <tr key={d.department_id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-semibold text-slate-100">{d.department_name}</td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">
                        ใช้งานอยู่
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-1">
                      <button
                        onClick={() => {
                          setEditingDept(d);
                          setDeptName(d.department_name);
                          setDeptModalOpen(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteDepartment(d.department_id)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {catModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 relative">
            <button
              onClick={() => setCatModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-slate-100">
              {editingCat ? 'แก้ไขหมวดหมู่' : 'เพิ่มหมวดหมู่ใหม่'}
            </h3>

            {message && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  message.type === 'success'
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                }`}
              >
                {message.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{message.text}</span>
              </div>
            )}

            <form onSubmit={handleSaveCategory} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-300 mb-1">ชื่อหมวดหมู่ *</label>
                <input
                  type="text"
                  required
                  value={catName}
                  onChange={e => setCatName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-300 mb-1">คำอธิบาย</label>
                <textarea
                  rows={2}
                  value={catDesc}
                  onChange={e => setCatDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCatModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-medium"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium shadow"
                >
                  {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Department Modal */}
      {deptModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 relative">
            <button
              onClick={() => setDeptModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-slate-100">
              {editingDept ? 'แก้ไขกลุ่มงาน' : 'เพิ่มกลุ่มงานใหม่'}
            </h3>

            {message && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  message.type === 'success'
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                }`}
              >
                {message.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{message.text}</span>
              </div>
            )}

            <form onSubmit={handleSaveDepartment} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-300 mb-1">
                  ชื่อกลุ่มงาน / ฝ่าย *
                </label>
                <input
                  type="text"
                  required
                  value={deptName}
                  onChange={e => setDeptName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeptModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-medium"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium shadow"
                >
                  {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
