import React, { useState } from 'react';
import { Package, Lock, User as UserIcon, LogIn, AlertCircle } from 'lucide-react';

interface LoginModalProps {
  onLogin: (username: string, password: string) => Promise<boolean>;
  onOpenRegister: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onLogin, onOpenRegister }) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const success = await onLogin(username, password);
      if (!success) {
        setError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง หรือบัญชีรออนุมัติ');
      }
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 items-center justify-center text-emerald-400 mb-2 shadow-inner">
            <Package className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-100 tracking-tight">เข้าสู่ระบบคลังวัสดุ</h2>
          <p className="text-xs text-slate-400">
            ระบบบริหารจัดการคลังวัสดุอุปกรณ์ (Inventory Management System)
          </p>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              ชื่อผู้ใช้งาน (Username)
            </label>
            <div className="relative">
              <UserIcon className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                required
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="เช่น admin หรือ user"
                className="w-full pl-9 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              รหัสผ่าน (Password)
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white font-semibold text-sm rounded-xl transition shadow-lg flex items-center justify-center gap-2"
          >
            <LogIn className="w-4 h-4" />
            <span>{loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}</span>
          </button>
        </form>

        <div className="border-t border-slate-800 pt-4 text-center space-y-2">
          <div className="text-xs text-slate-400">
            ยังไม่มีบัญชีผู้ใช้งาน?{' '}
            <button
              onClick={onOpenRegister}
              className="text-emerald-400 hover:underline font-semibold"
            >
              ลงทะเบียนใหม่
            </button>
          </div>
          <div className="p-3 rounded-xl bg-slate-800/50 text-[11px] text-slate-400 text-left space-y-1">
            <div className="font-semibold text-slate-300">ตัวอย่างผู้ใช้เริ่มต้น:</div>
            <div>• Admin: admin / admin123</div>
            <div>• User: user / user123</div>
          </div>
        </div>
      </div>
    </div>
  );
};
