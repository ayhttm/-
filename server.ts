import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { store } from './server/store.js';
import {
  getSpreadsheetDetails,
  syncAllToSheets,
  ensureSheetTabsAndHeaders,
  pullAllFromSheets,
  extractSpreadsheetId,
  DEFAULT_SPREADSHEET_ID
} from './server/sheets.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser('inventory_secret_key_2026'));

  const extractGoogleBearerToken = (req: express.Request): string | null => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.slice(7).trim();
    return token || null;
  };

  // --------------------------------------------------------------------------
  // GOOGLE SHEETS LIVE SYNC ROUTES (Client-Side OAuth Bearer Token)
  // --------------------------------------------------------------------------
  app.get('/api/sheets/status', async (req, res) => {
    try {
      const accessToken = extractGoogleBearerToken(req);
      if (!accessToken) {
        return res.status(401).json({ success: false, message: 'กรุณาเชื่อมต่อ Google Account ก่อน' });
      }
      const requestedId = (req.query.spreadsheetId as string) || store.settings.spreadsheet_id || DEFAULT_SPREADSHEET_ID;
      const details = await getSpreadsheetDetails(accessToken, requestedId);

      res.json({
        success: true,
        spreadsheetId: details.spreadsheetId,
        spreadsheetTitle: details.title,
        sheets: details.sheets
      });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.post('/api/sheets/config', (req, res) => {
    try {
      const appToken = (req.headers['x-app-token'] as string) || '';
      if (appToken) {
        const currentUser = store.verifyToken(appToken);
        if (currentUser.role !== 'Admin') {
          return res.status(403).json({ success: false, message: 'เฉพาะ Admin เท่านั้นที่สามารถแก้ไข Spreadsheet ID ได้' });
        }
      }
      const { spreadsheetId } = req.body;
      const extractedId = extractSpreadsheetId(spreadsheetId);
      if (!extractedId) {
        return res.status(400).json({ success: false, message: 'กรุณาระบุ Spreadsheet ID หรือ URL ของ Google Sheets' });
      }
      store.settings.spreadsheet_id = extractedId;
      store.save();
      res.json({
        success: true,
        message: 'บันทึก Spreadsheet ID เรียบร้อยแล้ว',
        spreadsheetId: store.settings.spreadsheet_id
      });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.post('/api/sheets/init', async (req, res) => {
    try {
      const accessToken = extractGoogleBearerToken(req);
      if (!accessToken) {
        return res.status(401).json({ success: false, message: 'กรุณาเข้าสู่ระบบ Google ก่อนดำเนินการ' });
      }
      const requestedId = req.body?.spreadsheetId || store.settings.spreadsheet_id || DEFAULT_SPREADSHEET_ID;
      const spreadsheetId = extractSpreadsheetId(requestedId);
      store.settings.spreadsheet_id = spreadsheetId;
      store.save();

      const updated = await ensureSheetTabsAndHeaders(accessToken, spreadsheetId);

      res.json({
        success: true,
        message: 'สร้างแท็บตารางและหัวคอลัมน์บน Google Sheets สำเร็จแล้ว!',
        spreadsheetId: updated.spreadsheetId,
        spreadsheetTitle: updated.title,
        sheets: updated.sheets
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการสร้างแท็บตาราง: ' + err.message });
    }
  });

  app.post('/api/sheets/sync-all', async (req, res) => {
    try {
      const accessToken = extractGoogleBearerToken(req);
      if (!accessToken) {
        return res.status(401).json({ success: false, message: 'กรุณาเข้าสู่ระบบ Google ก่อนดำเนินการ' });
      }
      const requestedId = req.body?.spreadsheetId || store.settings.spreadsheet_id || DEFAULT_SPREADSHEET_ID;
      const spreadsheetId = extractSpreadsheetId(requestedId);
      store.settings.spreadsheet_id = spreadsheetId;
      store.save();

      await syncAllToSheets(accessToken, spreadsheetId);
      const details = await getSpreadsheetDetails(accessToken, spreadsheetId);

      res.json({
        success: true,
        message: 'ซิงค์ข้อมูลทั้งหมดจากระบบไปยัง Google Sheets สำเร็จแล้ว!',
        spreadsheetId: details.spreadsheetId,
        spreadsheetTitle: details.title,
        sheets: details.sheets
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: 'การซิงค์ล้มเหลว: ' + err.message });
    }
  });

  app.post('/api/sheets/pull', async (req, res) => {
    try {
      const accessToken = extractGoogleBearerToken(req);
      if (!accessToken) {
        return res.status(401).json({ success: false, message: 'กรุณาเข้าสู่ระบบ Google ก่อนดำเนินการ' });
      }
      const requestedId = req.body?.spreadsheetId || store.settings.spreadsheet_id || DEFAULT_SPREADSHEET_ID;
      const spreadsheetId = extractSpreadsheetId(requestedId);
      store.settings.spreadsheet_id = spreadsheetId;

      const counts = await pullAllFromSheets(accessToken, spreadsheetId);
      store.save();
      res.json({
        success: true,
        message: `ดึงข้อมูลจาก Google Sheets เข้าสู่ระบบสำเร็จ (Items: ${counts.Items || 0}, Requests: ${counts.Requests || 0}, StockIn: ${counts.StockIn || 0})`,
        counts
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: 'การดึงข้อมูลล้มเหลว: ' + err.message });
    }
  });

  // --------------------------------------------------------------------------
  // APP AUTHENTICATION & SESSIONS
  // --------------------------------------------------------------------------
  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });
    }

    const hashed = store.hashPassword(password);
    const user = store.users.find(u => u.username === username && u.password === hashed);

    if (!user) {
      return res.json({ success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }

    if (user.status === 'pending') {
      return res.json({ success: false, message: 'บัญชีนี้กำลังรอการอนุมัติจากผู้ดูแลระบบ' });
    }
    if (user.status !== 'active') {
      return res.json({ success: false, message: `บัญชีนี้ถูกระงับการใช้งาน (${user.status})` });
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    const session = {
      token,
      user_id: user.user_id,
      expires_at: expiresAt,
      created_at: new Date().toISOString()
    };
    store.sessions.push(session);
    store.save();

    const safeUser = { ...user };
    delete safeUser.password;

    res.json({
      success: true,
      message: 'เข้าสู่ระบบสำเร็จ',
      token,
      expires_at: expiresAt,
      user: safeUser
    });
  });

  app.post('/api/auth/register', (req, res) => {
    const { username, password, fullname, phone, position, department } = req.body;
    if (!username || !password || !fullname) {
      return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน' });
    }

    if (store.users.some(u => u.username === username)) {
      return res.json({ success: false, message: 'ชื่อผู้ใช้งานนี้ถูกใช้ไปแล้ว' });
    }

    const newUser = {
      user_id: store.generateId('USR'),
      username,
      password: store.hashPassword(password),
      fullname,
      phone: phone || '',
      position: position || '',
      role: 'User' as const,
      department: department || 'ฝ่ายปฏิบัติการ',
      status: 'pending' as const,
      approval_note: '',
      profile_photo: '',
      created_at: new Date().toISOString()
    };

    store.users.push(newUser);
    store.save();
    res.json({ success: true, message: 'ลงทะเบียนสำเร็จ! กรุณารอผู้ดูแลระบบอนุมัติบัญชี' });
  });

  app.post('/api/auth/logout', (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '') || req.body.token;
    if (token) {
      store.sessions = store.sessions.filter(s => s.token !== token);
      store.save();
    }
    res.json({ success: true, message: 'ออกจากระบบสำเร็จ' });
  });

  // --------------------------------------------------------------------------
  // INITIAL DATA & DASHBOARD
  // --------------------------------------------------------------------------
  app.get('/api/initial-data', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace('Bearer ', '') || (req.query.token as string);
      const currentUser = store.verifyToken(token);

      const pendingUsers = store.users.filter(u => u.status === 'pending').length;
      const pendingApprovals = store.requests.filter(r => r.status === 'pending').length;
      const myUpdatedRequests = store.requests.filter(
        r => r.requester_id === currentUser.user_id && (r.status === 'approved' || r.status === 'rejected')
      ).length;

      const safeUser = { ...currentUser };
      delete safeUser.password;

      res.json({
        success: true,
        currentUser: safeUser,
        categories: store.categories,
        items: store.items,
        departments: store.departments,
        settings: store.settings,
        notifications: {
          pending_users: currentUser.role === 'Admin' ? pendingUsers : 0,
          pending_approvals: currentUser.role === 'Admin' ? pendingApprovals : 0,
          my_updated_requests: myUpdatedRequests
        }
      });
    } catch (err: any) {
      res.status(401).json({ success: false, message: err.message });
    }
  });

  app.get('/api/dashboard', (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace('Bearer ', '');
      const currentUser = store.verifyToken(token || '');

      const range = (req.query.range as string) || 'all';
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      const filterByDate = (list: any[], dateField: string) => {
        if (range === 'all') return list;
        const now = new Date();
        let start = new Date();
        let end = new Date();

        if (range === 'today') {
          start.setHours(0, 0, 0, 0);
          end.setHours(23, 59, 59, 999);
        } else if (range === 'week') {
          start.setDate(now.getDate() - 7);
        } else if (range === 'month') {
          start.setMonth(now.getMonth() - 1);
        } else if (range === 'year') {
          start.setFullYear(now.getFullYear() - 1);
        } else if (range === 'custom' && startDate && endDate) {
          start = new Date(startDate);
          end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
        } else {
          return list;
        }

        return list.filter(item => {
          const d = new Date(item[dateField]);
          return d >= start && d <= end;
        });
      };

      const filteredIn = filterByDate(store.stockIn, 'stockin_date');
      let filteredReq = filterByDate(store.requests, 'request_date');

      if (currentUser.role !== 'Admin') {
        filteredReq = filteredReq.filter(r => r.requester_id === currentUser.user_id);
      }

      const totalItems = store.items.length;
      const totalStockValue = store.items.reduce((sum, i) => sum + (Number(i.current_balance) || 0) * (Number(i.unit_price) || 0), 0);
      const totalInQty = filteredIn.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);

      const approvedReqs = filteredReq.filter(r => r.status === 'approved');
      const totalOutQty = approvedReqs.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
      const totalOutValue = approvedReqs.reduce((sum, r) => sum + (Number(r.total_amount) || 0), 0);

      const outOfStockCount = store.items.filter(i => (Number(i.current_balance) || 0) <= 0).length;
      const lowStockCount = store.items.filter(i => {
        const bal = Number(i.current_balance) || 0;
        const min = Number(i.min_stock) || 0;
        return bal > 0 && bal <= min;
      }).length;

      // Top 10 Most Withdrawn
      const itemOutMap: Record<string, number> = {};
      approvedReqs.forEach(r => {
        itemOutMap[r.item_name] = (itemOutMap[r.item_name] || 0) + Number(r.quantity);
      });
      const topWithdrawn = Object.keys(itemOutMap)
        .map(k => ({ name: k, qty: itemOutMap[k] }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 10);

      // Category Out Map
      const catOutMap: Record<string, number> = {};
      approvedReqs.forEach(r => {
        catOutMap[r.category_name] = (catOutMap[r.category_name] || 0) + Number(r.total_amount);
      });

      res.json({
        success: true,
        summary: {
          totalItems,
          totalStockValue,
          totalInQty,
          totalOutQty,
          totalOutValue,
          outOfStockCount,
          lowStockCount
        },
        topWithdrawn,
        catOutMap,
        recentStockIn: [...filteredIn].slice(-5).reverse(),
        recentRequests: [...filteredReq].slice(-5).reverse()
      });
    } catch (err: any) {
      res.status(401).json({ success: false, message: err.message });
    }
  });

  // --------------------------------------------------------------------------
  // MASTER DATA: ITEMS
  // --------------------------------------------------------------------------
  app.get('/api/items', (req, res) => {
    res.json({ success: true, data: store.items });
  });

  app.post('/api/items', (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace('Bearer ', '');
      const currentUser = store.verifyToken(token || '');
      if (currentUser.role !== 'Admin') {
        return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์การใช้งาน (Admin Only)' });
      }

      const data = req.body;
      if (data.item_id) {
        const idx = store.items.findIndex(i => i.item_id === data.item_id);
        if (idx !== -1) {
          store.items[idx] = {
            ...store.items[idx],
            item_code: data.item_code,
            item_name: data.item_name,
            category_id: data.category_id,
            category_name: data.category_name,
            unit: data.unit,
            unit_price: Number(data.unit_price) || 0,
            min_stock: Number(data.min_stock) || 0,
            status: data.status || 'active',
            note: data.note || ''
          };
        }
      } else {
        const openBal = Number(data.opening_balance) || 0;
        const newItem = {
          item_id: store.generateId('ITM'),
          item_code: data.item_code,
          item_name: data.item_name,
          category_id: data.category_id,
          category_name: data.category_name,
          unit: data.unit,
          unit_price: Number(data.unit_price) || 0,
          opening_balance: openBal,
          current_balance: openBal,
          min_stock: Number(data.min_stock) || 0,
          status: data.status || 'active',
          note: data.note || '',
          created_at: new Date().toISOString()
        };
        store.items.push(newItem);
      }

      store.save();
      res.json({ success: true, message: 'บันทึกข้อมูลวัสดุเรียบร้อย' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.delete('/api/items/:id', (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace('Bearer ', '');
      const currentUser = store.verifyToken(token || '');
      if (currentUser.role !== 'Admin') {
        return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์การใช้งาน' });
      }

      const idx = store.items.findIndex(i => i.item_id === req.params.id);
      if (idx !== -1) {
        store.items[idx].status = 'inactive';
        store.save();
      }
      res.json({ success: true, message: 'ยกเลิกใช้งานวัสดุเรียบร้อย (Soft Delete)' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // --------------------------------------------------------------------------
  // MASTER DATA: CATEGORIES & DEPARTMENTS
  // --------------------------------------------------------------------------
  app.get('/api/categories', (req, res) => {
    res.json({ success: true, data: store.categories });
  });

  app.post('/api/categories', (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace('Bearer ', '');
      const currentUser = store.verifyToken(token || '');
      if (currentUser.role !== 'Admin') {
        return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์การใช้งาน' });
      }

      const data = req.body;
      if (data.category_id) {
        const idx = store.categories.findIndex(c => c.category_id === data.category_id);
        if (idx !== -1) {
          store.categories[idx] = {
            ...store.categories[idx],
            category_name: data.category_name,
            description: data.description,
            status: data.status
          };
        }
      } else {
        store.categories.push({
          category_id: store.generateId('CAT'),
          category_name: data.category_name,
          description: data.description || '',
          status: data.status || 'active',
          created_at: new Date().toISOString()
        });
      }
      store.save();
      res.json({ success: true, message: 'บันทึกประเภทวัสดุเรียบร้อย' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.delete('/api/categories/:id', (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace('Bearer ', '');
      const currentUser = store.verifyToken(token || '');
      if (currentUser.role !== 'Admin') {
        return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์การใช้งาน' });
      }

      store.categories = store.categories.filter(c => c.category_id !== req.params.id);
      store.save();
      res.json({ success: true, message: 'ลบประเภทวัสดุเรียบร้อย' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.get('/api/departments', (req, res) => {
    res.json({ success: true, data: store.departments });
  });

  app.post('/api/departments', (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace('Bearer ', '');
      const currentUser = store.verifyToken(token || '');
      if (currentUser.role !== 'Admin') {
        return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์การใช้งาน' });
      }

      const data = req.body;
      if (data.department_id) {
        const idx = store.departments.findIndex(d => d.department_id === data.department_id);
        if (idx !== -1) {
          store.departments[idx] = {
            ...store.departments[idx],
            department_name: data.department_name,
            status: data.status
          };
        }
      } else {
        store.departments.push({
          department_id: store.generateId('DPT'),
          department_name: data.department_name,
          status: data.status || 'active',
          created_at: new Date().toISOString()
        });
      }
      store.save();
      res.json({ success: true, message: 'บันทึกกลุ่มงานเรียบร้อย' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.delete('/api/departments/:id', (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace('Bearer ', '');
      const currentUser = store.verifyToken(token || '');
      if (currentUser.role !== 'Admin') {
        return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์การใช้งาน' });
      }

      store.departments = store.departments.filter(d => d.department_id !== req.params.id);
      store.save();
      res.json({ success: true, message: 'ลบกลุ่มงานเรียบร้อย' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // --------------------------------------------------------------------------
  // STOCK MOVEMENTS: RECEIVE & REQUISITION
  // --------------------------------------------------------------------------
  app.post('/api/stock-in', (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace('Bearer ', '');
      const currentUser = store.verifyToken(token || '');
      if (currentUser.role !== 'Admin') {
        return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์การใช้งาน (Admin Only)' });
      }

      const data = req.body;
      const item = store.items.find(i => i.item_id === data.item_id);
      if (!item) {
        return res.status(400).json({ success: false, message: 'ไม่พบรายการวัสดุที่เลือก' });
      }

      const qty = Math.floor(Number(data.quantity));
      const price = Number(data.unit_price);
      if (isNaN(qty) || qty <= 0) {
        return res.status(400).json({ success: false, message: 'จำนวนต้องเป็นจำนวนเต็มบวกเท่านั้น' });
      }

      const curBal = Number(item.current_balance) || 0;
      const newBal = curBal + qty;
      const totalAmt = qty * price;
      const stockinNo = store.docNo('StockIn', 'STIN');
      const now = new Date().toISOString();

      // Update item balance and price
      item.current_balance = newBal;
      item.unit_price = price;

      const record = {
        stockin_id: store.generateId('STI'),
        stockin_no: stockinNo,
        stockin_date: data.stockin_date || now.split('T')[0],
        supplier: data.supplier || '',
        document_no: data.document_no || '',
        item_id: item.item_id,
        item_name: item.item_name,
        category_id: item.category_id,
        category_name: item.category_name,
        unit: item.unit,
        quantity: qty,
        unit_price: price,
        total_amount: totalAmt,
        balance_before: curBal,
        balance_after: newBal,
        created_by: currentUser.fullname,
        note: data.note || '',
        created_at: now
      };

      store.stockIn.push(record);
      store.save();

      res.json({ success: true, message: `รับเข้าวัสดุเรียบร้อยแล้ว (เลขที่: ${stockinNo})`, record });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post('/api/requests', (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace('Bearer ', '');
      const currentUser = store.verifyToken(token || '');

      const data = req.body;
      const item = store.items.find(i => i.item_id === data.item_id);
      if (!item) {
        return res.status(400).json({ success: false, message: 'ไม่พบรายการวัสดุที่เลือก' });
      }
      if (item.status !== 'active') {
        return res.status(400).json({ success: false, message: 'รายการวัสดุนี้ถูกปิดใช้งานแล้ว' });
      }

      const qty = Math.floor(Number(data.quantity));
      if (isNaN(qty) || qty <= 0) {
        return res.status(400).json({ success: false, message: 'จำนวนต้องเป็นจำนวนเต็มบวกเท่านั้น' });
      }

      const curBal = Number(item.current_balance) || 0;
      if (qty > curBal) {
        return res.status(400).json({
          success: false,
          message: `จำนวนที่ขอเบิก (${qty}) มากกว่ายอดคงเหลือในคลัง (${curBal})`
        });
      }

      const reqNo = store.docNo('Requests', 'REQ');
      const now = new Date().toISOString();
      const unitPrice = Number(item.unit_price) || 0;

      const newRequest = {
        request_id: store.generateId('REQ'),
        request_no: reqNo,
        request_date: data.request_date || now.split('T')[0],
        requester_id: currentUser.user_id,
        requester_name: currentUser.fullname,
        department: currentUser.department,
        item_id: item.item_id,
        item_name: item.item_name,
        category_id: item.category_id,
        category_name: item.category_name,
        unit: item.unit,
        quantity: qty,
        unit_price: unitPrice,
        total_amount: qty * unitPrice,
        purpose: data.purpose || '',
        note: data.note || '',
        status: 'pending' as const,
        stockout_no: '',
        stockout_date: '',
        approved_by: '',
        approved_date: '',
        approval_note: '',
        balance_before: '',
        balance_after: '',
        created_at: now
      };

      store.requests.push(newRequest);
      store.save();

      res.json({ success: true, message: `ส่งคำขอเบิกเรียบร้อยแล้ว (เลขที่: ${reqNo})`, request: newRequest });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post('/api/requests/:id/approve', (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace('Bearer ', '');
      const currentUser = store.verifyToken(token || '');
      if (currentUser.role !== 'Admin') {
        return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์อนุมัติรายการ (Admin Only)' });
      }

      const reqId = req.params.id;
      const requestItem = store.requests.find(r => r.request_id === reqId);
      if (!requestItem) {
        return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลคำขอเบิก' });
      }

      if (requestItem.status !== 'pending') {
        return res.status(400).json({ success: false, message: 'รายการนี้ถูกดำเนินการไปแล้ว' });
      }

      const item = store.items.find(i => i.item_id === requestItem.item_id);
      if (!item) {
        return res.status(400).json({ success: false, message: 'ไม่พบวัสดุในระบบ' });
      }

      const curBal = Number(item.current_balance) || 0;
      const qty = Number(requestItem.quantity);

      if (qty > curBal) {
        return res.status(400).json({
          success: false,
          message: `ไม่อนุมัติ: จำนวนที่เบิก (${qty}) เกินยอดคงเหลือในคลังปัจจุบัน (${curBal})`
        });
      }

      const newBal = curBal - qty;
      const stockoutNo = store.docNo('StockOut', 'STOUT');
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];

      // Update item stock
      item.current_balance = newBal;

      // Update request details
      requestItem.status = 'approved';
      requestItem.stockout_no = stockoutNo;
      requestItem.stockout_date = dateStr;
      requestItem.approved_by = currentUser.fullname;
      requestItem.approved_date = now.toISOString();
      requestItem.approval_note = req.body?.note?.trim() || 'อนุมัติเรียบร้อย';
      requestItem.balance_before = curBal;
      requestItem.balance_after = newBal;
      store.save();

      res.json({
        success: true,
        message: `อนุมัติคำขอ ${requestItem.request_no} เรียบร้อย (เลขที่จ่ายออก: ${stockoutNo})`,
        request: requestItem
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post('/api/requests/:id/reject', (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace('Bearer ', '');
      const currentUser = store.verifyToken(token || '');
      if (currentUser.role !== 'Admin') {
        return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์การใช้งาน (Admin Only)' });
      }

      const note = req.body?.note;
      if (!note || !note.trim()) {
        return res.status(400).json({ success: false, message: 'กรุณาระบุเหตุผลการปฏิเสธคำขอ' });
      }

      const reqId = req.params.id;
      const requestItem = store.requests.find(r => r.request_id === reqId);
      if (!requestItem) {
        return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลคำขอเบิก' });
      }

      if (requestItem.status !== 'pending') {
        return res.status(400).json({ success: false, message: 'รายการนี้ถูกดำเนินการไปแล้ว' });
      }

      requestItem.status = 'rejected';
      requestItem.approved_by = currentUser.fullname;
      requestItem.approved_date = new Date().toISOString();
      requestItem.approval_note = note.trim();
      store.save();

      res.json({
        success: true,
        message: `ปฏิเสธคำขอ ${requestItem.request_no} เรียบร้อยแล้ว`,
        request: requestItem
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post('/api/requests/:id/cancel', (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace('Bearer ', '');
      const currentUser = store.verifyToken(token || '');

      const reqId = req.params.id;
      const requestItem = store.requests.find(r => r.request_id === reqId);
      if (!requestItem) {
        return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลคำขอเบิก' });
      }

      if (requestItem.status !== 'pending') {
        return res.status(400).json({ success: false, message: 'สามารถยกเลิกได้เฉพาะคำขอที่รออนุมัติเท่านั้น' });
      }

      if (currentUser.role !== 'Admin' && requestItem.requester_id !== currentUser.user_id) {
        return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์ยกเลิกคำขอของผู้อื่น' });
      }

      store.requests = store.requests.filter(r => r.request_id !== reqId);
      store.save();
      res.json({ success: true, message: `ยกเลิกคำขอ ${requestItem.request_no} เรียบร้อยแล้ว` });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.get('/api/requests', (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace('Bearer ', '');
      const currentUser = store.verifyToken(token || '');

      let list = store.requests;
      if (currentUser.role !== 'Admin') {
        list = list.filter(r => r.requester_id === currentUser.user_id);
      }
      res.json({ success: true, data: list });
    } catch (err: any) {
      res.status(401).json({ success: false, message: err.message });
    }
  });

  app.get('/api/stock-in-history', (req, res) => {
    res.json({ success: true, data: store.stockIn });
  });

  // --------------------------------------------------------------------------
  // USERS MANAGEMENT & USER PROFILE
  // --------------------------------------------------------------------------
  app.get('/api/users', (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace('Bearer ', '');
      const currentUser = store.verifyToken(token || '');
      if (currentUser.role !== 'Admin') {
        return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์การใช้งาน' });
      }

      const safeUsers = store.users.map(u => {
        const copy = { ...u };
        delete copy.password;
        return copy;
      });

      res.json({ success: true, data: safeUsers });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post('/api/users', (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace('Bearer ', '');
      const currentUser = store.verifyToken(token || '');
      if (currentUser.role !== 'Admin') {
        return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์การใช้งาน' });
      }

      const data = req.body;
      if (data.user_id) {
        const idx = store.users.findIndex(u => u.user_id === data.user_id);
        if (idx !== -1) {
          store.users[idx] = {
            ...store.users[idx],
            fullname: data.fullname,
            phone: data.phone || '',
            position: data.position || '',
            role: data.role,
            department: data.department,
            status: data.status,
            approval_note: data.approval_note || ''
          };
          if (data.password && data.password.trim()) {
            store.users[idx].password = store.hashPassword(data.password.trim());
          }
        }
      } else {
        const newUser = {
          user_id: store.generateId('USR'),
          username: data.username,
          password: store.hashPassword(data.password),
          fullname: data.fullname,
          phone: data.phone || '',
          position: data.position || '',
          role: data.role || 'User',
          department: data.department || 'ฝ่ายปฏิบัติการ',
          status: data.status || 'active',
          approval_note: data.approval_note || '',
          profile_photo: '',
          created_at: new Date().toISOString()
        };
        store.users.push(newUser);
      }

      store.save();
      res.json({ success: true, message: 'บันทึกข้อมูลผู้ใช้งานเรียบร้อย' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.delete('/api/users/:id', (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace('Bearer ', '');
      const currentUser = store.verifyToken(token || '');
      if (currentUser.role !== 'Admin') {
        return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์การใช้งาน' });
      }

      if (currentUser.user_id === req.params.id) {
        return res.status(400).json({ success: false, message: 'ไม่สามารถลบบัญชีของตนเองได้' });
      }

      store.users = store.users.filter(u => u.user_id !== req.params.id);
      store.save();
      res.json({ success: true, message: 'ลบผู้ใช้งานเรียบร้อย' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post('/api/users/profile', (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace('Bearer ', '');
      const currentUser = store.verifyToken(token || '');

      const { fullname, phone, position, department, new_password } = req.body;
      const user = store.users.find(u => u.user_id === currentUser.user_id);
      if (user) {
        user.fullname = fullname || user.fullname;
        user.phone = phone || user.phone;
        user.position = position || user.position;
        user.department = department || user.department;
        if (new_password && new_password.trim()) {
          user.password = store.hashPassword(new_password.trim());
        }
        store.save();
      }

      res.json({ success: true, message: 'อัปเดตข้อมูลส่วนตัวเรียบร้อย' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // --------------------------------------------------------------------------
  // REPORTS
  // --------------------------------------------------------------------------
  app.get('/api/reports', (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace('Bearer ', '');
      const currentUser = store.verifyToken(token || '');

      const reportType = (req.query.type as string) || 'balance';
      if (currentUser.role !== 'Admin' && reportType !== 'balance') {
        return res.status(403).json({
          success: false,
          message: "ผู้ใช้งานทั่วไปสามารถเรียกดูได้เฉพาะรายงาน 'วัสดุคงเหลือ' เท่านั้น"
        });
      }

      const catId = req.query.category_id as string;
      let data: any[] = [];

      switch (reportType) {
        case 'balance':
          data = store.items.map(i => {
            const bal = Number(i.current_balance) || 0;
            const price = Number(i.unit_price) || 0;
            return {
              item_code: i.item_code,
              item_name: i.item_name,
              category_id: i.category_id,
              category_name: i.category_name,
              current_balance: bal,
              unit: i.unit,
              unit_price: price,
              total_value: bal * price,
              status: bal <= 0 ? 'หมด' : bal <= i.min_stock ? 'ใกล้หมด' : 'ปกติ'
            };
          });
          break;

        case 'low':
          data = store.items.filter(i => {
            const bal = Number(i.current_balance) || 0;
            return bal > 0 && bal <= Number(i.min_stock);
          });
          break;

        case 'out_of_stock':
          data = store.items.filter(i => (Number(i.current_balance) || 0) <= 0);
          break;

        case 'in':
          data = store.stockIn;
          break;

        case 'out':
          data = store.requests.filter(r => r.status === 'approved');
          break;

        case 'requests':
          data = store.requests;
          break;

        default:
          data = store.items;
      }

      if (catId && catId !== 'all') {
        data = data.filter(d => d.category_id === catId);
      }

      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // --------------------------------------------------------------------------
  // SETTINGS
  // --------------------------------------------------------------------------
  app.get('/api/settings', (req, res) => {
    res.json({ success: true, data: store.settings });
  });

  app.post('/api/settings', (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace('Bearer ', '');
      const currentUser = store.verifyToken(token || '');
      if (currentUser.role !== 'Admin') {
        return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์การใช้งาน (Admin Only)' });
      }

      const settingsData = req.body;
      for (const key in settingsData) {
        store.settings[key] = settingsData[key];
      }
      store.save();

      res.json({ success: true, message: 'บันทึกการตั้งค่าระบบเรียบร้อย' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // --------------------------------------------------------------------------
  // VITE MIDDLEWARE / PRODUCTION STATIC SERVING
  // --------------------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
