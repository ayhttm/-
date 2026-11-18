import React, { useState, useEffect } from 'react';
import { InventoryRequest, Item, User } from '../types';
import { readPersisted, writePersisted } from '../lib/persistedState';
import {
  Send,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  X,
  FileCheck2,
  FileX2,
  Trash2,
  Search
} from 'lucide-react';

interface RequestsViewProps {
  items: Item[];
  currentUser: User | null;
  token: string;
  selectedItemForReq?: Item | null;
  onRefresh: () => void;
}

export const RequestsView: React.FC<RequestsViewProps> = ({
  items,
  currentUser,
  token,
  selectedItemForReq,
  onRefresh
}) => {
  const [requests, setRequests] = useState<InventoryRequest[]>([]);
  const [statusFilter, setStatusFilterState] = useState<'all' | 'pending' | 'approved' | 'rejected'>(() =>
    readPersisted('inventory_requests_status_filter', 'all')
  );
  const setStatusFilter = (val: 'all' | 'pending' | 'approved' | 'rejected') => {
    setStatusFilterState(val);
    writePersisted('inventory_requests_status_filter', val);
  };
  const [searchTerm, setSearchTermState] = useState(() =>
    readPersisted<string>('inventory_requests_search', '')
  );
  const setSearchTerm = (val: string) => {
    setSearchTermState(val);
    writePersisted('inventory_requests_search', val);
  };

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(() => {
    if (selectedItemForReq) return selectedItemForReq.item_id;
    const savedId = readPersisted<string>('inventory_last_req_item', '');
    if (savedId && items.some(i => i.item_id === savedId && i.status === 'active')) {
      return savedId;
    }
    return items.find(i => i.status === 'active' && i.current_balance > 0)?.item_id || items[0]?.item_id || '';
  });
  const [quantity, setQuantity] = useState<number>(1);
  const [purpose, setPurpose] = useState('');
  const [note, setNote] = useState('');
  const [reqDate, setReqDate] = useState(() =>
    readPersisted<string>('inventory_last_req_date', new Date().toISOString().split('T')[0])
  );

  // Approval / Rejection / Cancel modals
  const [approveModal, setApproveModal] = useState<InventoryRequest | null>(null);
  const [rejectModal, setRejectModal] = useState<InventoryRequest | null>(null);
  const [cancelModal, setCancelModal] = useState<InventoryRequest | null>(null);
  const [approvalNote, setApprovalNote] = useState(() =>
    readPersisted<string>('inventory_last_approval_note', 'อนุมัติเรียบร้อย')
  );
  const [rejectionNote, setRejectionNote] = useState('');

  const [saving, setSaving] = useState(false);
  const [pageMessage, setPageMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [modalMessage, setModalMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isAdmin = currentUser?.role === 'Admin';
  const activeItems = items.filter(i => i.status === 'active');
  const selectedItem = items.find(i => i.item_id === selectedItemId);

  useEffect(() => {
    if (selectedItemForReq) {
      setSelectedItemId(selectedItemForReq.item_id);
      setQuantity(1);
      setModalMessage(null);
      setModalOpen(true);
    }
  }, [selectedItemForReq]);

  const fetchRequests = async () => {
    try {
      const res = await fetch('/api/requests', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) {
        setRequests([...json.data].reverse());
      }
    } catch (e) {
      console.error('Failed to load requests:', e);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [token]);

  const handleOpenNewModal = () => {
    const savedItemId = readPersisted<string>('inventory_last_req_item', '');
    const savedItem = activeItems.find(i => i.item_id === savedItemId && (Number(i.current_balance) || 0) > 0);
    const defaultItem =
      savedItem ||
      activeItems.find(i => (Number(i.current_balance) || 0) > 0) ||
      activeItems[0] ||
      items[0];
    setSelectedItemId(defaultItem?.item_id || '');
    setQuantity(1);
    setPurpose('');
    setNote('');
    setReqDate(readPersisted<string>('inventory_last_req_date', new Date().toISOString().split('T')[0]));
    setModalMessage(null);
    setModalOpen(true);
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    if (quantity > selectedItem.current_balance) {
      setModalMessage({
        type: 'error',
        text: `จำนวนที่ขอเบิก (${quantity}) เกินยอดคงเหลือในคลัง (${selectedItem.current_balance})`
      });
      return;
    }

    setSaving(true);
    setModalMessage(null);

    try {
      const payload = {
        item_id: selectedItemId,
        quantity,
        purpose,
        note,
        request_date: reqDate
      };

      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (json.success) {
        writePersisted('inventory_last_req_item', selectedItemId);
        writePersisted('inventory_last_req_date', reqDate);
        setModalOpen(false);
        setQuantity(1);
        setPurpose('');
        setNote('');
        setPageMessage({ type: 'success', text: json.message });
        onRefresh();
        fetchRequests();
      } else {
        setModalMessage({ type: 'error', text: json.message });
      }
    } catch (err: any) {
      setModalMessage({ type: 'error', text: err.message || 'เกิดข้อผิดพลาดในการส่งคำขอ' });
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!approveModal) return;
    setSaving(true);
    setModalMessage(null);
    try {
      const res = await fetch(`/api/requests/${approveModal.request_id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ note: approvalNote })
      });

      const json = await res.json();
      if (json.success) {
        writePersisted('inventory_last_approval_note', approvalNote);
        setApproveModal(null);
        setPageMessage({ type: 'success', text: json.message });
        onRefresh();
        fetchRequests();
      } else {
        setModalMessage({ type: 'error', text: json.message || 'ไม่สามารถอนุมัติคำขอได้' });
      }
    } catch (err: any) {
      setModalMessage({ type: 'error', text: 'เกิดข้อผิดพลาดในการอนุมัติ: ' + err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    if (!rejectionNote.trim()) {
      setModalMessage({ type: 'error', text: 'กรุณาระบุเหตุผลการปฏิเสธคำขอ' });
      return;
    }

    setSaving(true);
    setModalMessage(null);
    try {
      const res = await fetch(`/api/requests/${rejectModal.request_id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ note: rejectionNote })
      });

      const json = await res.json();
      if (json.success) {
        setRejectModal(null);
        setPageMessage({ type: 'success', text: json.message });
        onRefresh();
        fetchRequests();
      } else {
        setModalMessage({ type: 'error', text: json.message || 'ไม่สามารถปฏิเสธคำขอได้' });
      }
    } catch (err: any) {
      setModalMessage({ type: 'error', text: 'เกิดข้อผิดพลาดในการปฏิเสธ: ' + err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!cancelModal) return;
    setSaving(true);
    setModalMessage(null);
    try {
      const res = await fetch(`/api/requests/${cancelModal.request_id}/cancel`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const json = await res.json();
      if (json.success) {
        setCancelModal(null);
        setPageMessage({ type: 'success', text: json.message });
        onRefresh();
        fetchRequests();
      } else {
        setModalMessage({ type: 'error', text: json.message || 'ไม่สามารถยกเลิกคำขอได้' });
      }
    } catch (err: any) {
      setModalMessage({ type: 'error', text: 'เกิดข้อผิดพลาดในการยกเลิก: ' + err.message });
    } finally {
      setSaving(false);
    }
  };

  const counts = {
    all: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length
  };

  const filteredRequests = requests.filter(req => {
    const matchesStatus = statusFilter === 'all' || req.status === statusFilter;
    const q = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !q ||
      req.request_no.toLowerCase().includes(q) ||
      req.requester_name.toLowerCase().includes(q) ||
      req.item_name.toLowerCase().includes(q) ||
      req.department.toLowerCase().includes(q) ||
      (req.purpose || '').toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const approveItemStock = approveModal
    ? Number(items.find(i => i.item_id === approveModal.item_id)?.current_balance ?? 0)
    : 0;
  const approveInsufficient = approveModal ? Number(approveModal.quantity) > approveItemStock : false;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/[0.03] backdrop-blur-md p-5 rounded-2xl border border-white/10 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Send className="w-5 h-5 text-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.5)]" />
            คำขอเบิกวัสดุอุปกรณ์ (Requisitions & Stock Out)
          </h2>
          <p className="text-xs font-mono text-cyan-400/70 tracking-wide mt-0.5">
            REQUISITION TELEMETRY // STOCK DISPATCH & APPROVAL DISPATCH
          </p>
        </div>

        <button
          onClick={handleOpenNewModal}
          className="px-4 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-slate-950 rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition shadow-[0_0_15px_rgba(168,85,247,0.3)] shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>NEW REQUISITION</span>
        </button>
      </div>

      {/* Page Feedback Banner */}
      {pageMessage && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-mono flex items-center justify-between gap-3 border backdrop-blur-md ${
            pageMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
              : 'bg-rose-500/10 border-rose-500/40 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.2)]'
          }`}
        >
          <div className="flex items-center gap-2">
            {pageMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span>{pageMessage.text}</span>
          </div>
          <button
            onClick={() => setPageMessage(null)}
            className="text-slate-400 hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white/[0.03] backdrop-blur-md border border-white/10 p-3 rounded-2xl">
        <div className="flex flex-wrap gap-1 bg-black/40 p-1 rounded-xl text-xs font-mono border border-white/10">
          {(
            [
              { id: 'all', label: `ทั้งหมด (${counts.all})` },
              { id: 'pending', label: `รออนุมัติ (${counts.pending})` },
              { id: 'approved', label: `อนุมัติแล้ว (${counts.approved})` },
              { id: 'rejected', label: `ปฏิเสธ (${counts.rejected})` }
            ] as const
          ).map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                statusFilter === tab.id
                  ? 'bg-gradient-to-r from-cyan-500/30 to-blue-500/30 text-cyan-200 border border-cyan-400/40 shadow-[0_0_10px_rgba(34,211,238,0.3)]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-cyan-400/60" />
          <input
            type="text"
            placeholder="ค้นหาเลขที่, ผู้เบิก, รายการ..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-black/40 border border-white/10 rounded-xl text-slate-100 text-xs font-mono focus:outline-none focus:border-cyan-400"
          />
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white/[0.03] backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden shadow-[0_0_25px_rgba(0,0,0,0.5)]">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-300">
            <thead className="bg-black/50 text-cyan-400/80 font-mono text-[10px] uppercase tracking-wider border-b border-white/10">
              <tr>
                <th className="p-3.5">REQ NO.</th>
                <th className="p-3.5">DATE / REQUESTER</th>
                <th className="p-3.5">ITEM NAME</th>
                <th className="p-3.5 text-right">QTY</th>
                <th className="p-3.5">PURPOSE</th>
                <th className="p-3.5 text-center">STATUS</th>
                <th className="p-3.5 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredRequests.length > 0 ? (
                filteredRequests.map(req => {
                  const canCancel =
                    req.status === 'pending' &&
                    (isAdmin || req.requester_id === currentUser?.user_id);

                  return (
                    <tr key={req.request_id} className="hover:bg-white/5 transition">
                      <td className="p-3.5 font-mono font-medium text-purple-300">
                        <div>{req.request_no}</div>
                        {req.stockout_no && (
                          <div className="text-[10px] text-emerald-400 font-mono">
                            DISPATCH: {req.stockout_no}
                          </div>
                        )}
                      </td>
                      <td className="p-3.5">
                        <div className="font-semibold text-slate-100">{req.requester_name}</div>
                        <div className="text-[10px] font-mono text-slate-400">
                          {req.department} • {req.request_date}
                        </div>
                      </td>
                      <td className="p-3.5">
                        <div className="font-medium text-slate-200">{req.item_name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{req.category_name}</div>
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-amber-300">
                        <div>
                          {req.quantity} {req.unit}
                        </div>
                        {req.status === 'approved' && req.balance_after !== '' && (
                          <div className="text-[10px] text-slate-500 font-normal">
                            ({req.balance_before} → {req.balance_after})
                          </div>
                        )}
                      </td>
                      <td className="p-3.5 max-w-xs text-slate-400">
                        <div className="truncate" title={req.purpose}>
                          {req.purpose || '-'}
                        </div>
                        {req.approval_note && req.status !== 'pending' && (
                          <div className="text-[10px] text-slate-500 truncate">
                            หมายเหตุ: {req.approval_note}
                          </div>
                        )}
                      </td>
                      <td className="p-3.5 text-center font-mono">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                            req.status === 'approved'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                              : req.status === 'rejected'
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-[0_0_10px_rgba(244,63,94,0.2)]'
                              : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          }`}
                        >
                          {req.status === 'approved' && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                          {req.status === 'rejected' && <XCircle className="w-3 h-3 text-rose-400" />}
                          {req.status === 'pending' && <Clock className="w-3 h-3 text-amber-400" />}
                          <span>
                            {req.status === 'approved'
                              ? 'APPROVED'
                              : req.status === 'rejected'
                              ? 'REJECTED'
                              : 'PENDING'}
                          </span>
                        </span>
                        {req.approved_by && (
                          <div className="text-[9px] text-slate-500 mt-1">
                            โดย: {req.approved_by}
                          </div>
                        )}
                      </td>
                      <td className="p-3.5 text-right">
                        {req.status === 'pending' ? (
                          <div className="flex items-center justify-end gap-1">
                            {isAdmin && (
                              <>
                                <button
                                  onClick={() => {
                                    setApproveModal(req);
                                    setApprovalNote(
                                      readPersisted<string>('inventory_last_approval_note', 'อนุมัติเรียบร้อย')
                                    );
                                    setModalMessage(null);
                                  }}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-medium flex items-center gap-1 transition"
                                >
                                  <FileCheck2 className="w-3.5 h-3.5" />
                                  <span>อนุมัติ</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setRejectModal(req);
                                    setRejectionNote('');
                                    setModalMessage(null);
                                  }}
                                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[11px] font-medium flex items-center gap-1 transition"
                                >
                                  <FileX2 className="w-3.5 h-3.5" />
                                  <span>ปฏิเสธ</span>
                                </button>
                              </>
                            )}
                            {canCancel && (
                              <button
                                onClick={() => {
                                  setCancelModal(req);
                                  setModalMessage(null);
                                }}
                                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-white/10 rounded-lg transition"
                                title="ยกเลิกคำขอ"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-500">
                            {req.stockout_date || req.approved_date?.split('T')[0] || '-'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    ไม่พบรายการคำขอเบิกวัสดุที่ตรงกับเงื่อนไข
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Request Modal */}
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
              <Send className="w-5 h-5 text-purple-400" />
              ยื่นคำขอเบิกวัสดุอุปกรณ์
            </h3>

            {modalMessage && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  modalMessage.type === 'success'
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                }`}
              >
                {modalMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{modalMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleCreateRequest} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-300 mb-1">
                  เลือกรายการวัสดุ *
                </label>
                <select
                  value={selectedItemId}
                  onChange={e => setSelectedItemId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-purple-500"
                >
                  {activeItems.map(i => (
                    <option key={i.item_id} value={i.item_id} disabled={i.current_balance <= 0}>
                      [{i.item_code}] {i.item_name} (คงเหลือ: {i.current_balance} {i.unit})
                      {i.current_balance <= 0 ? ' - หมดคลัง' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {selectedItem && (
                <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 space-y-1">
                  <div className="text-slate-300 font-semibold">{selectedItem.item_name}</div>
                  <div className="text-slate-400">
                    ยอดคงเหลือในคลัง:{' '}
                    <span
                      className={`font-bold ${
                        selectedItem.current_balance <= 0 ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      {selectedItem.current_balance} {selectedItem.unit}
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">
                    จำนวนที่ต้องการเบิก *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={selectedItem?.current_balance || 1}
                    required
                    value={quantity}
                    onChange={e => setQuantity(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">วันที่ขอเบิก *</label>
                  <input
                    type="date"
                    required
                    value={reqDate}
                    onChange={e => setReqDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">
                  วัตถุประสงค์การใช้งาน / โครงการ *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="เช่น ใช้ในการประชุมปฏิบัติการโครงการประจำเดือนสิงหาคม"
                  value={purpose}
                  onChange={e => setPurpose(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-purple-500"
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
                  disabled={saving || !selectedItem || selectedItem.current_balance <= 0}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 text-white rounded-xl font-medium shadow-lg"
                >
                  {saving ? 'กำลังส่งคำขอ...' : 'ส่งคำขอเบิก'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Approve Modal */}
      {approveModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-emerald-400 flex items-center gap-2">
              <FileCheck2 className="w-5 h-5" />
              ยืนยันการอนุมัติและตัดสต็อก
            </h3>

            {modalMessage && (
              <div className="p-3 rounded-xl text-xs flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-300">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{modalMessage.text}</span>
              </div>
            )}

            <div className="p-3 bg-slate-800/60 rounded-xl text-xs space-y-1.5 text-slate-300">
              <div>
                เลขที่คำขอ:{' '}
                <span className="font-mono text-purple-300">{approveModal.request_no}</span>
              </div>
              <div>
                ผู้ขอเบิก:{' '}
                <span className="font-semibold text-white">{approveModal.requester_name}</span> (
                {approveModal.department})
              </div>
              <div>
                รายการ:{' '}
                <span className="font-semibold text-emerald-300">{approveModal.item_name}</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-700/60">
                <span>จำนวนขอเบิก:</span>
                <span className="font-bold text-amber-300 font-mono">
                  {approveModal.quantity} {approveModal.unit}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>ยอดคงเหลือในคลังปัจจุบัน:</span>
                <span
                  className={`font-bold font-mono ${
                    approveInsufficient ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {approveItemStock} {approveModal.unit}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>คงเหลือหลังหักเบิก:</span>
                <span
                  className={`font-bold font-mono ${
                    approveInsufficient ? 'text-rose-400' : 'text-cyan-300'
                  }`}
                >
                  {approveInsufficient
                    ? `ไม่เพียงพอ (ขาด ${Number(approveModal.quantity) - approveItemStock} ${approveModal.unit})`
                    : `${approveItemStock - Number(approveModal.quantity)} ${approveModal.unit}`}
                </span>
              </div>
            </div>

            {approveInsufficient && (
              <div className="p-3 rounded-xl text-xs flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-300">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  ยอดคงเหลือไม่พอตัดสต็อก กรุณารับวัสดุเข้าคลังเพิ่มเติมก่อนอนุมัติ หรือกดปฏิเสธคำขอ
                </span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                หมายเหตุการอนุมัติ
              </label>
              <input
                type="text"
                value={approvalNote}
                onChange={e => setApprovalNote(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setApproveModal(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-xl hover:bg-slate-700"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleApprove}
                disabled={saving || approveInsufficient}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-400 text-white text-xs font-semibold rounded-xl shadow"
              >
                {saving ? 'กำลังดำเนินการ...' : 'ยืนยันอนุมัติ & ตัดสต็อก'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-rose-400 flex items-center gap-2">
              <FileX2 className="w-5 h-5" />
              ระบุเหตุผลการปฏิเสธคำขอ
            </h3>

            {modalMessage && (
              <div className="p-3 rounded-xl text-xs flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-300">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{modalMessage.text}</span>
              </div>
            )}

            <div className="p-3 bg-slate-800/60 rounded-xl text-xs space-y-1.5 text-slate-300">
              <div>
                เลขที่คำขอ: <span className="font-mono text-purple-300">{rejectModal.request_no}</span>
              </div>
              <div>
                ผู้ขอเบิก:{' '}
                <span className="font-semibold text-white">{rejectModal.requester_name}</span>
              </div>
              <div>
                รายการ: <span className="font-semibold">{rejectModal.item_name}</span> (
                {rejectModal.quantity} {rejectModal.unit})
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                เหตุผลการปฏิเสธ *
              </label>
              <textarea
                rows={3}
                required
                placeholder="เช่น สินค้าอยู่ระหว่างรอการจัดหา หรือ จำนวนเบิกเกินความจำเป็น"
                value={rejectionNote}
                onChange={e => setRejectionNote(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectModal(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-xl hover:bg-slate-700"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleReject}
                disabled={saving}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-700 text-white text-xs font-semibold rounded-xl shadow"
              >
                {saving ? 'กำลังบันทึก...' : 'ยืนยันปฏิเสธคำขอ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Request Modal */}
      {cancelModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-rose-400 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              ยืนยันการยกเลิกคำขอเบิก
            </h3>

            {modalMessage && (
              <div className="p-3 rounded-xl text-xs flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-300">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{modalMessage.text}</span>
              </div>
            )}

            <p className="text-xs text-slate-300 leading-relaxed">
              ต้องการยกเลิกคำขอเลขที่{' '}
              <span className="font-mono font-bold text-purple-300">{cancelModal.request_no}</span>{' '}
              ({cancelModal.item_name} จำนวน {cancelModal.quantity} {cancelModal.unit}) ใช่หรือไม่?
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setCancelModal(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-xl hover:bg-slate-700"
              >
                ปิด
              </button>
              <button
                onClick={handleCancelRequest}
                disabled={saving}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-700 text-white text-xs font-semibold rounded-xl shadow"
              >
                {saving ? 'กำลังยกเลิก...' : 'ยืนยันยกเลิกคำขอ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
