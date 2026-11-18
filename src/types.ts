export type Role = 'Admin' | 'User';
export type UserStatus = 'active' | 'pending' | 'inactive';

export interface User {
  user_id: string;
  username: string;
  password?: string;
  fullname: string;
  phone: string;
  position: string;
  role: Role;
  department: string;
  status: UserStatus;
  approval_note: string;
  profile_photo?: string;
  created_at: string;
}

export interface Category {
  category_id: string;
  category_name: string;
  description: string;
  status: 'active' | 'inactive';
  created_at: string;
}

export interface Department {
  department_id: string;
  department_name: string;
  status: 'active' | 'inactive';
  created_at: string;
}

export interface Item {
  item_id: string;
  item_code: string;
  item_name: string;
  category_id: string;
  category_name: string;
  unit: string;
  unit_price: number;
  opening_balance: number;
  current_balance: number;
  min_stock: number;
  status: 'active' | 'inactive';
  note: string;
  created_at: string;
}

export interface StockIn {
  stockin_id: string;
  stockin_no: string;
  stockin_date: string;
  supplier: string;
  document_no: string;
  item_id: string;
  item_name: string;
  category_id: string;
  category_name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  balance_before: number;
  balance_after: number;
  created_by: string;
  note: string;
  created_at: string;
}

export type RequestStatus = 'pending' | 'approved' | 'rejected';

export interface InventoryRequest {
  request_id: string;
  request_no: string;
  request_date: string;
  requester_id: string;
  requester_name: string;
  department: string;
  item_id: string;
  item_name: string;
  category_id: string;
  category_name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  purpose: string;
  note: string;
  status: RequestStatus;
  stockout_no: string;
  stockout_date: string;
  approved_by: string;
  approved_date: string;
  approval_note: string;
  balance_before: number | string;
  balance_after: number | string;
  created_at: string;
}

export interface AppSetting {
  key: string;
  value: string;
}

export interface Session {
  token: string;
  user_id: string;
  expires_at: string;
  created_at: string;
}

export interface DashboardSummary {
  totalItems: number;
  totalStockValue: number;
  totalInQty: number;
  totalOutQty: number;
  totalOutValue: number;
  outOfStockCount: number;
  lowStockCount: number;
}

export interface TopWithdrawnItem {
  name: string;
  qty: number;
}

export interface CategoryOutMap {
  [categoryName: string]: number;
}

export interface DashboardData {
  summary: DashboardSummary;
  topWithdrawn: TopWithdrawnItem[];
  catOutMap: CategoryOutMap;
  recentStockIn: StockIn[];
  recentRequests: InventoryRequest[];
}

export interface GoogleAuthStatus {
  connected: boolean;
  user?: {
    name?: string;
    email?: string;
    picture?: string;
  };
  spreadsheetId?: string;
  spreadsheetTitle?: string;
  sheets?: string[];
  error?: string;
}

export interface InitialDataResponse {
  success: boolean;
  message?: string;
  currentUser: User;
  categories: Category[];
  items: Item[];
  departments: Department[];
  settings: Record<string, string>;
  notifications: {
    pending_users: number;
    pending_approvals: number;
    my_updated_requests: number;
  };
  googleAuth?: GoogleAuthStatus;
}
