import React, { useState, useEffect } from 'react';
import { User, Category, Department, Item, GoogleAuthStatus } from './types';
import { Header } from './components/Header';
import { Sidebar, TabType } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { ItemsView } from './components/ItemsView';
import { StockInView } from './components/StockInView';
import { RequestsView } from './components/RequestsView';
import { MasterDataView } from './components/MasterDataView';
import { ReportsView } from './components/ReportsView';
import { UsersView } from './components/UsersView';
import { GoogleSheetsPanel } from './components/GoogleSheetsPanel';
import { LoginModal } from './components/LoginModal';
import { RegisterModal } from './components/RegisterModal';
import { ProfileModal } from './components/ProfileModal';
import { RefreshCw } from 'lucide-react';
import { initGoogleAuth, googleSignIn, googleLogout, getGoogleAccessToken, getCurrentGoogleUser } from './lib/googleAuth';
import type { User as FirebaseUser } from 'firebase/auth';
import {
  readPersisted,
  writePersisted,
  safeGetStorageItem,
  safeSetStorageItem,
  safeRemoveStorageItem
} from './lib/persistedState';
import { fetchJsonWithRetry } from './lib/safeFetch';

const DEFAULT_SPREADSHEET_ID = '10DfYf1oM8Vzp5NSIk9Rd9fvEcwqnet_A_c4WnzrzJU4';
const VALID_TABS: TabType[] = [
  'dashboard',
  'items',
  'stockin',
  'requests',
  'masterdata',
  'reports',
  'users',
  'googlesheets'
];

