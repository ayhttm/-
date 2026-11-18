import React, { useState, useEffect } from 'react';
import { GoogleAuthStatus } from '../types';
import type { User as FirebaseUser } from 'firebase/auth';
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Layers,
  Save,
  LogOut,
  DownloadCloud,
  UploadCloud,
  ShieldAlert,
  X
} from 'lucide-react';
import { googleSignIn, googleLogout, getGoogleAccessToken } from '../lib/googleAuth';

interface GoogleSheetsPanelProps {
  googleAuth: GoogleAuthStatus;
  token: string;
  onRefreshAuth: (spreadsheetIdOverride?: string) => void;
  onGoogleConnected: (user: FirebaseUser, accessToken: string, spreadsheetIdOverride?: string) => void;
  onGoogleDisconnected: () => void;
}

type ConfirmActionType = 'init' | 'sync' | 'pull' | 'disconnect';

interface ConfirmDialogState {
  action: ConfirmActionType;
  title: string;
  description: string;
  confirmLabel: string;
  tone: 'warning' | 'danger' | 'info';
}

const REQUIRED_TABS = [
  { title: 'Users', desc: 'ข้อมูลผู้ใช้ & สิทธิ์' },
  { title: 'Categories', desc: 'หมวดหมู่การจัดเก็บ' },
  { title: 'Departments', desc: 'รายชื่อฝ่าย/กลุ่มงาน' },
  { title: 'Items', desc: 'ยอดคลังคงเหลือ & ราคา' },
  { title: 'StockIn', desc: 'ประวัติการรับเข้า' },
  { title: 'Requests', desc: 'คำขอเบิก & สต็อกออก' },
  { title: 'Settings', desc: 'การตั้งค่าระบบ' },
  { title: 'Sessions', desc: 'ประวัติการเข้าสู่ระบบ' }
];

