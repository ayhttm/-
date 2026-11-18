import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { User, Category, Department, Item, StockIn, InventoryRequest, Session } from '../src/types.js';

interface PersistedStoreData {
  users: User[];
  categories: Category[];
  departments: Department[];
  items: Item[];
  stockIn: StockIn[];
  requests: InventoryRequest[];
  settings: Record<string, string>;
  sessions: Session[];
  lastSavedAt?: string;
}

interface SignedTokenPayload {
  uid: string;
  usr: string;
  role: 'Admin' | 'User';
  name: string;
  dept: string;
  pos?: string;
  phone?: string;
  photo?: string;
  exp: number;
}

const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  process.env.APP_SESSION_SECRET ||
  'panthai_inventory_hmac_2026_secret_key';

export class InventoryStore {
  public users: User[] = [];
  public categories: Category[] = [];
  public departments: Department[] = [];
  public items: Item[] = [];
  public stockIn: StockIn[] = [];
  public requests: InventoryRequest[] = [];
  public settings: Record<string, string> = {};
  public sessions: Session[] = [];
  public lastSavedAt: string = '';

  private readonly repoDataPath = path.join(process.cwd(), 'server', 'data', 'store.json');
  private readonly tmpDataPath = path.join(os.tmpdir(), 'inventory-store.json');
  private activeDataPath: string;

  constructor() {
    this.activeDataPath = process.env.VERCEL ? this.tmpDataPath : this.repoDataPath;
    if (!this.loadFromDisk()) {
      this.seedDefaults();
      this.save();
    }
  }

  public loadFromDisk(): boolean {
    const candidates = process.env.VERCEL
      ? [this.tmpDataPath, this.repoDataPath]
      : [this.repoDataPath, this.tmpDataPath];

    for (const filePath of candidates) {
      try {
        if (!fs.existsSync(filePath)) {
          continue;
        }
        const raw = fs.readFileSync(filePath, 'utf-8');
        if (!raw.trim()) continue;
        const parsed: PersistedStoreData = JSON.parse(raw);

        if (!Array.isArray(parsed.users) || parsed.users.length === 0) {
          continue;
        }

        this.users = parsed.users;
        this.categories = Array.isArray(parsed.categories) ? parsed.categories : [];
        this.departments = Array.isArray(parsed.departments) ? parsed.departments : [];
        this.items = Array.isArray(parsed.items) ? parsed.items : [];
        this.stockIn = Array.isArray(parsed.stockIn) ? parsed.stockIn : [];
        this.requests = Array.isArray(parsed.requests) ? parsed.requests : [];
        this.settings = parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : {};
        this.sessions = Array.isArray(parsed.sessions) ? parsed.sessions : [];
        this.lastSavedAt = parsed.lastSavedAt || new Date().toISOString();
        return true;
      } catch (err) {
        console.error(`Failed to load persisted store from ${filePath}:`, err);
      }
    }
    return false;
  }

