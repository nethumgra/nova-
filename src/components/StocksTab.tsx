"use client";
import React, { useState, useEffect } from "react";
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, updateDoc, doc } from "firebase/firestore";
import { Package, Paintbrush, Edit3, Check, X, AlertTriangle, RefreshCw } from "lucide-react";

type StockItem = {
  id: string;
  image: string;
  price: number;
  stock: number | null;
  soldOut?: boolean;
};

function StockRow({ item, type, onSave }: {
  item: StockItem;
  type: "designs" | "materials";
  onSave: (id: string, stock: number | null, soldOut: boolean) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [stockVal, setStockVal] = useState<string>(item.stock != null ? String(item.stock) : "");
  const [soldOut, setSoldOut] = useState(item.soldOut ?? false);
  const [saving, setSaving] = useState(false);

  const stock = item.stock;
  const isSoldOut = soldOut || stock === 0;
  const isLow = !isSoldOut && stock != null && stock > 0 && stock <= 5;
  const hasStock = stock != null;

  const handleSave = async () => {
    setSaving(true);
    const newStock = stockVal === "" ? null : Number(stockVal);
    await onSave(item.id, newStock, soldOut);
    setSaving(false);
    setEditing(false);
  };

  const handleCancel = () => {
    setStockVal(item.stock != null ? String(item.stock) : "");
    setSoldOut(item.soldOut ?? false);
    setEditing(false);
  };

  return (
    <div className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
      isSoldOut ? "bg-red-50/50 border-red-100" : isLow ? "bg-amber-50/50 border-amber-100" : "bg-white border-gray-100"
    }`}>
      {/* Image */}
      <div className="w-14 h-14 rounded-xl overflow-hidden border border-gray-100 shrink-0 bg-gray-50">
        <img src={item.image} className="w-full h-full object-cover" alt="" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
          {type === "designs" ? "🎨 Design" : "🧵 Material"}
        </p>
        {/* Stock badge */}
        {!editing ? (
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase ${
            isSoldOut ? "bg-red-100 text-red-600" : isLow ? "bg-amber-100 text-amber-700" : hasStock ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isSoldOut ? "bg-red-500" : isLow ? "bg-amber-500 animate-pulse" : hasStock ? "bg-green-500" : "bg-gray-300"}`} />
            {isSoldOut ? "Sold Out" : isLow ? `Low — ${stock} left` : hasStock ? `${stock} in stock` : "No stock set"}
          </div>
        ) : (
          <div className="flex items-center gap-2 mt-1">
            <input
              type="number"
              min="0"
              value={stockVal}
              onChange={e => setStockVal(e.target.value)}
              placeholder="Stock count"
              className="w-28 p-2 bg-white rounded-xl border-2 border-rose-200 outline-none font-black text-gray-800 text-sm focus:border-[#c12a52] transition-all"
              autoFocus
            />
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={soldOut}
                onChange={e => setSoldOut(e.target.checked)}
                className="w-4 h-4 accent-red-500 rounded"
              />
              <span className="text-[10px] font-black text-red-500 uppercase">Force Sold Out</span>
            </label>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-50 hover:bg-[#c12a52] hover:text-white text-gray-500 font-black text-[10px] uppercase tracking-widest transition-all border border-gray-100"
          >
            <Edit3 size={12} /> Edit
          </button>
        ) : (
          <>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#c12a52] text-white font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-rose-100 disabled:opacity-50"
            >
              {saving ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
              Save
            </button>
            <button
              onClick={handleCancel}
              className="p-2 rounded-xl bg-gray-100 text-gray-400 hover:bg-gray-200 transition-all"
            >
              <X size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function StocksTab() {
  const [activeView, setActiveView] = useState<"designs" | "materials">("designs");
  const [designs, setDesigns] = useState<StockItem[]>([]);
  const [materials, setMaterials] = useState<StockItem[]>([]);

  useEffect(() => {
    const unsubD = onSnapshot(query(collection(db, "designs"), orderBy("createdAt", "desc")), snap => {
      setDesigns(snap.docs.map(d => ({ id: d.id, ...d.data() } as StockItem)));
    });
    const unsubM = onSnapshot(query(collection(db, "materials"), orderBy("createdAt", "desc")), snap => {
      setMaterials(snap.docs.map(d => ({ id: d.id, ...d.data() } as StockItem)));
    });
    return () => { unsubD(); unsubM(); };
  }, []);

  const handleSave = async (collectionName: string, id: string, stock: number | null, soldOut: boolean) => {
    await updateDoc(doc(db, collectionName, id), {
      stock,
      soldOut,
    });
  };

  const items = activeView === "designs" ? designs : materials;
  const soldOutCount = items.filter(i => i.soldOut || i.stock === 0).length;
  const lowCount = items.filter(i => !i.soldOut && i.stock != null && i.stock > 0 && i.stock <= 5).length;
  const noStockCount = items.filter(i => i.stock == null).length;

  return (
    <div className="p-8 md:p-10 min-h-screen bg-gray-50">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-gray-800">Stock Manager 📊</h1>
        <p className="text-sm font-bold text-gray-400 mt-1">Manage designs & materials inventory — real-time</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-[2rem] border border-gray-100 p-5 shadow-sm">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Items</p>
          <p className="text-3xl font-black text-gray-800">{items.length}</p>
        </div>
        <div className={`rounded-[2rem] border p-5 shadow-sm ${soldOutCount > 0 ? "bg-red-50 border-red-100" : "bg-white border-gray-100"}`}>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1">
            {soldOutCount > 0 && <AlertTriangle size={10} className="text-red-500" />} Sold Out
          </p>
          <p className={`text-3xl font-black ${soldOutCount > 0 ? "text-red-600" : "text-gray-800"}`}>{soldOutCount}</p>
        </div>
        <div className={`rounded-[2rem] border p-5 shadow-sm ${lowCount > 0 ? "bg-amber-50 border-amber-100" : "bg-white border-gray-100"}`}>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Low Stock</p>
          <p className={`text-3xl font-black ${lowCount > 0 ? "text-amber-600" : "text-gray-800"}`}>{lowCount}</p>
        </div>
      </div>

      {/* Toggle: Designs / Materials */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setActiveView("designs")}
          className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-widest transition-all border-2 ${
            activeView === "designs"
              ? "bg-purple-600 text-white border-purple-600 shadow-lg shadow-purple-100"
              : "bg-white text-gray-400 border-gray-200 hover:border-purple-300 hover:text-purple-500"
          }`}
        >
          <Paintbrush size={16} /> Designs
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${activeView === "designs" ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>
            {designs.length}
          </span>
        </button>
        <button
          onClick={() => setActiveView("materials")}
          className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-widest transition-all border-2 ${
            activeView === "materials"
              ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-100"
              : "bg-white text-gray-400 border-gray-200 hover:border-blue-300 hover:text-blue-500"
          }`}
        >
          <Package size={16} /> Materials
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${activeView === "materials" ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>
            {materials.length}
          </span>
        </button>
      </div>

      {/* Items list */}
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        {items.length === 0 ? (
          <div className="p-20 text-center">
            <p className="text-gray-300 font-black uppercase tracking-widest text-sm">
              No {activeView} found
            </p>
            <p className="text-gray-300 text-xs font-bold mt-2">
              Add {activeView} through the Products tab first
            </p>
          </div>
        ) : (
          <div className="p-6 space-y-3">
            {/* Sort: sold out first, then low, then normal */}
            {[
              ...items.filter(i => i.soldOut || i.stock === 0),
              ...items.filter(i => !i.soldOut && i.stock != null && i.stock > 0 && i.stock <= 5),
              ...items.filter(i => !i.soldOut && i.stock != null && i.stock > 5),
              ...items.filter(i => i.stock == null),
            ].map(item => (
              <StockRow
                key={item.id}
                item={item}
                type={activeView}
                onSave={(id, stock, soldOut) => handleSave(activeView, id, stock, soldOut)}
              />
            ))}
          </div>
        )}
      </div>

      {noStockCount > 0 && (
        <p className="text-center text-[10px] font-black text-gray-300 uppercase tracking-widest mt-6">
          {noStockCount} item{noStockCount !== 1 ? "s" : ""} have no stock set — they won&apos;t show as out of stock
        </p>
      )}
    </div>
  );
}
