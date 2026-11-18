import { store } from './store.js';

export const DEFAULT_SPREADSHEET_ID = '10DfYf1oM8Vzp5NSIk9Rd9fvEcwqnet_A_c4WnzrzJU4';

export const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

export const SHEET_HEADERS: Record<string, string[]> = {
  Users: ['user_id', 'username', 'password', 'fullname', 'phone', 'position', 'role', 'department', 'status', 'approval_note', 'profile_photo', 'created_at'],
  Categories: ['category_id', 'category_name', 'description', 'status', 'created_at'],
  Departments: ['department_id', 'department_name', 'status', 'created_at'],
  Items: ['item_id', 'item_code', 'item_name', 'category_id', 'category_name', 'unit', 'unit_price', 'opening_balance', 'current_balance', 'min_stock', 'status', 'note', 'created_at'],
  StockIn: ['stockin_id', 'stockin_no', 'stockin_date', 'supplier', 'document_no', 'item_id', 'item_name', 'category_id', 'category_name', 'unit', 'quantity', 'unit_price', 'total_amount', 'balance_before', 'balance_after', 'created_by', 'note', 'created_at'],
  Requests: ['request_id', 'request_no', 'request_date', 'requester_id', 'requester_name', 'department', 'item_id', 'item_name', 'category_id', 'category_name', 'unit', 'quantity', 'unit_price', 'total_amount', 'purpose', 'note', 'status', 'stockout_no', 'stockout_date', 'approved_by', 'approved_date', 'approval_note', 'balance_before', 'balance_after', 'created_at'],
  Settings: ['key', 'value'],
  Sessions: ['token', 'user_id', 'expires_at', 'created_at']
};

export function extractSpreadsheetId(raw: string): string {
  const trimmed = (raw || '').trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

async function sheetsFetch(url: string, accessToken: string, options: RequestInit = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const text = await res.text();
  let json: any = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { error: { message: text } };
  }

  if (!res.ok) {
    const apiMsg = json?.error?.message || res.statusText || 'Google Sheets API error';
    if (res.status === 401) {
      throw new Error('โทเค็น Google หมดอายุหรือไม่ได้รับอนุญาต กรุณาเชื่อมต่อบัญชี Google ใหม่อีกครั้ง (401)');
    }
    if (res.status === 403) {
      throw new Error(`ไม่มีสิทธิ์เข้าถึง Spreadsheet นี้ กรุณาตรวจสอบว่าบัญชี Google ของคุณมีสิทธิ์แก้ไขสเปรดชีตนี้ (${apiMsg})`);
    }
    if (res.status === 404) {
      throw new Error('ไม่พบ Google Spreadsheet ตาม ID ที่ระบุ กรุณาตรวจสอบ Spreadsheet ID อีกครั้ง (404)');
    }
    throw new Error(apiMsg);
  }

  return json;
}

export async function getSpreadsheetDetails(accessToken: string, spreadsheetId: string) {
  const id = extractSpreadsheetId(spreadsheetId);
  const data = await sheetsFetch(
    `${SHEETS_API_BASE}/${encodeURIComponent(id)}?fields=properties.title,sheets.properties.title`,
    accessToken
  );
  return {
    spreadsheetId: id,
    title: data.properties?.title || 'Google Sheet Inventory',
    sheets: (data.sheets || []).map((s: any) => s.properties?.title).filter(Boolean) as string[]
  };
}

export async function ensureSheetTabsAndHeaders(accessToken: string, spreadsheetId: string) {
  const id = extractSpreadsheetId(spreadsheetId);
  const details = await getSpreadsheetDetails(accessToken, id);
  const existingTitles = details.sheets;

  const addSheetRequests: any[] = [];
  for (const sheetName of Object.keys(SHEET_HEADERS)) {
    if (!existingTitles.includes(sheetName)) {
      addSheetRequests.push({
        addSheet: {
          properties: { title: sheetName }
        }
      });
    }
  }

  if (addSheetRequests.length > 0) {
    await sheetsFetch(`${SHEETS_API_BASE}/${encodeURIComponent(id)}:batchUpdate`, accessToken, {
      method: 'POST',
      body: JSON.stringify({ requests: addSheetRequests })
    });
  }

  for (const [sheetName, headers] of Object.entries(SHEET_HEADERS)) {
    const range = `'${sheetName}'!A1:Z1`;
    const readRes = await sheetsFetch(
      `${SHEETS_API_BASE}/${encodeURIComponent(id)}/values/${encodeURIComponent(range)}`,
      accessToken
    );
    if (!readRes.values || readRes.values.length === 0 || readRes.values[0].length === 0) {
      const writeRange = `'${sheetName}'!A1`;
      await sheetsFetch(
        `${SHEETS_API_BASE}/${encodeURIComponent(id)}/values/${encodeURIComponent(writeRange)}?valueInputOption=RAW`,
        accessToken,
        {
          method: 'PUT',
          body: JSON.stringify({ values: [headers] })
        }
      );
    }
  }

  const updated = await getSpreadsheetDetails(accessToken, id);
  return updated;
}