export const GoogleSheetsPanel: React.FC<GoogleSheetsPanelProps> = ({
  googleAuth,
  token,
  onRefreshAuth,
  onGoogleConnected,
  onGoogleDisconnected
}) => {
  const [spreadsheetId, setSpreadsheetId] = useState(
    googleAuth.spreadsheetId || '10DfYf1oM8Vzp5NSIk9Rd9fvEcwqnet_A_c4WnzrzJU4'
  );
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);

  useEffect(() => {
    if (googleAuth.spreadsheetId) {
      setSpreadsheetId(googleAuth.spreadsheetId);
    }
  }, [googleAuth.spreadsheetId]);

  const handleConnectGoogle = async () => {
    setIsLoggingIn(true);
    setMessage(null);
    try {
      const { user, accessToken } = await googleSignIn();
      onGoogleConnected(user, accessToken, spreadsheetId);
      setMessage({
        type: 'success',
        text: `เชื่อมต่อบัญชี Google (${user.email}) สำเร็จแล้ว กำลังตรวจสอบสเปรดชีต...`
      });
    } catch (e: any) {
      const msg =
        e?.code === 'auth/popup-closed-by-user'
          ? 'ยกเลิกการเข้าสู่ระบบ Google (Popup ถูกปิด)'
          : e?.message || 'ไม่สามารถเข้าสู่ระบบ Google ได้';
      setMessage({ type: 'error', text: msg });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const executeDisconnect = async () => {
    setLoadingAction('disconnect');
    try {
      await googleLogout();
      onGoogleDisconnected();
      setMessage({ type: 'success', text: 'ยกเลิกการเชื่อมต่อบัญชี Google เรียบร้อยแล้ว' });
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || 'เกิดข้อผิดพลาดในการออกจากระบบ Google' });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSaveSpreadsheetId = async () => {
    setLoadingAction('save_id');
    setMessage(null);
    try {
      const res = await fetch('/api/sheets/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-App-Token': token
        },
        body: JSON.stringify({ spreadsheetId })
      });
      const json = await res.json();
      if (json.success) {
        setSpreadsheetId(json.spreadsheetId);
        setMessage({ type: 'success', text: json.message });
        onRefreshAuth(json.spreadsheetId);
      } else {
        setMessage({ type: 'error', text: json.message });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setLoadingAction(null);
    }
  };

  const requireAccessToken = (): string | null => {
    const accessToken = getGoogleAccessToken();
    if (!accessToken) {
      setMessage({
        type: 'error',
        text: 'Token สำหรับเชื่อมต่อ Google Sheets ไม่อยู่ในหน่วยความจำ กรุณากด "Sign in with Google" เพื่อเชื่อมต่อใหม่'
      });
      onGoogleDisconnected();
      return null;
    }
    return accessToken;
  };

  const executeInitSheets = async () => {
    const accessToken = requireAccessToken();
    if (!accessToken) return;

    setLoadingAction('init');
    setMessage(null);
    try {
      const res = await fetch('/api/sheets/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ spreadsheetId })
      });
      const json = await res.json();
      if (json.success) {
        setMessage({ type: 'success', text: json.message });
        onRefreshAuth(json.spreadsheetId || spreadsheetId);
      } else {
        setMessage({ type: 'error', text: json.message });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setLoadingAction(null);
    }
  };

  const executeSyncAll = async () => {
    const accessToken = requireAccessToken();
    if (!accessToken) return;

    setLoadingAction('sync');
    setMessage(null);
    try {
      const res = await fetch('/api/sheets/sync-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ spreadsheetId })
      });
      const json = await res.json();
      if (json.success) {
        setMessage({ type: 'success', text: json.message });
        onRefreshAuth(json.spreadsheetId || spreadsheetId);
      } else {
        setMessage({ type: 'error', text: json.message });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setLoadingAction(null);
    }
  };

  const executePullFromSheets = async () => {
    const accessToken = requireAccessToken();
    if (!accessToken) return;

    setLoadingAction('pull');
    setMessage(null);
    try {
      const res = await fetch('/api/sheets/pull', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ spreadsheetId })
      });
      const json = await res.json();
      if (json.success) {
        setMessage({ type: 'success', text: json.message });
        onRefreshAuth(spreadsheetId);
      } else {
        setMessage({ type: 'error', text: json.message });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmDialog) return;
    const action = confirmDialog.action;
    setConfirmDialog(null);
    if (action === 'init') await executeInitSheets();
    if (action === 'sync') await executeSyncAll();
    if (action === 'pull') await executePullFromSheets();
    if (action === 'disconnect') await executeDisconnect();
  };

  const targetSheetLabel = googleAuth.spreadsheetTitle
    ? `"${googleAuth.spreadsheetTitle}" (${googleAuth.spreadsheetId || spreadsheetId})`
    : spreadsheetId;

  const detectedTabs = new Set(googleAuth.sheets || []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/[0.03] backdrop-blur-md p-5 rounded-2xl border border-white/10 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
          การเชื่อมต่อและซิงค์ข้อมูล Google Sheets Live Sync
        </h2>
        <p className="text-xs font-mono text-cyan-400/70 tracking-wide mt-1">
          GOOGLE SHEETS API V4 // CLIENT-AUTHENTICATED SPREADSHEET SYNC
        </p>
      </div>

      {message && (
        <div
          className={`p-4 rounded-2xl text-xs font-mono flex items-center gap-3 border backdrop-blur-md ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
              : 'bg-rose-500/10 border-rose-500/40 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.2)]'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {googleAuth.connected && googleAuth.error && (
        <div className="p-4 rounded-2xl text-xs font-mono flex items-center gap-3 border bg-amber-500/10 border-amber-500/40 text-amber-300">
          <AlertCircle className="w-5 h-5 shrink-0 text-amber-400" />
          <span>ไม่สามารถเข้าถึงสเปรดชีตที่ระบุ: {googleAuth.error}</span>
        </div>
      )}

      {/* Grid Status & Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Account Connection Card */}
        <div className="bg-white/[0.03] backdrop-blur-md border border-white/10 p-6 rounded-2xl space-y-4 shadow-[0_0_25px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="text-sm font-bold text-slate-200">สถานะการเชื่อมต่อบัญชี Google</h3>
            <span
              className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border flex items-center gap-1 ${
                googleAuth.connected && !googleAuth.error
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                  : googleAuth.connected
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-slate-800/80 text-slate-400 border-white/10'
              }`}
            >
              {googleAuth.connected && !googleAuth.error ? (
                <>
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>ONLINE // AUTHENTICATED</span>
                </>
              ) : googleAuth.connected ? (
                <>
                  <AlertCircle className="w-3 h-3 text-amber-400" />
                  <span>SHEET ACCESS ERROR</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-3 h-3 text-slate-400" />
                  <span>DISCONNECTED</span>
                </>
              )}
            </span>
          </div>

          {googleAuth.connected && googleAuth.user ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-black/40 rounded-xl border border-white/10">
                {googleAuth.user.picture ? (
                  <img
                    src={googleAuth.user.picture}
                    alt={googleAuth.user.name || 'Google User'}
                    className="w-10 h-10 rounded-full border border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.4)]"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-white shadow-[0_0_10px_rgba(16,185,129,0.4)]">
                    {googleAuth.user.name?.charAt(0) || 'G'}
                  </div>
                )}
                <div className="flex-1 min-w-0 text-xs font-mono">
                  <div className="font-bold text-slate-100 truncate">{googleAuth.user.name}</div>
                  <div className="text-cyan-400/80 truncate">{googleAuth.user.email}</div>
                </div>
                <button
                  onClick={() =>
                    setConfirmDialog({
                      action: 'disconnect',
                      title: 'ยกเลิกการเชื่อมต่อบัญชี Google?',
                      description: `ต้องการออกจากระบบบัญชี ${googleAuth.user?.email || 'Google'} และล้างสิทธิ์การเชื่อมต่อชั่วคราวใช่หรือไม่?`,
                      confirmLabel: 'ยืนยันออกจากระบบ',
                      tone: 'danger'
                    })
                  }
                  className="p-2 text-rose-400 hover:bg-rose-500/20 rounded-xl border border-transparent hover:border-rose-500/30 transition"
                  title="เลิกเชื่อมต่อ"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>

              {googleAuth.spreadsheetTitle && (
                <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl text-xs space-y-1">
                  <div className="text-slate-400 font-mono text-[10px]">CONNECTED SPREADSHEET</div>
                  <div className="font-bold text-emerald-300">{googleAuth.spreadsheetTitle}</div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    พบแท็บในชีต {detectedTabs.size} แท็บ
                    {detectedTabs.size > 0 ? `: ${Array.from(detectedTabs).join(', ')}` : ''}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-slate-400 space-y-4">
              <p className="leading-relaxed">
                กรุณาลงชื่อเข้าใช้ด้วยบัญชี Google ที่มีสิทธิ์แก้ไขสเปรดชีต เพื่อเชื่อมต่อและซิงค์ข้อมูลคลังวัสดุอุปกรณ์กับ Google Sheets โดยตรง
              </p>
              <div className="flex justify-center sm:justify-start">
                <button
                  type="button"
                  onClick={handleConnectGoogle}
                  disabled={isLoggingIn}
                  className="gsi-material-button"
                >
                  <div className="gsi-material-button-state"></div>
                  <div className="gsi-material-button-content-wrapper">
                    <div className="gsi-material-button-icon">
                      <svg
                        version="1.1"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 48 48"
                        xmlnsXlink="http://www.w3.org/1999/xlink"
                        style={{ display: 'block' }}
                      >
                        <path
                          fill="#EA4335"
                          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                        ></path>
                        <path
                          fill="#4285F4"
                          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                        ></path>
                        <path
                          fill="#FBBC05"
                          d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                        ></path>
                        <path
                          fill="#34A853"
                          d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                        ></path>
                        <path fill="none" d="M0 0h48v48H0z"></path>
                      </svg>
                    </div>
                    <span className="gsi-material-button-contents">
                      {isLoggingIn ? 'Signing in...' : 'Sign in with Google'}
                    </span>
                    <span style={{ display: 'none' }}>Sign in with Google</span>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Spreadsheet Configuration Card */}
        <div className="bg-white/[0.03] backdrop-blur-md border border-white/10 p-6 rounded-2xl space-y-4 shadow-[0_0_25px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="text-sm font-bold text-slate-200">ตั้งค่า Google Spreadsheet ID</h3>
            {(googleAuth.spreadsheetId || spreadsheetId) && (
              <a
                href={`https://docs.google.com/spreadsheets/d/${googleAuth.spreadsheetId || spreadsheetId}/edit`}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium hover:underline"
              >
                <span>OPEN IN GOOGLE SHEETS</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-mono text-cyan-400/80 mb-1">
                SPREADSHEET ID OR GOOGLE SHEETS URL
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={spreadsheetId}
                  onChange={e => setSpreadsheetId(e.target.value)}
                  placeholder="เช่น 10DfYf1oM8Vzp5NSIk9Rd9fvEcwqnet_A_c4WnzrzJU4"
                  className="flex-1 px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-400 shadow-inner"
                />
                <button
                  onClick={handleSaveSpreadsheetId}
                  disabled={loadingAction === 'save_id'}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-cyan-300 border border-white/10 rounded-xl font-mono text-xs font-medium flex items-center gap-1 transition"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{loadingAction === 'save_id' ? 'SAVING...' : 'SAVE ID'}</span>
                </button>
              </div>
            </div>

            <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono">
              <button
                onClick={() =>
                  setConfirmDialog({
                    action: 'init',
                    title: 'สร้างแท็บและหัวตารางบน Google Sheets?',
                    description: `ระบบจะตรวจสอบและสร้างแท็บที่ยังขาดอยู่ทั้ง 8 แท็บ (${REQUIRED_TABS.map(t => t.title).join(', ')}) พร้อมเพิ่มหัวคอลัมน์ในแถวที่ 1 สำหรับสเปรดชีต ${targetSheetLabel} โดยไม่ลบข้อมูลเดิมที่มีอยู่`,
                    confirmLabel: 'สร้างแท็บ & หัวตาราง',
                    tone: 'info'
                  })
                }
                disabled={!googleAuth.connected || loadingAction !== null}
                className="py-2.5 px-3 bg-blue-600/30 hover:bg-blue-600/50 border border-blue-400/40 disabled:opacity-40 text-blue-200 font-medium rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(59,130,246,0.2)]"
              >
                <Layers className="w-4 h-4 shrink-0" />
                <span>{loadingAction === 'init' ? 'CREATING...' : 'สร้างแท็บ & หัวตาราง'}</span>
              </button>

              <button
                onClick={() =>
                  setConfirmDialog({
                    action: 'sync',
                    title: 'ยืนยันการซิงค์ข้อมูลลง Google Sheets?',
                    description: `การดำเนินการนี้จะเขียนทับข้อมูลตั้งแต่แถวที่ 2 ลงไปในทั้ง 8 แท็บของสเปรดชีต ${targetSheetLabel} ด้วยข้อมูลปัจจุบันจากระบบ`,
                    confirmLabel: 'ซิงค์ทับข้อมูลลง Sheet',
                    tone: 'warning'
                  })
                }
                disabled={!googleAuth.connected || loadingAction !== null}
                className="py-2.5 px-3 bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-400/40 disabled:opacity-40 text-emerald-200 font-medium rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
              >
                <UploadCloud className={`w-4 h-4 shrink-0 ${loadingAction === 'sync' ? 'animate-pulse' : ''}`} />
                <span>{loadingAction === 'sync' ? 'PUSHING...' : 'ซิงค์ลง Sheet (Push)'}</span>
              </button>

              <button
                onClick={() =>
                  setConfirmDialog({
                    action: 'pull',
                    title: 'ยืนยันการดึงข้อมูลจาก Google Sheets?',
                    description: `ระบบจะอ่านข้อมูลจากสเปรดชีต ${targetSheetLabel} มาอัปเดตข้อมูลในแอปพลิเคชันปัจจุบัน (รายการวัสดุ หมวดหมู่ ฝ่ายงาน รับเข้า คำขอเบิก และผู้ใช้)`,
                    confirmLabel: 'ดึงข้อมูลเข้าแอป',
                    tone: 'info'
                  })
                }
                disabled={!googleAuth.connected || loadingAction !== null}
                className="py-2.5 px-3 bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-400/40 disabled:opacity-40 text-cyan-200 font-medium rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(34,211,238,0.2)]"
              >
                <DownloadCloud className={`w-4 h-4 shrink-0 ${loadingAction === 'pull' ? 'animate-pulse' : ''}`} />
                <span>{loadingAction === 'pull' ? 'PULLING...' : 'ดึงจาก Sheet (Pull)'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs list preview */}
      <div className="bg-white/[0.03] backdrop-blur-md border border-white/10 p-6 rounded-2xl space-y-3 shadow-[0_0_25px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <h3 className="text-sm font-bold text-slate-200">
            โครงสร้างตารางข้อมูลที่จะถูกซิงค์ลงใน Google Sheets
          </h3>
          {googleAuth.connected && !googleAuth.error && (
            <button
              onClick={() => onRefreshAuth(spreadsheetId)}
              className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>รีเฟรชสถานะแท็บ</span>
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          {REQUIRED_TABS.map(t => {
            const exists = detectedTabs.has(t.title);
            return (
              <div
                key={t.title}
                className={`p-3 bg-black/40 rounded-xl border transition ${
                  googleAuth.connected && !googleAuth.error
                    ? exists
                      ? 'border-emerald-500/40'
                      : 'border-amber-500/30'
                    : 'border-white/10 hover:border-cyan-400/30'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <div className="font-bold text-cyan-400 font-mono">{t.title}</div>
                  {googleAuth.connected && !googleAuth.error && (
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                        exists
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {exists ? 'READY' : 'MISSING'}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">{t.desc}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Explicit Confirmation Modal for Mutating Operations */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#080d1a]/95 border border-white/15 rounded-2xl max-w-md w-full p-6 shadow-[0_0_50px_rgba(34,211,238,0.2)] space-y-4 relative">
            <button
              onClick={() => setConfirmDialog(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-xl bg-white/5 border border-white/10"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                  confirmDialog.tone === 'danger'
                    ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                    : confirmDialog.tone === 'warning'
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                      : 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400'
                }`}
              >
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="space-y-1 pr-6">
                <h3 className="text-base font-bold text-slate-100">{confirmDialog.title}</h3>
                <p className="text-xs text-slate-300 leading-relaxed">{confirmDialog.description}</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 font-mono text-xs">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl border border-white/10 transition"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                className={`px-4 py-2 rounded-xl font-bold transition ${
                  confirmDialog.tone === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-500 text-white'
                    : confirmDialog.tone === 'warning'
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                      : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950'
                }`}
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