  public save(): void {
    this.lastSavedAt = new Date().toISOString();
    const payload: PersistedStoreData = {
      users: this.users,
      categories: this.categories,
      departments: this.departments,
      items: this.items,
      stockIn: this.stockIn,
      requests: this.requests,
      settings: this.settings,
      sessions: this.sessions,
      lastSavedAt: this.lastSavedAt
    };
    const serialized = JSON.stringify(payload, null, 2);

    const writeToPath = (targetPath: string) => {
      const dir = path.dirname(targetPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const tmpPath = `${targetPath}.tmp`;
      fs.writeFileSync(tmpPath, serialized, 'utf-8');
      fs.renameSync(tmpPath, targetPath);
    };

    try {
      writeToPath(this.activeDataPath);
    } catch (err: any) {
      if (this.activeDataPath !== this.tmpDataPath) {
        try {
          this.activeDataPath = this.tmpDataPath;
          writeToPath(this.tmpDataPath);
          return;
        } catch (tmpErr) {
          console.error('Failed to save store to /tmp fallback:', tmpErr);
        }
      } else {
        console.error('Failed to save store to disk:', err);
      }
    }
  }

  public hashPassword(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  public generateId(prefix: string): string {
    const uuid = crypto.randomUUID().replace(/-/g, '').substring(0, 8).toUpperCase();
    return `${prefix}-${uuid}`;
  }

  private signPayload(encodedPayload: string): string {
    return crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(encodedPayload)
      .digest('base64url');
  }

  public issueToken(user: User, ttlMs = 12 * 60 * 60 * 1000): { token: string; expiresAt: string } {
    const expMs = Date.now() + ttlMs;
    const expiresAt = new Date(expMs).toISOString();
    const payload: SignedTokenPayload = {
      uid: user.user_id,
      usr: user.username,
      role: user.role,
      name: user.fullname,
      dept: user.department,
      pos: user.position,
      phone: user.phone,
      photo: user.profile_photo,
      exp: expMs
    };
    const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const sig = this.signPayload(encoded);
    const token = `st.${encoded}.${sig}`;

    this.sessions.push({
      token,
      user_id: user.user_id,
      expires_at: expiresAt,
      created_at: new Date().toISOString()
    });
    // Keep session history bounded
    if (this.sessions.length > 200) {
      this.sessions = this.sessions.slice(-100);
    }
    this.save();
    return { token, expiresAt };
  }

  private verifySignedToken(token: string): SignedTokenPayload | null {
    if (!token.startsWith('st.')) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [, encoded, sig] = parts;
    if (!encoded || !sig) return null;

    const expectedSig = this.signPayload(encoded);
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

    try {
      const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SignedTokenPayload;
      if (!parsed || !parsed.uid || !parsed.exp) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  public docNo(sheetType: 'StockIn' | 'Requests' | 'StockOut', prefix: string): string {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}${mm}${dd}`;

    const checkPrefix = `${prefix}${dateStr}-`;
    let count = 0;

    if (sheetType === 'StockIn') {
      count = this.stockIn.filter(s => s.stockin_no && s.stockin_no.startsWith(checkPrefix)).length;
    } else if (sheetType === 'Requests') {
      count = this.requests.filter(r => r.request_no && r.request_no.startsWith(checkPrefix)).length;
    } else if (sheetType === 'StockOut') {
      count = this.requests.filter(r => r.stockout_no && r.stockout_no.startsWith(checkPrefix)).length;
    }

    const seq = String(count + 1).padStart(4, '0');
    return `${checkPrefix}${seq}`;
  }

  public seedDefaults() {
    const now = new Date().toISOString();

    // Settings
    this.settings = {
      app_name: 'ระบบคลังวัสดุอุปกรณ์',
      organization_name: 'สำนักงานก้าวหน้าพัฒนา',
      spreadsheet_id: '10DfYf1oM8Vzp5NSIk9Rd9fvEcwqnet_A_c4WnzrzJU4'
    };

    // Users
    if (this.users.length === 0) {
      this.users.push({
        user_id: 'USR-ADMIN01',
        username: 'admin',
        password: this.hashPassword('admin123'),
        fullname: 'ผู้ดูแลระบบ สูงสุด',
        phone: '0812345678',
        position: 'นักจัดการงานทั่วไป',
        role: 'Admin',
        department: 'บริหารทั่วไป',
        status: 'active',
        approval_note: 'Auto seed',
        profile_photo: '',
        created_at: now
      });

      this.users.push({
        user_id: 'USR-USER001',
        username: 'user',
        password: this.hashPassword('user123'),
        fullname: 'สมชาย สายขยัน',
        phone: '0898765432',
        position: 'เจ้าหน้าที่ธุรการ',
        role: 'User',
        department: 'ฝ่ายปฏิบัติการ',
        status: 'active',
        approval_note: 'Auto seed',
        profile_photo: '',
        created_at: now
      });
    }

    // Departments
    if (this.departments.length === 0) {
      this.departments.push(
        { department_id: 'DPT-001', department_name: 'บริหารทั่วไป', status: 'active', created_at: now },
        { department_id: 'DPT-002', department_name: 'ฝ่ายปฏิบัติการ', status: 'active', created_at: now },
        { department_id: 'DPT-003', department_name: 'ฝ่ายเทคโนโลยีสารสนเทศ', status: 'active', created_at: now },
        { department_id: 'DPT-004', department_name: 'ฝ่ายการเงินและบัญชี', status: 'active', created_at: now }
      );
    }

    // Categories
    const catOffice = 'CAT-OFFICE';
    const catIT = 'CAT-IT001';
    const catClean = 'CAT-CLEAN';

    if (this.categories.length === 0) {
      this.categories.push(
        { category_id: catOffice, category_name: 'เครื่องเขียนและอุปกรณ์สำนักงาน', description: 'ปากกา กระดาษ แฟ้ม ฯลฯ', status: 'active', created_at: now },
        { category_id: catIT, category_name: 'อุปกรณ์คอมพิวเตอร์และ IT', description: 'หมึกพิมพ์ เม้าส์ คีย์บอร์ด', status: 'active', created_at: now },
        { category_id: catClean, category_name: 'งานบ้านและทำความสะอาด', description: 'น้ำยาทำความสะอาด ทิชชู่', status: 'active', created_at: now }
      );
    }

    // Items
    if (this.items.length === 0) {
      this.items.push(
        {
          item_id: 'ITM-OFF001',
          item_code: 'OFF-001',
          item_name: 'กระดาษ A4 80gsm',
          category_id: catOffice,
          category_name: 'เครื่องเขียนและอุปกรณ์สำนักงาน',
          unit: 'รีม',
          unit_price: 120,
          opening_balance: 50,
          current_balance: 45,
          min_stock: 10,
          status: 'active',
          note: '',
          created_at: now
        },
        {
          item_id: 'ITM-OFF002',
          item_code: 'OFF-002',
          item_name: 'ปากกาลูกลื่น น้ำเงิน 0.5mm',
          category_id: catOffice,
          category_name: 'เครื่องเขียนและอุปกรณ์สำนักงาน',
          unit: 'ด้าม',
          unit_price: 15,
          opening_balance: 100,
          current_balance: 8,
          min_stock: 20,
          status: 'active',
          note: 'สต็อกใกล้หมด',
          created_at: now
        },
        {
          item_id: 'ITM-IT0001',
          item_code: 'IT-001',
          item_name: 'ตลับหมึกพิมพ์ HP Black 107A',
          category_id: catIT,
          category_name: 'อุปกรณ์คอมพิวเตอร์และ IT',
          unit: 'ตลับ',
          unit_price: 1850,
          opening_balance: 5,
          current_balance: 1,
          min_stock: 2,
          status: 'active',
          note: '',
          created_at: now
        },
        {
          item_id: 'ITM-IT0002',
          item_code: 'IT-002',
          item_name: 'เม้าส์ไร้สาย USB',
          category_id: catIT,
          category_name: 'อุปกรณ์คอมพิวเตอร์และ IT',
          unit: 'ตัว',
          unit_price: 350,
          opening_balance: 10,
          current_balance: 0,
          min_stock: 3,
          status: 'active',
          note: 'สินค้าหมดคลัง',
          created_at: now
        },
        {
          item_id: 'ITM-CLE001',
          item_code: 'CLE-001',
          item_name: 'กระดาษชำระม้วนใหญ่',
          category_id: catClean,
          category_name: 'งานบ้านและทำความสะอาด',
          unit: 'ม้วน',
          unit_price: 45,
          opening_balance: 30,
          current_balance: 25,
          min_stock: 5,
          status: 'active',
          note: '',
          created_at: now
        }
      );
    }

    // Sample StockIn
    if (this.stockIn.length === 0) {
      this.stockIn.push({
        stockin_id: 'STI-INIT01',
        stockin_no: 'STIN20260801-0001',
        stockin_date: '2026-08-01',
        supplier: 'บริษัท สมาร์ทออฟฟิศ จำกัด',
        document_no: 'PO-202608-001',
        item_id: 'ITM-OFF001',
        item_name: 'กระดาษ A4 80gsm',
        category_id: catOffice,
        category_name: 'เครื่องเขียนและอุปกรณ์สำนักงาน',
        unit: 'รีม',
        quantity: 50,
        unit_price: 120,
        total_amount: 6000,
        balance_before: 0,
        balance_after: 50,
        created_by: 'ผู้ดูแลระบบ สูงสุด',
        note: 'รับเข้าตั้งต้น',
        created_at: now
      });
    }

    // Sample Requests
    if (this.requests.length === 0) {
      this.requests.push({
        request_id: 'REQ-INIT01',
        request_no: 'REQ20260805-0001',
        request_date: '2026-08-05',
        requester_id: 'USR-USER001',
        requester_name: 'สมชาย สายขยัน',
        department: 'ฝ่ายปฏิบัติการ',
        item_id: 'ITM-OFF001',
        item_name: 'กระดาษ A4 80gsm',
        category_id: catOffice,
        category_name: 'เครื่องเขียนและอุปกรณ์สำนักงาน',
        unit: 'รีม',
        quantity: 5,
        unit_price: 120,
        total_amount: 600,
        purpose: 'ใช้ในการจัดพิมพ์เอกสารโครงการประจำเดือน',
        note: '',
        status: 'approved',
        stockout_no: 'STOUT20260805-0001',
        stockout_date: '2026-08-05',
        approved_by: 'ผู้ดูแลระบบ สูงสุด',
        approved_date: '2026-08-05T10:00:00.000Z',
        approval_note: 'อนุมัติเรียบร้อย',
        balance_before: 50,
        balance_after: 45,
        created_at: now
      });

      this.requests.push({
        request_id: 'REQ-INIT02',
        request_no: 'REQ20260806-0001',
        request_date: '2026-08-06',
        requester_id: 'USR-USER001',
        requester_name: 'สมชาย สายขยัน',
        department: 'ฝ่ายปฏิบัติการ',
        item_id: 'ITM-OFF002',
        item_name: 'ปากกาลูกลื่น น้ำเงิน 0.5mm',
        category_id: catOffice,
        category_name: 'เครื่องเขียนและอุปกรณ์สำนักงาน',
        unit: 'ด้าม',
        quantity: 10,
        unit_price: 15,
        total_amount: 150,
        purpose: 'แจกจ่ายเจ้าหน้าที่ประจำเคาน์เตอร์บริการ',
        note: '',
        status: 'pending',
        stockout_no: '',
        stockout_date: '',
        approved_by: '',
        approved_date: '',
        approval_note: '',
        balance_before: '',
        balance_after: '',
        created_at: now
      });
    }
  }

  // Session verification (supports stateless HMAC tokens for serverless + legacy session records)
  public verifyToken(token: string): User {
    if (!token) throw new Error('ไม่พบ Token กรุณาเข้าสู่ระบบใหม่');
    const now = Date.now();

    const signed = this.verifySignedToken(token);
    if (signed) {
      if (now > signed.exp) {
        throw new Error('Session หมดอายุแล้ว กรุณาล็อกอินใหม่');
      }
      const existing = this.users.find(
        u => u.user_id === signed.uid || u.username.trim().toLowerCase() === signed.usr.trim().toLowerCase()
      );
      if (existing) {
        if (existing.status !== 'active') {
          throw new Error('บัญชีผู้ใช้งานระงับการใช้งานหรือไม่อนุญาต');
        }
        return existing;
      }
      // Reconstruct user on stateless serverless cold start
      const restored: User = {
        user_id: signed.uid,
        username: signed.usr,
        fullname: signed.name,
        phone: signed.phone || '',
        position: signed.pos || '',
        role: signed.role,
        department: signed.dept || 'บริหารทั่วไป',
        status: 'active',
        approval_note: '',
        profile_photo: signed.photo || '',
        created_at: new Date().toISOString()
      };
      return restored;
    }

    const session = this.sessions.find(s => s.token === token);
    if (!session) throw new Error('Session ไม่ถูกต้อง กรุณาล็อกอินใหม่');

    const exp = new Date(session.expires_at).getTime();
    if (now > exp) {
      this.sessions = this.sessions.filter(s => s.token !== token);
      this.save();
      throw new Error('Session หมดอายุแล้ว กรุณาล็อกอินใหม่');
    }

    const user = this.users.find(u => u.user_id === session.user_id);
    if (!user || user.status !== 'active') {
      this.sessions = this.sessions.filter(s => s.token !== token);
      this.save();
      throw new Error('บัญชีผู้ใช้งานระงับการใช้งานหรือไม่อนุญาต');
    }

    return user;
  }
}

export const store = new InventoryStore();
