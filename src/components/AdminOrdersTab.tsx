"use client";
import { toast } from 'react-hot-toast';
import React, { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { 
  collection, query, orderBy, updateDoc, 
  doc, deleteDoc, onSnapshot, getDoc
} from "firebase/firestore";
import { 
  User, Truck, CheckCircle, MapPin, 
  Phone, Edit3, Save, Trash2, Loader2,
  CreditCard, Banknote, StickyNote, Clock, AlertTriangle, PackageCheck,
  Info, X, Mail, ShoppingBag
} from "lucide-react";

export default function AdminOrdersTab() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingStatus, setEditingStatus] = useState<string | null>(null);
  const [customStatus, setCustomStatus] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [stockWarnings, setStockWarnings] = useState<Record<string, string[]>>({});
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  useEffect(() => {
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snap) => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // ─── Stock Deduction ──────────────────────────────────────────────────────
  const deductStock = async (order: any): Promise<{ warnings: string[] }> => {
    const warnings: string[] = [];
    if (!order.items || order.items.length === 0) return { warnings };

    for (const item of order.items) {
      const productId = item.productId || item.product_id || item.productID || item.id || null;
      if (!productId) {
        warnings.push(`"${item.name}" — product ID හොයාගත්තේ නෑ`);
        continue;
      }
      const qtyToDeduct = item.qty || 1;

      try {
        // 1. Product stock
        const productRef = doc(db, "products", productId);
        const productSnap = await getDoc(productRef);
        if (productSnap.exists()) {
          const currentStock = productSnap.data().stock ?? null;
          if (currentStock !== null) {
            const newStock = currentStock - qtyToDeduct;
            if (newStock <= 0) warnings.push(`"${item.name}" — ${newStock < 0 ? `oversold by ${Math.abs(newStock)}` : 'now out of stock'}`);
            else if (newStock <= 3) warnings.push(`"${item.name}" — only ${newStock} left!`);
            await updateDoc(productRef, { stock: Math.max(0, newStock) });
          }
        }

        // 2. Design stock (Customized)
        const designId = item.selectedDesignId || item.designId || null;
        if (designId) {
          try {
            const designRef = doc(db, "designs", designId);
            const designSnap = await getDoc(designRef);
            if (designSnap.exists()) {
              const dStock = designSnap.data().stock ?? null;
              if (dStock !== null) {
                const newDStock = dStock - qtyToDeduct;
                await updateDoc(designRef, { stock: Math.max(0, newDStock), soldOut: newDStock <= 0 });
                if (newDStock <= 0) warnings.push(`"${item.name}" design — sold out!`);
                else if (newDStock <= 3) warnings.push(`"${item.name}" design — only ${newDStock} left!`);
              }
            }
          } catch (err) { console.error(`Design deduct error:`, err); }
        }

        // 3. Material stock (Customized)
        const materialId = item.materialId || null;
        if (materialId) {
          try {
            const matRef = doc(db, "materials", materialId);
            const matSnap = await getDoc(matRef);
            if (matSnap.exists()) {
              const mStock = matSnap.data().stock ?? null;
              if (mStock !== null) {
                const newMStock = mStock - qtyToDeduct;
                await updateDoc(matRef, { stock: Math.max(0, newMStock), soldOut: newMStock <= 0 });
                if (newMStock <= 0) warnings.push(`"${item.name}" material — sold out!`);
                else if (newMStock <= 3) warnings.push(`"${item.name}" material — only ${newMStock} left!`);
              }
            }
          } catch (err) { console.error(`Material deduct error:`, err); }
        }

      } catch (err) {
        console.error(`Stock deduct error for ${productId}:`, err);
        warnings.push(`"${item.name}" — update error`);
      }
    }
    return { warnings };
  };

  // ─── Update Status ────────────────────────────────────────────────────────
  const updateStatus = async (orderId: string, newStatus: string, order?: any) => {
    setActionLoading(orderId);
    try {
      const orderRef = doc(db, "orders", orderId);
      const orderData = order || orders.find(o => o.id === orderId);
      const prevStatus = orderData?.orderStatus || 'Pending';
      const isPending = prevStatus === 'Pending' || prevStatus === 'New Order' || !prevStatus;
      const shouldDeduct = (newStatus === 'Dispatched' && isPending) || (newStatus === 'Completed' && isPending);

      if (shouldDeduct && orderData?.items?.length > 0) {
        const { warnings } = await deductStock(orderData);
        if (warnings.length > 0) {
          setStockWarnings(prev => ({ ...prev, [orderId]: warnings }));
          warnings.forEach(w => toast(`⚠️ Stock Alert: ${w}`, {
            style: { background: '#fef3c7', color: '#92400e', fontWeight: 'bold' },
            duration: 5000,
          }));
        } else {
          toast.success('📦 Stock updated successfully!');
        }
      }

      await updateDoc(orderRef, { orderStatus: newStatus });
      setEditingStatus(null);
    } catch (error) {
      console.error(error);
      toast.error("Status update failed!");
    } finally {
      setActionLoading(null);
    }
  };

  const deleteOrder = async (orderId: string) => {
    if (confirm("Delete this order?")) {
      try {
        await deleteDoc(doc(db, "orders", orderId));
        toast.success("Order deleted.");
      } catch { toast.error("Failed to delete order."); }
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-32 gap-4">
      <Loader2 className="w-12 h-12 text-rose-500 animate-spin" />
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Syncing Orders...</p>
    </div>
  );

  return (
    <div className="p-6 bg-[#fafafa] min-h-screen font-sans">

      {/* Header */}
      <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-4xl font-black text-gray-900 uppercase tracking-tighter">Logistics Center 📦</h2>
          <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mt-1">Real-time Order Fulfillment</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-white px-6 py-4 rounded-[2rem] border border-gray-100 shadow-sm">
            <span className="text-[9px] font-black text-amber-500 uppercase block tracking-widest">Pending Action</span>
            <span className="text-2xl font-black text-gray-800 leading-none">
              {orders.filter(o => !o.orderStatus || o.orderStatus === 'Pending' || o.orderStatus === 'New Order').length}
            </span>
          </div>
          <div className="bg-rose-500 px-6 py-4 rounded-[2rem] shadow-lg shadow-rose-200">
            <span className="text-[9px] font-black text-white/70 uppercase block tracking-widest">Total Orders</span>
            <span className="text-2xl font-black text-white leading-none">{orders.length}</span>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-[3rem] border border-gray-100 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-50">
                <th className="p-8 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Ordered Items</th>
                <th className="p-8 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Shipping Info</th>
                <th className="p-8 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-center">Current Status</th>
                <th className="p-8 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-right">Fulfillment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {orders.length > 0 ? orders.map((order) => {
                const currentStatus = order.orderStatus || 'Pending';
                const hasStockWarnings = stockWarnings[order.id]?.length > 0;
                return (
                  <tr key={order.id} className="hover:bg-rose-50/20 transition-all group">

                    {/* 1. PRODUCT INFO */}
                    <td className="p-8">
                      <div className="flex flex-col gap-3">
                        {order.items?.map((item: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-4">
                            <div className="relative w-12 h-12 rounded-2xl overflow-hidden border border-gray-100 bg-white shrink-0 shadow-sm">
                              <img src={item.image} className="w-full h-full object-cover" alt="" />
                            </div>
                            <div>
                              <p className="font-black text-gray-800 text-[11px] uppercase leading-tight">{item.name}</p>
                              <p className="text-[9px] text-rose-500 font-black mt-0.5">QTY: {item.qty} × Rs.{item.price}</p>
                            </div>
                          </div>
                        ))}
                        <p className="text-[8px] font-bold text-gray-300 uppercase tracking-widest mt-2">ID: #{order.id.slice(-8).toUpperCase()}</p>
                        {hasStockWarnings && (
                          <div className="mt-2 bg-amber-50 border border-amber-200 rounded-2xl p-3 space-y-1">
                            <p className="text-[9px] font-black text-amber-600 uppercase flex items-center gap-1">
                              <AlertTriangle size={10} /> Stock Alerts
                            </p>
                            {stockWarnings[order.id].map((w, i) => (
                              <p key={i} className="text-[8px] font-bold text-amber-700">{w}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* 2. SHIPPING INFO */}
                    <td className="p-8">
                      <div className="space-y-3">
                        <p className="text-xs font-black text-gray-800 uppercase flex items-center gap-2">
                          <User size={14} className="text-gray-300" /> {order.shippingAddress?.fullName}
                        </p>
                        <div className="space-y-1 ml-6">
                          <p className="text-[10px] font-bold text-gray-600 flex items-center gap-2">
                            <Phone size={12} className="text-rose-400" /> {order.shippingAddress?.phone}
                          </p>
                          <p className="text-[9px] font-bold text-gray-400 uppercase flex items-start gap-2 max-w-[180px]">
                            <MapPin size={12} className="shrink-0 text-gray-300" />
                            <span>{order.shippingAddress?.street}, {order.shippingAddress?.city}</span>
                          </p>
                          {order.shippingAddress?.orderNotes && (
                            <div className="mt-2 bg-amber-50 p-2 rounded-xl border border-amber-100 flex gap-2">
                              <StickyNote size={10} className="text-amber-500 shrink-0 mt-0.5" />
                              <p className="text-[8px] text-amber-700 font-bold uppercase leading-tight">{order.shippingAddress.orderNotes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* 3. STATUS */}
                    <td className="p-8 text-center">
                      <div className="flex flex-col items-center gap-4">
                        {editingStatus === order.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              className="p-2 border rounded-xl text-[9px] font-black uppercase w-28 outline-none border-rose-200"
                              value={customStatus}
                              onChange={(e) => setCustomStatus(e.target.value)}
                            />
                            <button onClick={() => updateStatus(order.id, customStatus, order)} className="p-2 bg-green-500 text-white rounded-xl">
                              <Save size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm flex items-center gap-2 ${
                              currentStatus === 'Completed' ? 'bg-green-50 text-green-600 border-green-100' :
                              currentStatus === 'Dispatched' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                              'bg-amber-50 text-amber-600 border-amber-100 ring-2 ring-amber-100/50'
                            }`}>
                              {currentStatus === 'Pending' && <Clock size={10} className="animate-pulse" />}
                              {currentStatus === 'Completed' && <PackageCheck size={10} />}
                              {currentStatus}
                            </span>
                            <button
                              onClick={() => { setEditingStatus(order.id); setCustomStatus(currentStatus); }}
                              className="text-[8px] font-black text-gray-300 hover:text-rose-500 uppercase flex items-center gap-1"
                            >
                              <Edit3 size={10} /> Change Status
                            </button>
                          </div>
                        )}
                        <div className="pt-2 border-t border-gray-50 w-full flex flex-col items-center gap-2">
                          <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-50 rounded-lg">
                            {order.payment?.method === 'cod' ? <Banknote size={12} className="text-emerald-500" /> : <CreditCard size={12} className="text-blue-500" />}
                            <span className="text-[8px] font-black text-gray-500 uppercase">
                              {order.payment?.method === 'cod' ? 'Cash on Delivery' : 'Bank Transfer'}
                            </span>
                          </div>
                          {order.payment?.slipUrl && (
                            <a href={order.payment.slipUrl} target="_blank" className="text-[8px] text-blue-500 font-black uppercase hover:underline">View Slip</a>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* 4. FULFILLMENT */}
                    <td className="p-8">
                      <div className="flex flex-col gap-4 items-end">
                        <div className="flex gap-2">
                          <button
                            onClick={() => setSelectedOrder(order)}
                            className="p-3 bg-gray-50 text-gray-500 rounded-2xl hover:bg-[#111] hover:text-white transition-all"
                            title="View full order details"
                          >
                            <Info size={18} />
                          </button>
                          <button
                            disabled={actionLoading === order.id || currentStatus === 'Dispatched' || currentStatus === 'Completed'}
                            onClick={() => updateStatus(order.id, 'Dispatched', order)}
                            className="p-3 bg-blue-50 text-blue-600 rounded-2xl hover:bg-blue-600 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Dispatch Order"
                          >
                            {actionLoading === order.id ? <Loader2 size={18} className="animate-spin" /> : <Truck size={18} />}
                          </button>
                          <button
                            disabled={actionLoading === order.id || currentStatus === 'Completed'}
                            onClick={() => updateStatus(order.id, 'Completed', order)}
                            className="p-3 bg-green-50 text-green-600 rounded-2xl hover:bg-green-500 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Mark as Completed"
                          >
                            <CheckCircle size={18} />
                          </button>
                          <button
                            onClick={() => deleteOrder(order.id)}
                            className="p-3 bg-gray-50 text-gray-400 rounded-2xl hover:bg-red-500 hover:text-white transition-all"
                            title="Delete Order"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-black text-gray-900 tracking-tighter italic">Rs. {order.pricing?.total?.toLocaleString()}</p>
                          {(currentStatus === 'Dispatched' || currentStatus === 'Completed') && (
                            <p className="text-[8px] font-black text-green-400 uppercase tracking-widest flex items-center justify-end gap-1 mt-1">
                              <PackageCheck size={9} /> Stock Updated
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={4} className="p-32 text-center text-gray-300 font-black uppercase tracking-widest">No Orders Yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          ORDER INFO MODAL
      ══════════════════════════════════════════════════════ */}
      {selectedOrder && (
        <div
          className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedOrder(null)}
        >
          <div
            className="bg-white w-full max-w-2xl max-h-[90vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-6 border-b border-gray-100 shrink-0">
              <div>
                <h3 className="font-black text-gray-900 text-lg uppercase tracking-tight">Order Details</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                  #{selectedOrder.id.slice(-8).toUpperCase()}
                </p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-2.5 rounded-2xl bg-gray-100 hover:bg-red-50 hover:text-red-500 transition-all text-gray-400"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 p-8 space-y-5">

              {/* Customer */}
              <div className="bg-gray-50 rounded-[1.5rem] p-5 space-y-3">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <User size={12} /> Customer Info
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white rounded-2xl p-4 border border-gray-100">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Name</p>
                    <p className="font-black text-gray-800 text-sm">{selectedOrder.shippingAddress?.fullName || "—"}</p>
                  </div>
                  <div className="bg-white rounded-2xl p-4 border border-gray-100">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                      <Phone size={9} /> Phone
                    </p>
                    <p className="font-black text-gray-800 text-sm">{selectedOrder.shippingAddress?.phone || "—"}</p>
                  </div>
                  {selectedOrder.shippingAddress?.email && (
                    <div className="bg-white rounded-2xl p-4 border border-gray-100">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                        <Mail size={9} /> Email
                      </p>
                      <p className="font-black text-gray-800 text-sm">{selectedOrder.shippingAddress.email}</p>
                    </div>
                  )}
                  <div className={`bg-white rounded-2xl p-4 border border-gray-100 ${selectedOrder.shippingAddress?.email ? '' : 'col-span-2'}`}>
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                      <MapPin size={9} /> Address
                    </p>
                    <p className="font-black text-gray-800 text-sm">
                      {[selectedOrder.shippingAddress?.street, selectedOrder.shippingAddress?.city, selectedOrder.shippingAddress?.district].filter(Boolean).join(", ")}
                    </p>
                  </div>
                  {selectedOrder.shippingAddress?.orderNotes && (
                    <div className="col-span-2 bg-amber-50 rounded-2xl p-4 border border-amber-100">
                      <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-1 flex items-center gap-1">
                        <StickyNote size={9} /> Order Notes
                      </p>
                      <p className="font-bold text-amber-700 text-sm">{selectedOrder.shippingAddress.orderNotes}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Items */}
              <div className="space-y-3">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <ShoppingBag size={12} /> Ordered Items
                </p>
                {selectedOrder.items?.map((item: any, idx: number) => (
                  <div key={idx} className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-xl overflow-hidden border border-gray-100 shrink-0 bg-gray-50">
                        <img src={item.image} className="w-full h-full object-cover" alt="" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-gray-800 text-sm uppercase leading-tight">{item.name}</p>
                        <p className="text-[10px] font-black text-rose-500 mt-0.5">
                          {item.qty} × Rs. {Number(item.price).toLocaleString()} = <span className="text-gray-800">Rs. {(item.qty * item.price).toLocaleString()}</span>
                        </p>
                        <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${
                          item.productType === "customized" ? "bg-gray-100 text-gray-600" : "bg-rose-50 text-rose-500"
                        }`}>
                          {item.productType === "customized" ? "✂️ Customized" : "📦 Ready Made"}
                        </span>
                      </div>
                    </div>
                    {item.productType === "customized" && (item.materialImage || item.designImage) && (
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-50">
                        {item.materialImage && (
                          <div className="flex items-center gap-2 bg-blue-50 rounded-xl p-3">
                            <div className="w-10 h-10 rounded-lg overflow-hidden border border-blue-100 shrink-0">
                              <img src={item.materialImage} className="w-full h-full object-cover" alt="material" />
                            </div>
                            <div>
                              <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest">🧵 Material</p>
                              <p className="text-[9px] font-black text-blue-700">Selected ✓</p>
                            </div>
                          </div>
                        )}
                        {item.designImage && (
                          <div className="flex items-center gap-2 bg-purple-50 rounded-xl p-3">
                            <div className="w-10 h-10 rounded-lg overflow-hidden border border-purple-100 shrink-0">
                              <img src={item.designImage} className="w-full h-full object-cover" alt="design" />
                            </div>
                            <div>
                              <p className="text-[8px] font-black text-purple-400 uppercase tracking-widest">🎨 Design</p>
                              <p className="text-[9px] font-black text-purple-700">Selected ✓</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Payment */}
              <div className="bg-gray-50 rounded-[1.5rem] p-5 space-y-3">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <CreditCard size={12} /> Payment
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {selectedOrder.payment?.method === 'cod'
                      ? <Banknote size={16} className="text-emerald-500" />
                      : <CreditCard size={16} className="text-blue-500" />}
                    <span className="font-black text-gray-700 text-sm uppercase">
                      {selectedOrder.payment?.method === 'cod' ? 'Cash on Delivery' : 'Bank Transfer'}
                    </span>
                  </div>
                  {selectedOrder.payment?.slipUrl && (
                    <a href={selectedOrder.payment.slipUrl} target="_blank" className="text-[10px] font-black text-blue-500 uppercase hover:underline">
                      View Slip →
                    </a>
                  )}
                </div>
                <div className="border-t border-gray-200 pt-3 space-y-2">
                  <div className="flex justify-between text-sm font-bold text-gray-500">
                    <span>Subtotal</span>
                    <span>Rs. {Number(selectedOrder.pricing?.subtotal || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-gray-500">
                    <span>Delivery</span>
                    <span>Rs. {Number(selectedOrder.pricing?.deliveryFee || selectedOrder.pricing?.delivery || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-black text-gray-900 text-lg pt-2 border-t border-gray-200">
                    <span>Total</span>
                    <span>Rs. {Number(selectedOrder.pricing?.total || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="px-8 py-5 border-t border-gray-100 flex justify-end shrink-0">
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-8 py-3 bg-[#111] text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:opacity-90 transition-all active:scale-95"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}