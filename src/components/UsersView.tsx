import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { Users, UserPlus, Check, X, Shield, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';

interface UsersViewProps {
  token: string;
  departments: string[];
  onRefresh: () => void;
}

export const UsersView: React.FC<UsersViewProps> = ({ token, departments, onRefresh }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    fullname: '',
    phone: '',
    position: '',
    role: 'User' as 'Admin' | 'User',
    department: departments[0] || 'บริหารทั่วไป',
    status: 'active' as 'active' | 'pending' | 'inactive',
    approval_note: ''
  });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) {
        setUsers(json.data);
      }
    } catch (e) {
      console.error('Failed to load users:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleOpenAdd = () => {
    setEditingUser(null);
    setFormData({
      username: '',
      password: '',
      fullname: '',
      phone: '',
      position: '',
      role: 'User',
      department: departments[0] || 'บริหารทั่วไป',
      status: 'active',
      approval_note: ''
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      password: '',
      fullname: user.fullname,
      phone: user.phone || '',
      position: user.position || '',
      role: user.role,
      department: user.department || 'บริหารทั่วไป',
      status: user.status,
      approval_note: user.approval_note || ''
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const payload = {
        ...(editingUser ? { user_id: editingUser.user_id } : {}),
        ...formData
      };

      const res = await fetch('/api/users', {
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
          setModalOpen(false);
          fetchUsers();
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

  const handleQuickApprove = async (user: User) => {
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: user.user_id,
          fullname: user.fullname,
          role: user.role,
          department: user.department,
          status: 'active',
          approval_note: 'อนุมัติผ่านปุ่มด่วน'
        })
      });
      const json = await res.json();
      if (json.success) {
        fetchUsers();
        onRefresh();
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('ยืนยันการลบบัญชีผู้ใช้งานนี้?')) return;
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) {
        fetchUsers();
        onRefresh();
      } else alert(json.message);
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
            <Users className="w-5 h-5 text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]" />
            จัดการบัญชีผู้ใช้งาน (User Management)
          </h2>
          <p className="text-xs font-mono text-cyan-400/70 tracking-wide mt-0.5">
            IDENTITY TELEMETRY // USER ROLES & ACCESS DISPATCH
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition shadow-[0_0_15px_rgba(16,185,129,0.3)] shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>ADD NEW USER</span>
        </button>
      </div>

      {/* Pending Approval Section */}
      {users.some(u => u.status === 'pending') && (
        <div className="bg-amber-500/10 backdrop-blur-md border border-amber-500/30 rounded-2xl p-4 space-y-3 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
          <h3 className="text-sm font-bold font-mono text-amber-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            PENDING APPROVAL QUEUE
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {users
              .filter(u => u.status === 'pending')
              .map(u => (
                <div
                  key={u.user_id}
                  className="bg-black/40 border border-amber-500/30 rounded-xl p-3 flex justify-between items-center text-xs font-mono"
                >
                  <div>
                    <div className="font-bold text-slate-100">{u.fullname}</div>
                    <div className="text-slate-400 text-[11px]">
                      @{u.username} • {u.department} ({u.position || 'เจ้าหน้าที่'})
                    </div>
                  </div>
                  <button
                    onClick={() => handleQuickApprove(u)}
                    className="px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-bold rounded-lg flex items-center gap-1 transition shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>APPROVE</span>
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white/[0.03] backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden shadow-[0_0_25px_rgba(0,0,0,0.5)]">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-300">
            <thead className="bg-black/50 text-cyan-400/80 font-mono text-[10px] uppercase tracking-wider border-b border-white/10">
              <tr>
                <th className="p-3.5">USER NAME</th>
                <th className="p-3.5">DEPARTMENT & POSITION</th>
                <th className="p-3.5">CONTACT</th>
                <th className="p-3.5 text-center">ROLE</th>
                <th className="p-3.5 text-center">STATUS</th>
                <th className="p-3.5 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.map(u => (
                <tr key={u.user_id} className="hover:bg-slate-800/50">
                  <td className="p-3.5">
                    <div className="font-bold text-slate-100">{u.fullname}</div>
                    <div className="text-[11px] text-slate-400">@{u.username}</div>
                  </td>
                  <td className="p-3.5">
                    <div className="font-medium text-slate-200">{u.department}</div>
                    <div className="text-[10px] text-slate-500">{u.position || '-'}</div>
                  </td>
                  <td className="p-3.5 text-slate-300">{u.phone || '-'}</td>
                  <td className="p-3.5 text-center">
                    <span
                      className={`px-2.5 py-1 rounded-full font-bold text-[10px] inline-flex items-center gap-1 ${
                        u.role === 'Admin'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      }`}
                    >
                      <Shield className="w-3 h-3" />
                      <span>{u.role}</span>
                    </span>
                  </td>
                  <td className="p-3.5 text-center">
                    <span
                      className={`px-2.5 py-1 rounded-full font-bold text-[10px] ${
                        u.status === 'active'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : u.status === 'pending'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-slate-700 text-slate-400'
                      }`}
                    >
                      {u.status === 'active' ? 'อนุมัติแล้ว' : u.status === 'pending' ? 'รออนุมัติ' : 'ถูกระงับ'}
                    </span>
                  </td>
                  <td className="p-3.5 text-right space-x-1">
                    <button
                      onClick={() => handleOpenEdit(u)}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium"
                    >
                      แก้ไข
                    </button>
                    <button
                      onClick={() => handleDelete(u.user_id)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg"
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

      {/* Add / Edit User Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 relative">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-400" />
              {editingUser ? 'แก้ไขข้อมูลผู้ใช้งาน' : 'เพิ่มผู้ใช้งานใหม่'}
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

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">ชื่อผู้ใช้งาน *</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingUser}
                    value={formData.username}
                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">
                    รหัสผ่าน {editingUser ? '(เว้นว่างหากไม่เปลี่ยน)' : '*'}
                  </label>
                  <input
                    type="password"
                    required={!editingUser}
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">ชื่อ-นามสกุล *</label>
                <input
                  type="text"
                  required
                  value={formData.fullname}
                  onChange={e => setFormData({ ...formData, fullname: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">เบอร์โทรศัพท์</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">ตำแหน่ง</label>
                  <input
                    type="text"
                    value={formData.position}
                    onChange={e => setFormData({ ...formData, position: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">ฝ่าย / กลุ่มงาน *</label>
                  <select
                    value={formData.department}
                    onChange={e => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    {departments.map((d, idx) => (
                      <option key={idx} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">สิทธิ์ระบบ *</label>
                  <select
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="User">User (เบิกวัสดุ)</option>
                    <option value="Admin">Admin (ผู้ดูแลระบบ)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">สถานะ *</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="active">อนุมัติแล้ว (Active)</option>
                    <option value="pending">รอการอนุมัติ (Pending)</option>
                    <option value="inactive">ถูกระงับ (Inactive)</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-medium"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium shadow-lg"
                >
                  {saving ? 'กำลังบันทึก...' : 'บันทึกผู้ใช้'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