export default function App() {
  const [token, setToken] = useState<string | null>(() => safeGetStorageItem('inventory_token'));
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [notifications, setNotifications] = useState({
    pending_users: 0,
    pending_approvals: 0,
    my_updated_requests: 0
  });
  const [googleAuth, setGoogleAuth] = useState<GoogleAuthStatus>({ connected: false });

  const [activeTab, setActiveTabState] = useState<TabType>(() => {
    const saved = readPersisted<TabType>('inventory_active_tab', 'dashboard');
    return VALID_TABS.includes(saved) ? saved : 'dashboard';
  });
  const setActiveTab = (tab: TabType) => {
    setActiveTabState(tab);
    writePersisted('inventory_active_tab', tab);
  };
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Modals state
  const [registerOpen, setRegisterOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedReqItem, setSelectedReqItem] = useState<Item | null>(null);

  const fetchInitialData = async (authToken?: string) => {
    const useToken = authToken || token;
    if (!useToken) {
      setLoadingInitial(false);
      return;
    }

    try {
      const { data: json } = await fetchJsonWithRetry(
        `/api/initial-data?token=${encodeURIComponent(useToken)}`,
        {
          headers: { Authorization: `Bearer ${useToken}` }
        }
      );
      if (json.success) {
        setCurrentUser(json.currentUser);
        setCategories(json.categories);
        setItems(json.items);
        setDepartments(json.departments);
        setSettings(json.settings);
        setNotifications(json.notifications);
        const configuredId = json.settings?.spreadsheet_id || DEFAULT_SPREADSHEET_ID;
        setGoogleAuth(prev => ({
          ...prev,
          spreadsheetId: prev.spreadsheetId || configuredId
        }));
      } else {
        // Token invalid or expired
        safeRemoveStorageItem('inventory_token');
        setToken(null);
        setCurrentUser(null);
      }
    } catch (err) {
      console.error('Failed to load initial data:', err);
    } finally {
      setLoadingInitial(false);
    }
  };

  const verifyGoogleSheetsStatus = async (
    overrideSpreadsheetId?: string,
    overrideToken?: string,
    overrideUser?: FirebaseUser | null
  ) => {
    const accessToken = overrideToken || getGoogleAccessToken();
    const fbUser = overrideUser !== undefined ? overrideUser : getCurrentGoogleUser();
    const targetId = overrideSpreadsheetId || settings.spreadsheet_id || googleAuth.spreadsheetId || DEFAULT_SPREADSHEET_ID;

    if (!accessToken || !fbUser) {
      setGoogleAuth({
        connected: false,
        spreadsheetId: targetId
      });
      return;
    }

    try {
      const res = await fetch(`/api/sheets/status?spreadsheetId=${encodeURIComponent(targetId)}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      const json = await res.json();
      setGoogleAuth({
        connected: true,
        user: {
          name: fbUser.displayName || fbUser.email || 'Google User',
          email: fbUser.email || '',
          picture: fbUser.photoURL || undefined
        },
        spreadsheetId: json.spreadsheetId || targetId,
        spreadsheetTitle: json.spreadsheetTitle,
        sheets: json.sheets || [],
        error: json.success ? undefined : json.message
      });
    } catch (err: any) {
      setGoogleAuth({
        connected: true,
        user: {
          name: fbUser.displayName || fbUser.email || 'Google User',
          email: fbUser.email || '',
          picture: fbUser.photoURL || undefined
        },
        spreadsheetId: targetId,
        error: err.message
      });
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, [token]);

  useEffect(() => {
    const unsubscribe = initGoogleAuth(
      (fbUser, accessToken) => {
        verifyGoogleSheetsStatus(undefined, accessToken, fbUser);
      },
      () => {
        setGoogleAuth(prev => ({
          connected: false,
          spreadsheetId: prev.spreadsheetId || settings.spreadsheet_id || DEFAULT_SPREADSHEET_ID
        }));
      }
    );
    return () => unsubscribe();
  }, []);

  const handleLogin = async (
    username: string,
    password: string
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      const { data: json } = await fetchJsonWithRetry('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password })
      });
      if (json.success && json.token) {
        safeSetStorageItem('inventory_token', json.token);
        setCurrentUser(json.user);
        setToken(json.token);
        return { success: true, message: json.message };
      }
      return {
        success: false,
        message: json.message || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'
      };
    } catch (e: any) {
      return {
        success: false,
        message: e?.message || 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง'
      };
    }
  };

  const handleGoogleAppLogin = async (): Promise<{ success: boolean; message?: string }> => {
    try {
      const { user, accessToken } = await googleSignIn();
      const { data: json } = await fetchJsonWithRetry('/api/auth/google-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          name: user.displayName || '',
          picture: user.photoURL || ''
        })
      });
      if (json.success && json.token) {
        safeSetStorageItem('inventory_token', json.token);
        setCurrentUser(json.user);
        setToken(json.token);
        verifyGoogleSheetsStatus(undefined, accessToken, user);
        return { success: true, message: json.message };
      }
      return {
        success: false,
        message: json.message || 'ไม่สามารถเข้าสู่ระบบด้วย Google ได้'
      };
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        return { success: false, message: 'ยกเลิกการเข้าสู่ระบบด้วย Google' };
      }
      if (err?.code === 'auth/popup-blocked') {
        return { success: false, message: 'เบราว์เซอร์บล็อกหน้าต่างป๊อปอัป กรุณาอนุญาตป๊อปอัปแล้วลองใหม่' };
      }
      return {
        success: false,
        message: err?.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบด้วย Google'
      };
    }
  };

  const handleLogout = async () => {
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (e) {
        // Ignore logout error
      }
    }
    await googleLogout().catch(() => {});
    safeRemoveStorageItem('inventory_token');
    setToken(null);
    setCurrentUser(null);
  };

  const handleRegister = async (data: any) => {
    try {
      const { data: json } = await fetchJsonWithRetry('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return json;
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้'
      };
    }
  };

  const handleRequestRequisitionItem = (item: Item) => {
    setSelectedReqItem(item);
    setActiveTab('requests');
  };

  const departmentList =
    departments.length > 0
      ? departments.map(d => d.department_name)
      : ['บริหารทั่วไป', 'ฝ่ายปฏิบัติการ', 'ฝ่ายเทคโนโลยีสารสนเทศ', 'ฝ่ายการเงินและบัญชี'];

  if (loadingInitial) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-300">
        <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl">
          <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
          <span className="font-semibold text-sm">กำลังเปิดระบบคลังวัสดุอุปกรณ์...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020408] text-slate-200 flex flex-col font-sans antialiased relative overflow-x-hidden">
      {/* Immersive Background Atmosphere */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-cyan-600/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] bg-purple-900/15 rounded-full blur-[160px]" />
        <div className="absolute top-[40%] right-[20%] w-[35vw] h-[35vw] bg-blue-900/10 rounded-full blur-[130px]" />
      </div>

      {/* Header */}
      <Header
        currentUser={currentUser}
        googleAuth={googleAuth}
        notifications={notifications}
        onOpenProfile={() => setProfileOpen(true)}
        onOpenGooglePanel={() => setActiveTab('googlesheets')}
        onLogout={handleLogout}
        onNavigateToRequests={() => setActiveTab('requests')}
        onNavigateToUsers={() => setActiveTab('users')}
      />

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden z-10 relative">
        {/* Sidebar */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          currentUser={currentUser}
          notifications={notifications}
        />

        {/* Content Area */}
        <main className="flex-1 p-6 overflow-y-auto max-w-7xl mx-auto w-full space-y-6">
          {activeTab === 'dashboard' && token && (
            <DashboardView token={token} onNavigateToTab={setActiveTab} />
          )}

          {activeTab === 'items' && token && (
            <ItemsView
              items={items}
              categories={categories}
              currentUser={currentUser}
              token={token}
              onRefresh={() => fetchInitialData()}
              onRequestRequisition={handleRequestRequisitionItem}
            />
          )}

          {activeTab === 'stockin' && token && (
            <StockInView items={items} token={token} onRefresh={() => fetchInitialData()} />
          )}

          {activeTab === 'requests' && token && (
            <RequestsView
              items={items}
              currentUser={currentUser}
              token={token}
              selectedItemForReq={selectedReqItem}
              onRefresh={() => {
                setSelectedReqItem(null);
                fetchInitialData();
              }}
            />
          )}

          {activeTab === 'masterdata' && token && (
            <MasterDataView
              categories={categories}
              departments={departments}
              token={token}
              onRefresh={() => fetchInitialData()}
            />
          )}

          {activeTab === 'reports' && token && (
            <ReportsView
              categories={categories}
              token={token}
              currentUser={currentUser}
              onSyncGoogleSheet={() => setActiveTab('googlesheets')}
            />
          )}

          {activeTab === 'users' && token && (
            <UsersView
              token={token}
              departments={departmentList}
              onRefresh={() => fetchInitialData()}
            />
          )}

          {activeTab === 'googlesheets' && token && (
            <GoogleSheetsPanel
              googleAuth={googleAuth}
              token={token}
              onRefreshAuth={(idOverride?: string) => {
                fetchInitialData();
                verifyGoogleSheetsStatus(idOverride);
              }}
              onGoogleConnected={(fbUser, accessToken, idOverride) => {
                verifyGoogleSheetsStatus(idOverride, accessToken, fbUser);
              }}
              onGoogleDisconnected={() => {
                setGoogleAuth(prev => ({
                  connected: false,
                  spreadsheetId: prev.spreadsheetId || settings.spreadsheet_id || DEFAULT_SPREADSHEET_ID
                }));
              }}
            />
          )}
        </main>
      </div>

      {/* Login Modal */}
      {!currentUser && (
        <LoginModal
          onLogin={handleLogin}
          onGoogleLogin={handleGoogleAppLogin}
          onOpenRegister={() => setRegisterOpen(true)}
        />
      )}

      {/* Registration Modal */}
      {registerOpen && (
        <RegisterModal
          onClose={() => setRegisterOpen(false)}
          onRegister={handleRegister}
          departments={departmentList}
        />
      )}

      {/* Profile Modal */}
      {profileOpen && currentUser && token && (
        <ProfileModal
          currentUser={currentUser}
          token={token}
          departments={departmentList}
          onClose={() => setProfileOpen(false)}
          onRefresh={() => fetchInitialData()}
        />
      )}
    </div>
  );
}
