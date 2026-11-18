import React, { useState, useEffect } from 'react';
import { Item, StockIn } from '../types';
import { readPersisted, writePersisted } from '../lib/persistedState';
import { ArrowDownToLine, CheckCircle2, AlertCircle, History } from 'lucide-react';

interface StockInViewProps {
  items: Item[];
  token: string;
  onRefresh: () => void;
}

export const StockInView: React.FC<StockInViewProps> = ({ items, token, onRefresh }) => {
  const lastSavedStockIn = readPersisted<{
    itemId?: string;
    supplier?: string;
    stockinDate?: string;
  }>('inventory_last_stockin', {});

  const [stockInHistory, setStockInHistory] = useState<StockIn[]>([]);
  const [selectedItemId, setSelectedItemId] = useState(() => {
    if (lastSavedStockIn.itemId && items.some(i => i.item_id === lastSavedStockIn.itemId)) {
      return lastSavedStockIn.itemId;
    }
    return items[0]?.item_id || '';
  });
  const [quantity, setQuantity] = useState<number>(10);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [supplier, setSupplier] = useState(() => lastSavedStockIn.supplier || '');
  const [documentNo, setDocumentNo] = useState('');
  const [stockinDate, setStockinDate] = useState(
    () => lastSavedStockIn.stockinDate || new Date().toISOString().split('T')[0]
  );
  const [note, setNote] = useState('');

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const selectedItem = items.find(i => i.item_id === selectedItemId);

  useEffect(() => {
    if (selectedItem) {
      setUnitPrice(selectedItem.unit_price || 0);
    }
  }, [selectedItemId]);

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/stock-in-history', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) {
        setStockInHistory(json.data.reverse());
      }
    } catch (e) {
      console.error('Failed to load stock in history:', e);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) {
      setMessage({ type: 'error', text: 'กรุณาเลือกรายการวัสดุ' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const payload = {
        item_id: selectedItemId,
        quantity,
        unit_price: unitPrice,
        supplier,
        document_no: documentNo,
        stockin_date: stockinDate,
        note
      };

      const res = await fetch('/api/stock-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (json.success) {
        writePersisted('inventory_last_stockin', {
          itemId: selectedItemId,
          supplier,
          stockinDate
        });
        setMessage({ type: 'success', text: json.message });
        setQuantity(10);
        setDocumentNo('');
        setNote('');
        onRefresh();
        fetchHistory();
      } else {
        setMessage({ type: 'error', text: json.message });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'เกิดข้อผิดพลาดในการบันทึก' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/[0.03] backdrop-blur-md p-5 rounded-2xl border border-white/10 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <ArrowDownToLine className="w-5 h-5 text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]" />
          บันทึกการรับวัสดุเข้าคลัง (Stock In)
        </h2>
        <p className="text-xs font-mono text-cyan-400/70 tracking-wide mt-0.5">
          STOCK INBOUND TELEMETRY // INVENTORY RECEIPTS & AUTOMATIC VALUATION
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Receiving Form */}
        <div className="bg-white/[0.03] backdrop-blur-md border border-white/10 p-6 rounded-2xl space-y-4 shadow-[0_0_25px_rgba(0,0,0,0.5)]">
          <h3 className="text-sm font-bold text-slate-200 border-b border-white/10 pb-2 flex items-center gap-2">
            <ArrowDownToLine className="w-4 h-4 text-cyan-400" />
            ฟอร์มบันทึกรับวัสดุ
          </h3>

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

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-mono text-cyan-400/80 mb-1">เลือกรายการวัสดุ *</label>
              <select
                value={selectedItemId}
                onChange={e => setSelectedItemId(e.target.value)}
                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-400 shadow-inner"
              >
                {items.map(i => (
                  <option key={i.item_id} value={i.item_id}>
                    [{i.item_code}] {i.item_name} (คงเหลือ: {i.current_balance} {i.unit})
                  </option>
                ))}
              </select>
            </div>

            {selectedItem && (
              <div className="p-3 bg-black/40 rounded-xl border border-white/10 space-y-1 font-mono text-[11px]">
                <div className="text-slate-400">
                  หมวดหมู่:{' '}
                  <span className="text-cyan-300 font-medium">{selectedItem.category_name}</span>
                </div>
                <div className="text-slate-400">
                  ยอดคงเหลือก่อนรับ:{' '}
                  <span className="text-emerald-400 font-bold">
                    {selectedItem.current_balance} {selectedItem.unit}
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-mono text-cyan-400/80 mb-1">จำนวนที่รับเข้า *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={quantity}
                  onChange={e => setQuantity(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block font-mono text-cyan-400/80 mb-1">ราคาต่อหน่วย (฿) *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={unitPrice}
                  onChange={e => setUnitPrice(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            <div className="p-3 bg-cyan-500/10 border border-cyan-400/30 rounded-xl flex justify-between items-center text-xs font-mono text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.15)]">
              <span>รวมมูลค่ารับเข้าทั้งสิ้น:</span>
              <span className="font-bold text-sm text-cyan-200">
                ฿{(quantity * unitPrice).toLocaleString()}
              </span>
            </div>

            <div>
              <label className="block font-mono text-cyan-400/80 mb-1">วันที่รับเข้า *</label>
              <input
                type="date"
                required
                value={stockinDate}
                onChange={e => setStockinDate(e.target.value)}
                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block font-mono text-cyan-400/80 mb-1">ผู้ขาย / ผู้ส่งมอบ</label>
              <input
                type="text"
                placeholder="เช่น บริษัท สมาร์ทออฟฟิศ จำกัด"
                value={supplier}
                onChange={e => setSupplier(e.target.value)}
                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block font-mono text-cyan-400/80 mb-1">เลขที่เอกสารอ้างอิง (PO/ใบส่งของ)</label>
              <input
                type="text"
                placeholder="เช่น PO-2026-001"
                value={documentNo}
                onChange={e => setDocumentNo(e.target.value)}
                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block font-mono text-cyan-400/80 mb-1">หมายเหตุ</label>
              <textarea
                rows={2}
                placeholder="รายละเอียดเพิ่มเติม..."
                value={note}
                onChange={e => setNote(e.target.value)}
                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-400"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-40 text-slate-950 font-mono font-bold rounded-xl shadow-[0_0_15px_rgba(34,211,238,0.3)] transition"
            >
              {saving ? 'RECORDING RECEIPT...' : 'CONFIRM STOCK RECEIPT'}
            </button>
          </form>
        </div>

        {/* History Table */}
        <div className="lg:col-span-2 bg-white/[0.03] backdrop-blur-md border border-white/10 p-6 rounded-2xl space-y-4 shadow-[0_0_25px_rgba(0,0,0,0.5)]">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 border-b border-white/10 pb-2">
            <History className="w-4 h-4 text-cyan-400" />
            ประวัติการรับเข้าวัสดุ
          </h3>

          <div className="overflow-x-auto max-h-[520px]">
            <table className="w-full text-xs text-left text-slate-300">
              <thead className="bg-black/50 text-cyan-400/80 font-mono text-[10px] uppercase tracking-wider sticky top-0 border-b border-white/10">
                <tr>
                  <th className="p-3">REF NO.</th>
                  <th className="p-3">DATE</th>
                  <th className="p-3">ITEM</th>
                  <th className="p-3 text-right">QTY</th>
                  <th className="p-3 text-right">TOTAL</th>
                  <th className="p-3 text-center font-mono">BEFORE → AFTER</th>
                  <th className="p-3">OPERATOR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {stockInHistory.length > 0 ? (
                  stockInHistory.map(item => (
                    <tr key={item.stockin_id} className="hover:bg-white/5 transition">
                      <td className="p-3 font-mono font-medium text-cyan-300">
                        {item.stockin_no}
                      </td>
                      <td className="p-3 font-mono">{item.stockin_date}</td>
                      <td className="p-3 font-semibold text-slate-100">{item.item_name}</td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-400">
                        +{item.quantity} {item.unit}
                      </td>
                      <td className="p-3 text-right font-mono font-medium">
                        ฿{(Number(item.total_amount) || 0).toLocaleString()}
                      </td>
                      <td className="p-3 text-center text-slate-400 font-mono">
                        {item.balance_before} →{' '}
                        <span className="text-emerald-300 font-bold">{item.balance_after}</span>
                      </td>
                      <td className="p-3 text-slate-400">{item.created_by}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500 font-mono">
                      NO INBOUND RECEIPT HISTORY RECORDED
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
