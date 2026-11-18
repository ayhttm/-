import React, { useState } from 'react';
import { Item, Category, User } from '../types';
import { readPersisted, writePersisted } from '../lib/persistedState';
import {
  Boxes,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  Edit,
  Trash2,
  X,
  Send,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface ItemsViewProps {
  items: Item[];
  categories: Category[];
  currentUser: User | null;
  token: string;
  onRefresh: () => void;
  onRequestRequisition: (item: Item) => void;
}

export const ItemsView: React.FC<ItemsViewProps> = ({
  items,
  categories,
  currentUser,
  token,
  onRefresh,
  onRequestRequisition
}) => {
  const [searchTerm, setSearchTermState] = useState(() =>
    readPersisted<string>('inventory_items_search', '')
  );
  const setSearchTerm = (val: string) => {
    setSearchTermState(val);
    writePersisted('inventory_items_search', val);
  };
  const [selectedCategory, setSelectedCategoryState] = useState(() =>
    readPersisted<string>('inventory_items_category', 'all')
  );
  const setSelectedCategory = (val: string) => {
    setSelectedCategoryState(val);
    writePersisted('inventory_items_category', val);
  };
  const [statusFilter, setStatusFilterState] = useState<'all' | 'normal' | 'low' | 'out'>(() =>
    readPersisted('inventory_items_status', 'all')
  );
  const setStatusFilter = (val: 'all' | 'normal' | 'low' | 'out') => {
    setStatusFilterState(val);
    writePersisted('inventory_items_status', val);
  };

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  const [formData, setFormData] = useState({
    item_code: '',
    item_name: '',
    category_id: categories[0]?.category_id || '',
    category_name: categories[0]?.category_name || '',
    unit: 'ชิ้น',
    unit_price: 0,
    opening_balance: 0,
    min_stock: 5,
    status: 'active' as const,
    note: ''
  });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isAdmin = currentUser?.role === 'Admin';

  const handleOpenAdd = () => {
    const lastDefaults = readPersisted<{
      category_id?: string;
      category_name?: string;
      unit?: string;
      min_stock?: number;
    }>('inventory_last_item_defaults', {});
    const validCat = categories.find(c => c.category_id === lastDefaults.category_id) || categories[0];

    setEditingItem(null);
    setMessage(null);
    setFormData({
      item_code: `ITM-${String(items.length + 1).padStart(3, '0')}`,
      item_name: '',
      category_id: validCat?.category_id || '',
      category_name: validCat?.category_name || '',
      unit: lastDefaults.unit || 'ชิ้น',
      unit_price: 0,
      opening_balance: 10,
      min_stock: lastDefaults.min_stock ?? 5,
      status: 'active',
      note: ''
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (item: Item) => {
    setEditingItem(item);
    setFormData({
      item_code: item.item_code,
      item_name: item.item_name,
      category_id: item.category_id,
      category_name: item.category_name,
      unit: item.unit,
      unit_price: item.unit_price,
      opening_balance: item.opening_balance,
      min_stock: item.min_stock,
      status: item.status,
      note: item.note || ''
    });
    setModalOpen(true);
  };

  const handleCategoryChange = (catId: string) => {
    const cat = categories.find(c => c.category_id === catId);
    setFormData(prev => ({
      ...prev,
      category_id: catId,
      category_name: cat ? cat.category_name : ''
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const payload = {
        ...(editingItem ? { item_id: editingItem.item_id } : {}),
        ...formData
      };

      const res = await fetch('/api/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (json.success) {
        writePersisted('inventory_last_item_defaults', {
          category_id: formData.category_id,
          category_name: formData.category_name,
          unit: formData.unit,
          min_stock: formData.min_stock
        });
        setMessage({ type: 'success', text: json.message });
        setTimeout(() => {
          setModalOpen(false);
          onRefresh();
        }, 1000);
      } else {
        setMessage({ type: 'error', text: json.message });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'เกิดข้อผิดพลาดในการบันทึก' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (itemId: string) => {
    if (!confirm('ยืนยันการยกเลิกใช้งานรายการวัสดุนี้?')) return;

    try {
      const res = await fetch(`/api/items/${itemId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) {
        onRefresh();
      } else {
        alert(json.message);
      }
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการลบ: ' + err.message);
    }
  };

  // Filter Items
  const filteredItems = items.filter(item => {
    const matchesSearch =
      item.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.item_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.note.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = selectedCategory === 'all' || item.category_id === selectedCategory;

    const bal = Number(item.current_balance) || 0;
    const min = Number(item.min_stock) || 0;

    let matchesStatus = true;
    if (statusFilter === 'out') matchesStatus = bal <= 0;
    if (statusFilter === 'low') matchesStatus = bal > 0 && bal <= min;
    if (statusFilter === 'normal') matchesStatus = bal > min;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/[0.03] backdrop-blur-md p-5 rounded-2xl border border-white/10 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Boxes className="w-5 h-5 text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]" />
            รายการวัสดุอุปกรณ์ในคลัง
          </h2>
          <p className="text-xs font-mono text-cyan-400/70 tracking-wide mt-0.5">
            INVENTORY TELEMETRY // STOCK BALANCES & REQUISITION
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition shadow-[0_0_15px_rgba(16,185,129,0.3)] shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>ADD NEW ITEM</span>
          </button>
        )}
      </div>

      {/* Filter Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white/[0.03] backdrop-blur-md border border-white/10 p-3 rounded-2xl shadow-[0_0_15px_rgba(0,0,0,0.3)]">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-cyan-400/60" />
          <input
            type="text"
            placeholder="ค้นหาตามรหัส, ชื่อวัสดุ..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-black/40 border border-white/10 rounded-xl text-slate-100 text-xs font-mono focus:outline-none focus:border-cyan-400 shadow-inner"
          />
        </div>

        {/* Category Filter */}
        <div className="relative">
          <Filter className="w-4 h-4 absolute left-3 top-3 text-cyan-400/60" />
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-black/40 border border-white/10 rounded-xl text-slate-100 text-xs font-mono focus:outline-none focus:border-cyan-400 shadow-inner"
          >
            <option value="all">ทุกหมวดหมู่ ({categories.length})</option>
            {categories.map(c => (
              <option key={c.category_id} value={c.category_id}>
                {c.category_name}
              </option>
            ))}
          </select>
        </div>

        {/* Stock Status Filter */}
        <div className="flex bg-black/40 p-1 rounded-xl text-xs font-mono border border-white/10">
          {(['all', 'normal', 'low', 'out'] as const).map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`flex-1 py-1 rounded-lg text-center font-medium transition ${
                statusFilter === st
                  ? 'bg-gradient-to-r from-cyan-500/30 to-blue-500/30 text-cyan-200 border border-cyan-400/40 shadow-[0_0_10px_rgba(34,211,238,0.3)]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {st === 'all'
                ? 'ทั้งหมด'
                : st === 'normal'
                ? 'ปกติ'
                : st === 'low'
                ? 'ใกล้หมด'
                : 'หมดคลัง'}
            </button>
          ))}
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-white/[0.03] backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden shadow-[0_0_25px_rgba(0,0,0,0.5)]">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-300">
            <thead className="bg-black/50 text-cyan-400/80 font-mono text-[10px] uppercase tracking-wider border-b border-white/10">
              <tr>
                <th className="p-3.5">ITEM CODE</th>
                <th className="p-3.5">ITEM NAME / CATEGORY</th>
                <th className="p-3.5">UNIT</th>
                <th className="p-3.5 text-right">UNIT PRICE</th>
                <th className="p-3.5 text-center">BALANCE / MIN STOCK</th>
                <th className="p-3.5 text-center">STATUS</th>
                <th className="p-3.5 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredItems.length > 0 ? (
                filteredItems.map(item => {
                  const bal = Number(item.current_balance) || 0;
                  const min = Number(item.min_stock) || 0;
                  const isOut = bal <= 0;
                  const isLow = bal > 0 && bal <= min;

                  return (
                    <tr key={item.item_id} className="hover:bg-slate-800/50 transition">
                      <td className="p-3.5 font-mono font-medium text-emerald-400">
                        {item.item_code}
                      </td>
                      <td className="p-3.5">
                        <div className="font-semibold text-slate-100">{item.item_name}</div>
                        <div className="text-[11px] text-slate-400">{item.category_name}</div>
                      </td>
                      <td className="p-3.5">{item.unit}</td>
                      <td className="p-3.5 text-right font-medium text-slate-200">
                        ฿{item.unit_price.toLocaleString()}
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="font-bold text-sm">
                          <span
                            className={
                              isOut
                                ? 'text-rose-400'
                                : isLow
                                ? 'text-amber-400'
                                : 'text-emerald-400'
                            }
                          >
                            {bal}
                          </span>
                          <span className="text-slate-500 font-normal text-xs"> / {min}</span>
                        </div>
                      </td>
                      <td className="p-3.5 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                            isOut
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                              : isLow
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          }`}
                        >
                          {isOut ? 'หมดคลัง' : isLow ? 'ใกล้หมด' : 'พร้อมเบิก'}
                        </span>
                      </td>
                      <td className="p-3.5 text-right space-x-1">
                        <button
                          onClick={() => onRequestRequisition(item)}
                          disabled={isOut}
                          className="px-2.5 py-1 bg-purple-600/20 hover:bg-purple-600 disabled:opacity-30 disabled:hover:bg-purple-600/20 text-purple-300 hover:text-white rounded-lg transition font-medium border border-purple-500/30 inline-flex items-center gap-1"
                          title="ขอเบิกวัสดุ"
                        >
                          <Send className="w-3 h-3" />
                          <span>ขอเบิก</span>
                        </button>

                        {isAdmin && (
                          <>
                            <button
                              onClick={() => handleOpenEdit(item)}
                              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                              title="แก้ไขข้อมูล"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(item.item_id)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                              title="ปิดใช้งาน"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    ไม่พบรายการวัสดุที่ค้นหา
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 relative my-8">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Boxes className="w-5 h-5 text-emerald-400" />
              {editingItem ? 'แก้ไขรายการวัสดุ' : 'เพิ่มวัสดุใหม่เข้าคลัง'}
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
                  <label className="block font-medium text-slate-300 mb-1">รหัสวัสดุ *</label>
                  <input
                    type="text"
                    required
                    value={formData.item_code}
                    onChange={e => setFormData({ ...formData, item_code: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">หมวดหมู่ *</label>
                  <select
                    value={formData.category_id}
                    onChange={e => handleCategoryChange(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    {categories.map(c => (
                      <option key={c.category_id} value={c.category_id}>
                        {c.category_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">ชื่อรายการวัสดุ *</label>
                <input
                  type="text"
                  required
                  value={formData.item_name}
                  onChange={e => setFormData({ ...formData, item_name: e.target.value })}
                  placeholder="เช่น กระดาษ A4 80gsm หรือ ปากกาลูกลื่น"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">หน่วยนับ *</label>
                  <input
                    type="text"
                    required
                    value={formData.unit}
                    onChange={e => setFormData({ ...formData, unit: e.target.value })}
                    placeholder="รีม, ด้าม, กล่อง"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">ราคาต่อหน่วย (฿)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.unit_price}
                    onChange={e =>
                      setFormData({ ...formData, unit_price: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">Min Stock *</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.min_stock}
                    onChange={e =>
                      setFormData({ ...formData, min_stock: parseInt(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {!editingItem && (
                <div>
                  <label className="block font-medium text-slate-300 mb-1">
                    ยอดยกมาตั้งต้น (Opening Balance)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.opening_balance}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        opening_balance: parseInt(e.target.value) || 0
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              <div>
                <label className="block font-medium text-slate-300 mb-1">หมายเหตุ</label>
                <textarea
                  rows={2}
                  value={formData.note}
                  onChange={e => setFormData({ ...formData, note: e.target.value })}
                  placeholder="รายละเอียดเพิ่มเติม หรือสถานที่จัดเก็บในคลัง"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white rounded-xl font-medium shadow-lg"
                >
                  {saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
