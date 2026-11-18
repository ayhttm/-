import React, { useState } from 'react';
import { User } from '../types';
import { User as UserIcon, X, CheckCircle2, AlertCircle } from 'lucide-react';

interface ProfileModalProps {
  currentUser: User;
  token: string;
  departments: string[];
  onClose: () => void;
  onRefresh: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  currentUser,
  token,
  departments,
  onClose,
  onRefresh
}) => {
  const [formData, setFormData] = useState({
    fullname: currentUser.fullname,
    phone: currentUser.phone || '',
    position: currentUser.position || '',
    department: currentUser.department || departments[0] || 'บริหารทั่วไป',
    new_password: ''
  });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/users/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const json = await res.json();
      if (json.success) {
        setMessage({ type: 'success', text: json.message });
        setTimeout(() => {
          onRefresh();
          onClose();
        }, 1200);
      } else {
        setMessage({ type: 'error', text: json.message });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#080d1a]/90 backdrop-blur-2xl border border-white/10 rounded-2xl max-w-md w-full p-6 shadow-[0_0_50px_rgba(34,211,238,0.2)] space-y-4 relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-xl bg-white/5 border border-white/10 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-lg text-slate-950 shadow-[0_0_15px_rgba(34,211,238,0.4)]">
            {currentUser.fullname.charAt(0)}
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">{currentUser.fullname}</h3>
            <p className="text-xs font-mono text-cyan-400">
              @{currentUser.username} • {currentUser.role}
            </p>
          </div>
        </div>

        {message && (
          <div
            className={`p-3 rounded-xl text-xs font-mono flex items-center gap-2 border ${
              message.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                : 'bg-rose-500/10 border-rose-500/40 text-rose-300 shadow-[0_0_10px_rgba(244,63,94,0.2)]'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block font-mono text-cyan-400/80 mb-1">ชื่อ-นามสกุล *</label>
            <input
              type="text"
              required
              value={formData.fullname}
              onChange={e => setFormData({ ...formData, fullname: e.target.value })}
              className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-400 shadow-inner"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-mono text-cyan-400/80 mb-1">เบอร์โทรศัพท์</label>
              <input
                type="text"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-400"
              />
            </div>
            <div>
              <label className="block font-mono text-cyan-400/80 mb-1">ตำแหน่ง</label>
              <input
                type="text"
                value={formData.position}
                onChange={e => setFormData({ ...formData, position: e.target.value })}
                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          <div>
            <label className="block font-mono text-cyan-400/80 mb-1">ฝ่าย / กลุ่มงาน</label>
            <select
              value={formData.department}
              onChange={e => setFormData({ ...formData, department: e.target.value })}
              className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-400"
            >
              {departments.map((d, idx) => (
                <option key={idx} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-mono text-cyan-400/80 mb-1">
              เปลี่ยนรหัสผ่านใหม่ (เว้นว่างหากไม่เปลี่ยน)
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={formData.new_password}
              onChange={e => setFormData({ ...formData, new_password: e.target.value })}
              className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2 font-mono">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl font-medium border border-white/10 transition"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 rounded-xl font-bold transition shadow-[0_0_15px_rgba(34,211,238,0.3)]"
            >
              {saving ? 'SAVING...' : 'SAVE CHANGES'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