export async function syncAllToSheets(accessToken: string, spreadsheetId: string) {
  const id = extractSpreadsheetId(spreadsheetId);
  await ensureSheetTabsAndHeaders(accessToken, id);

  const tablesToSync: Array<{ name: string; data: any[] }> = [
    { name: 'Users', data: store.users },
    { name: 'Categories', data: store.categories },
    { name: 'Departments', data: store.departments },
    { name: 'Items', data: store.items },
    { name: 'StockIn', data: store.stockIn },
    { name: 'Requests', data: store.requests },
    { name: 'Settings', data: Object.entries(store.settings).map(([key, value]) => ({ key, value })) },
    { name: 'Sessions', data: store.sessions }
  ];

  for (const table of tablesToSync) {
    const headers = SHEET_HEADERS[table.name];
    if (!headers) continue;

    const rows = table.data.map(item =>
      headers.map(h => (item[h] !== undefined && item[h] !== null ? String(item[h]) : ''))
    );

    const clearRange = `'${table.name}'!A2:Z10000`;
    await sheetsFetch(
      `${SHEETS_API_BASE}/${encodeURIComponent(id)}/values/${encodeURIComponent(clearRange)}:clear`,
      accessToken,
      { method: 'POST' }
    );

    if (rows.length > 0) {
      const writeRange = `'${table.name}'!A2`;
      await sheetsFetch(
        `${SHEETS_API_BASE}/${encodeURIComponent(id)}/values/${encodeURIComponent(writeRange)}?valueInputOption=USER_ENTERED`,
        accessToken,
        {
          method: 'PUT',
          body: JSON.stringify({ values: rows })
        }
      );
    }
  }

  return true;
}

function mapRowsToObjects(values: string[][], expectedHeaders: string[]): Record<string, string>[] {
  if (!values || values.length < 2) return [];
  const headerRow = values[0].map(h => String(h || '').trim());
  const dataRows = values.slice(1);

  return dataRows
    .filter(row => row.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== ''))
    .map(row => {
      const obj: Record<string, string> = {};
      expectedHeaders.forEach((expectedKey, fallbackIdx) => {
        const colIdx = headerRow.indexOf(expectedKey);
        const idx = colIdx !== -1 ? colIdx : fallbackIdx;
        obj[expectedKey] = row[idx] !== undefined && row[idx] !== null ? String(row[idx]) : '';
      });
      return obj;
    });
}

