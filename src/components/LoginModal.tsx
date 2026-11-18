import React, { useState } from 'react';
import { Package, Lock, User as UserIcon, LogIn, AlertCircle } from 'lucide-react';

export interface LoginResult {
  success: boolean;
  message?: string;
}

interface LoginModalProps {
  onLogin: (username: string, password: string) => Promise<LoginResult>;
  onGoogleLogin?: () => Promise<LoginResult>;
  onOpenRegister: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  onLogin,
  onGoogleLogin,
  onOpenRegister
}) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await onLogin(username, password);
      if (!result.success) {
        setError(result.message || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง หรือบัญชีรออนุมัติ');
      }
    } catch (err: any) {
      setError(err?.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleClick = async () => {
    if (!onGoogleLogin) return;
    setError(null);
    setGoogleLoading(true);
    try {
      const result = await onGoogleLogin();
      if (!result.success) {
        setError(result.message || 'ไม่สามารถเข้าสู่ระบบด้วย Google ได้');
      }
    } catch (err: any) {
      setError(err?.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบด้วย Google');
    } finally {
      setGoogleLoading(false);
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
                autoComplete="username"
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
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || googleLoading}
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white font-semibold text-sm rounded-xl transition shadow-lg flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            <span>{loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}</span>
          </button>
        </form>

        {onGoogleLogin && (
          <div className="space-y-3">
            <div className="relative flex items-center justify-center">
              <div className="border-t border-slate-800 w-full" />
              <span className="bg-slate-900 px-3 text-[11px] text-slate-500 whitespace-nowrap">
                หรือเข้าสู่ระบบด้วยบัญชี Google
              </span>
              <div className="border-t border-slate-800 w-full" />
            </div>

            <button
              type="button"
              onClick={handleGoogleClick}
              disabled={loading || googleLoading}
              className="gsi-material-button w-full"
            >
              <div className="gsi-material-button-state" />
              <div className="gsi-material-button-content-wrapper">
                <div className="gsi-material-button-icon">
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block' }}>
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                    <path fill="none" d="M0 0h48v48H0z" />
                  </svg>
                </div>
                <span className="gsi-material-button-contents">
                  {googleLoading ? 'กำลังเชื่อมต่อ Google...' : 'Sign in with Google'}
                </span>
              </div>
            </button>
          </div>
        )}

        <div className="border-t border-slate-800 pt-4 text-center space-y-2">
          <div className="text-xs text-slate-400">
            ยังไม่มีบัญชีผู้ใช้งาน?{' '}
            <button
              type="button"
              onClick={onOpenRegister}
              className="text-emerald-400 hover:underline font-semibold cursor-pointer"
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