export async function pullAllFromSheets(accessToken: string, spreadsheetId: string) {
  const id = extractSpreadsheetId(spreadsheetId);
  const details = await getSpreadsheetDetails(accessToken, id);
  const existingSheets = new Set(details.sheets);
  const counts: Record<string, number> = {};

  const readTab = async (tabName: string) => {
    if (!existingSheets.has(tabName)) return [];
    const range = `'${tabName}'!A1:Z10000`;
    const res = await sheetsFetch(
      `${SHEETS_API_BASE}/${encodeURIComponent(id)}/values/${encodeURIComponent(range)}`,
      accessToken
    );
    return mapRowsToObjects(res.values || [], SHEET_HEADERS[tabName]);
  };

  const categoriesRows = await readTab('Categories');
  if (categoriesRows.length > 0) {
    store.categories = categoriesRows.map(r => ({
      category_id: r.category_id,
      category_name: r.category_name,
      description: r.description,
      status: (r.status === 'inactive' ? 'inactive' : 'active') as 'active' | 'inactive',
      created_at: r.created_at
    }));
  }
  counts.Categories = categoriesRows.length;

  const departmentsRows = await readTab('Departments');
  if (departmentsRows.length > 0) {
    store.departments = departmentsRows.map(r => ({
      department_id: r.department_id,
      department_name: r.department_name,
      status: (r.status === 'inactive' ? 'inactive' : 'active') as 'active' | 'inactive',
      created_at: r.created_at
    }));
  }
  counts.Departments = departmentsRows.length;

  const itemsRows = await readTab('Items');
  if (itemsRows.length > 0) {
    store.items = itemsRows.map(r => ({
      item_id: r.item_id,
      item_code: r.item_code,
      item_name: r.item_name,
      category_id: r.category_id,
      category_name: r.category_name,
      unit: r.unit,
      unit_price: Number(r.unit_price) || 0,
      opening_balance: Number(r.opening_balance) || 0,
      current_balance: Number(r.current_balance) || 0,
      min_stock: Number(r.min_stock) || 0,
      status: (r.status === 'inactive' ? 'inactive' : 'active') as 'active' | 'inactive',
      note: r.note,
      created_at: r.created_at
    }));
  }
  counts.Items = itemsRows.length;

  const stockInRows = await readTab('StockIn');
  if (stockInRows.length > 0) {
    store.stockIn = stockInRows.map(r => ({
      stockin_id: r.stockin_id,
      stockin_no: r.stockin_no,
      stockin_date: r.stockin_date,
      supplier: r.supplier,
      document_no: r.document_no,
      item_id: r.item_id,
      item_name: r.item_name,
      category_id: r.category_id,
      category_name: r.category_name,
      unit: r.unit,
      quantity: Number(r.quantity) || 0,
      unit_price: Number(r.unit_price) || 0,
      total_amount: Number(r.total_amount) || 0,
      balance_before: Number(r.balance_before) || 0,
      balance_after: Number(r.balance_after) || 0,
      created_by: r.created_by,
      note: r.note,
      created_at: r.created_at
    }));
  }
  counts.StockIn = stockInRows.length;

  const requestsRows = await readTab('Requests');
  if (requestsRows.length > 0) {
    store.requests = requestsRows.map(r => ({
      request_id: r.request_id,
      request_no: r.request_no,
      request_date: r.request_date,
      requester_id: r.requester_id,
      requester_name: r.requester_name,
      department: r.department,
      item_id: r.item_id,
      item_name: r.item_name,
      category_id: r.category_id,
      category_name: r.category_name,
      unit: r.unit,
      quantity: Number(r.quantity) || 0,
      unit_price: Number(r.unit_price) || 0,
      total_amount: Number(r.total_amount) || 0,
      purpose: r.purpose,
      note: r.note,
      status: (r.status === 'approved' || r.status === 'rejected' ? r.status : 'pending') as 'pending' | 'approved' | 'rejected',
      stockout_no: r.stockout_no,
      stockout_date: r.stockout_date,
      approved_by: r.approved_by,
      approved_date: r.approved_date,
      approval_note: r.approval_note,
      balance_before: r.balance_before === '' ? '' : Number(r.balance_before),
      balance_after: r.balance_after === '' ? '' : Number(r.balance_after),
      created_at: r.created_at
    }));
  }
  counts.Requests = requestsRows.length;

  const usersRows = await readTab('Users');
  if (usersRows.length > 0) {
    store.users = usersRows.map(r => ({
      user_id: r.user_id,
      username: r.username,
      password: r.password,
      fullname: r.fullname,
      phone: r.phone,
      position: r.position,
      role: (r.role === 'Admin' ? 'Admin' : 'User') as 'Admin' | 'User',
      department: r.department,
      status: (r.status === 'pending' || r.status === 'inactive' ? r.status : 'active') as 'active' | 'pending' | 'inactive',
      approval_note: r.approval_note,
      profile_photo: r.profile_photo,
      created_at: r.created_at
    }));
  }
  counts.Users = usersRows.length;

  const settingsRows = await readTab('Settings');
  if (settingsRows.length > 0) {
    for (const r of settingsRows) {
      if (r.key) {
        store.settings[r.key] = r.value;
      }
    }
  }
  counts.Settings = settingsRows.length;

  return counts;
}
