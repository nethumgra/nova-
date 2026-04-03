"use client";
import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from "../../../lib/firebase";
import { doc, getDoc, getDocs, collection, addDoc, onSnapshot, query, orderBy, limit, serverTimestamp } from "firebase/firestore";
import { ShoppingBag, Share2, Plus, Minus, Star, Check, Lock, MessageCircle, Paintbrush, Heart, Package, Scissors, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import CartDrawer from '../../../components/Cartdrawer';

export default function ProductDetails() {
  const { id } = useParams();
  const router = useRouter();
  const [product, setProduct] = useState<any>(null);
  const [relatedProducts, setRelatedProducts] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState('description');
  const [reviewText, setReviewText] = useState("");
  const [reviewerName, setReviewerName] = useState("");
  const [rating, setRating] = useState(5);
  const [isShared, setIsShared] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [wishlistAdded, setWishlistAdded] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);
  const [specialCat, setSpecialCat] = useState<any>(null);

  // Customized product data
  const [materialData, setMaterialData] = useState<any>(null);
  const [designsData, setDesignsData] = useState<any[]>([]);
  const [selectedDesignId, setSelectedDesignId] = useState<string>("");

  useEffect(() => {
    if (!id) return;
    const fetchProduct = async () => {
      try {
        const snap = await getDoc(doc(db, "products", id as string));
        if (snap.exists()) { setProduct({ id: snap.id, ...snap.data() }); setActiveImageIndex(0); }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    const fetchRelated = async () => {
      const snap = await getDocs(query(collection(db, "products"), limit(7)));
      setRelatedProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.id !== id).slice(0, 6));
    };
    const unsubReviews = onSnapshot(
      query(collection(db, "products", id as string, "reviews"), orderBy("createdAt", "desc")),
      snap => setReviews(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    fetchProduct(); fetchRelated();
    return () => unsubReviews();
  }, [id]);

  useEffect(() => {
    if (!product?.specialCategory) { setSpecialCat(null); return; }
    const unsub = onSnapshot(
      doc(db, "specialCategories", product.specialCategory),
      snap => setSpecialCat(snap.exists() ? { id: snap.id, ...snap.data() } : null),
      () => setSpecialCat(null)
    );
    return () => unsub();
  }, [product?.specialCategory]);

  // Fetch material + designs for customized products
  useEffect(() => {
    if (!product || product.productType !== 'customized') return;
    let unsubMat: (() => void) | undefined;
    if (product.materialId) {
      unsubMat = onSnapshot(doc(db, "materials", product.materialId), snap => {
        setMaterialData(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      });
    }
    const designIds: string[] = product.selectedDesignIds || [];
    const unsubDesigns = designIds.map((did: string) =>
      onSnapshot(doc(db, "designs", did), snap => {
        if (snap.exists()) {
          setDesignsData(prev => {
            const rest = prev.filter(d => d.id !== did);
            const updated = [...rest, { id: snap.id, ...snap.data() }];
            // Auto-select first design if nothing selected yet
            if (!selectedDesignId) {
              setSelectedDesignId(snap.id);
            }
            return updated;
          });
        }
      })
    );
    return () => { unsubMat?.(); unsubDesigns.forEach(u => u()); };
  }, [product]);

  const resolvedPrice = Number(product?.discountedPrice ?? product?.price ?? product?.salePrice ?? 0);
  const resolvedDelivery = Number(product?.deliveryCharge ?? 350);
  const isCustomized = product?.productType === 'customized';
  const readyMadeCode = product?.readyMadeCode ?? '';
  const selectedDesign = designsData.find(d => d.id === selectedDesignId) ?? designsData[0] ?? null;
  const materialInStock = !materialData || materialData.stock == null || materialData.stock > 0;
  const designInStock = !selectedDesign || selectedDesign.stock == null || selectedDesign.stock > 0;
  const isOutOfStock = isCustomized
    ? (!materialData || !materialInStock || designsData.length === 0 || !designInStock)
    : (product?.stock === 0);
  // Price shown to customer = always the product's sale price (discountedPrice)
  // Material price + Design price are INTERNAL admin codes — never shown to customer
  const displayPrice = resolvedPrice;

  const handleAddToCart = () => {
    if (!product || isOutOfStock) return;
    const cartItem = {
      id: product.id, name: product.name, price: displayPrice,
      image: product.images?.[0] ?? '', qty: quantity,
      deliveryCharge: resolvedDelivery, mainCategory: product.mainCategory ?? '',
      productType: product.productType ?? 'ready',
      materialId: product.materialId ?? '', materialImage: materialData?.image ?? '',
      selectedDesignId: selectedDesign?.id ?? '', designImage: selectedDesign?.image ?? '',
    };
    const existing: any[] = JSON.parse(localStorage.getItem('loversmart_cart') || '[]');
    const idx = existing.findIndex((i: any) => i.id === product.id);
    if (idx > -1) { existing[idx].qty += quantity; } else { existing.push(cartItem); }
    localStorage.setItem('loversmart_cart', JSON.stringify(existing));
    window.dispatchEvent(new Event('cart-updated'));
    setAddedToCart(true); setTimeout(() => setAddedToCart(false), 2000);
  };

  const handleCheckout = () => {
    if (!product || isOutOfStock) return;
    const subtotal = displayPrice * quantity;
    localStorage.setItem('loversmart_checkout', JSON.stringify({
      items: [{ id: product.id, name: product.name, price: displayPrice, image: product.images?.[0] ?? '',
        qty: quantity, deliveryCharge: resolvedDelivery, productType: product.productType ?? 'ready',
        materialId: product.materialId ?? '', materialImage: materialData?.image ?? '',
        selectedDesignId: selectedDesign?.id ?? '', designImage: selectedDesign?.image ?? '',
      }],
      subtotal, deliveryFee: resolvedDelivery, total: subtotal + resolvedDelivery,
    }));
    router.push('/checkout');
  };

  const handleAddToWishlist = () => {
    if (!product) return;
    const existing: any[] = JSON.parse(localStorage.getItem('loversmart_wishlist') || '[]');
    if (!existing.find((i: any) => i.id === product.id)) {
      existing.push({ id: product.id, name: product.name, price: displayPrice, image: product.images?.[0] ?? '' });
      localStorage.setItem('loversmart_wishlist', JSON.stringify(existing));
    }
    setWishlistAdded(true); window.dispatchEvent(new Event('wishlist-updated'));
  };

  const handleCustomize = () => {
    if (!specialCat) return;
    window.open(`${specialCat.chatLink || 'https://wa.me/'}?text=${encodeURIComponent(`Hi! I want to customize: *${product.name}*\nPlease share options & pricing 🌸`)}`, '_blank');
  };
  const handleBuyThis = () => {
    if (!specialCat) return;
    window.open(`${specialCat.chatLink || 'https://wa.me/'}?text=${encodeURIComponent(`Hi! I want to buy: *${product.name}*\nPrice: Rs. ${displayPrice.toLocaleString()}\nPlease confirm availability 🛒`)}`, '_blank');
  };
  const handleShare = async () => {
    if (navigator.share) { try { await navigator.share({ title: product.name, url: window.location.href }); } catch {} }
    else { navigator.clipboard.writeText(window.location.href); setIsShared(true); setTimeout(() => setIsShared(false), 2000); }
  };
  const handleAddReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return alert("Please login!");
    if (!reviewText || !reviewerName) return alert("Please fill all fields");
    try {
      await addDoc(collection(db, "products", id as string, "reviews"), { name: reviewerName, comment: reviewText, rating, createdAt: serverTimestamp() });
      setReviewText(""); setReviewerName("");
    } catch (e) { console.error(e); }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7f7f8]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-[#111] border-t-transparent rounded-full animate-spin" />
        <p className="font-black text-[#111] text-xs uppercase tracking-widest animate-pulse">Loading...</p>
      </div>
    </div>
  );
  if (!product) return <div className="min-h-screen flex items-center justify-center text-red-500 font-bold">Product Not Found!</div>;

  // For customized: selected design image comes FIRST, then product images, then material
  const galleryImages = isCustomized
    ? [
        ...(selectedDesign?.image ? [selectedDesign.image] : []),
        ...(product.images || []).filter((img: string) => img !== selectedDesign?.image),
        ...(materialData?.image && materialData.image !== selectedDesign?.image ? [materialData.image] : []),
      ]
    : (product.images || []);

  return (
    <main className="bg-[#f7f7f8] min-h-screen pb-24">
      <CartDrawer />

      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 md:py-8">

        {/* Breadcrumb */}
        <div className="hidden sm:flex items-center gap-2 mb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest flex-wrap">
          <Link href="/" className="hover:text-[#111] transition-colors">Home</Link>
          <span>/</span>
          <Link href="/shop" className="hover:text-[#111] transition-colors">Shop</Link>
          {product.mainCategory && <><span>/</span><span>{product.mainCategory}</span></>}
          <span>/</span>
          <span className="text-[#111] line-clamp-1">{product.name}</span>
        </div>

        {/* Mobile: info panel first, then images. Desktop: images left, info right */}
        <div className="flex flex-col xl:flex-row gap-6">

          {/* ── LEFT: Images + Tabs (moves below info on mobile) ── */}
          <div className="flex-1 min-w-0 space-y-4 order-2 xl:order-1">

            {/* Image card */}
            <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex">
                {/* Desktop thumbnails */}
                {galleryImages.length > 1 && (
                  <div className="hidden md:flex flex-col gap-2 p-4 w-[72px] shrink-0">
                    {galleryImages.map((img: string, i: number) => (
                      <button key={i} onClick={() => setActiveImageIndex(i)}
                        className={`w-12 h-14 rounded-xl overflow-hidden border-2 transition-all ${
                          activeImageIndex === i ? "border-[#111] shadow-md scale-95" : "border-transparent opacity-40 hover:opacity-100"
                        }`}>
                        <img src={img} className="w-full h-full object-cover" alt="" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Main image */}
                <div className="flex-1 relative">
                  <div className="relative bg-[#f8f8f8]" style={{ aspectRatio: "3/4" }}>
                    <img src={galleryImages[activeImageIndex] || galleryImages[0]} className="w-full h-full object-contain transition-all duration-500" alt={product.name} />
                    {isOutOfStock && (
                      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center">
                        <span className="bg-white text-[#111] font-black text-sm uppercase tracking-widest px-6 py-3 rounded-2xl shadow-xl">Out of Stock</span>
                      </div>
                    )}
                    <button onClick={handleShare} className="absolute top-4 right-4 p-3 bg-white/90 backdrop-blur-sm rounded-full shadow-sm hover:scale-110 transition-all z-10">
                      {isShared ? <Check size={18} className="text-green-500" /> : <Share2 size={18} className="text-gray-700" />}
                    </button>
                    {galleryImages.length > 1 && (
                      <>
                        <button onClick={() => setActiveImageIndex(i => Math.max(0, i - 1))} className="md:hidden absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-white/80 rounded-full shadow-sm"><ChevronLeft size={16} /></button>
                        <button onClick={() => setActiveImageIndex(i => Math.min(galleryImages.length - 1, i + 1))} className="md:hidden absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-white/80 rounded-full shadow-sm"><ChevronRight size={16} /></button>
                        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 md:hidden">
                          {galleryImages.map((_: string, i: number) => (
                            <button key={i} onClick={() => setActiveImageIndex(i)} className={`rounded-full transition-all ${activeImageIndex === i ? "w-4 h-1.5 bg-[#111]" : "w-1.5 h-1.5 bg-gray-300"}`} />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  {galleryImages.length > 1 && (
                    <div className="flex md:hidden gap-2 p-4 overflow-x-auto no-scrollbar">
                      {galleryImages.map((img: string, i: number) => (
                        <button key={i} onClick={() => setActiveImageIndex(i)} className={`w-14 h-16 rounded-xl overflow-hidden border-2 flex-shrink-0 transition-all ${activeImageIndex === i ? "border-[#111] scale-95" : "border-transparent opacity-50"}`}>
                          <img src={img} className="w-full h-full object-cover" alt="" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex bg-gray-50/80 p-1.5 gap-1">
                {['description', 'delivery', 'reviews'].map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-3 text-[10px] font-black uppercase tracking-[0.12em] rounded-2xl transition-all ${activeTab === tab ? "bg-white text-[#111] shadow-sm" : "text-gray-400 hover:text-[#111]"}`}>
                    {tab}{tab === 'reviews' && reviews.length > 0 ? ` (${reviews.length})` : ''}
                  </button>
                ))}
              </div>
              <div className="p-5 md:p-10">
                {activeTab === 'description' && (
                  <div className="text-gray-600 leading-relaxed font-medium text-base whitespace-pre-line">
                    {product.description || "No description provided."}
                  </div>
                )}
                {activeTab === 'delivery' && (
                  <div className="space-y-3">
                    {[["🚚","Island-wide delivery (3–5 days)"],["🛡️","Secure packaging guaranteed"],["💳","Cash on Delivery available"],["🏦","Bank transfer accepted"]].map(([icon, text], i) => (
                      <div key={i} className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl">
                        <span className="text-xl">{icon}</span>
                        <p className="font-bold text-gray-700 text-sm">{text}</p>
                      </div>
                    ))}
                    <div className="mt-4 p-4 bg-gray-100 rounded-2xl">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Delivery Fee</p>
                      <p className="text-2xl font-black text-[#111] mt-1">Rs. {resolvedDelivery.toLocaleString()}</p>
                    </div>
                  </div>
                )}
                {activeTab === 'reviews' && (
                  <div className="space-y-8">
                    {!user ? (
                      <div className="p-10 bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-200 text-center">
                        <Lock className="mx-auto mb-4 text-[#111]" size={28} />
                        <h3 className="font-black text-gray-800 uppercase tracking-widest text-sm">Login to Review</h3>
                        <button className="mt-5 px-8 py-3 bg-[#111] text-white font-black rounded-xl text-xs uppercase tracking-widest">Login Now</button>
                      </div>
                    ) : (
                      <div className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100">
                        <form onSubmit={handleAddReview} className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <input type="text" placeholder="Your Name" value={reviewerName} onChange={e => setReviewerName(e.target.value)} className="w-full p-4 bg-white rounded-2xl outline-none font-bold text-sm border border-gray-100 focus:border-[#111] transition-all" />
                            <div className="flex items-center gap-2 px-5 bg-white rounded-2xl border border-gray-100 min-h-[52px]">
                              <span className="text-[10px] font-black text-gray-400 uppercase shrink-0">Rating:</span>
                              {[1,2,3,4,5].map(s => <Star key={s} size={16} onClick={() => setRating(s)} className={`cursor-pointer transition-colors ${s <= rating ? "text-yellow-400 fill-yellow-400" : "text-gray-200"}`} />)}
                            </div>
                          </div>
                          <textarea placeholder="Tell us what you think..." value={reviewText} onChange={e => setReviewText(e.target.value)} className="w-full p-4 bg-white rounded-2xl outline-none h-28 font-medium text-sm border border-gray-100 focus:border-[#111] transition-all resize-none" />
                          <button type="submit" className="w-full py-4 bg-[#111] text-white font-black rounded-2xl text-xs uppercase tracking-widest">Post Review</button>
                        </form>
                      </div>
                    )}
                    <div className="space-y-4">
                      <h3 className="font-black text-gray-800 text-sm uppercase tracking-widest">Reviews ({reviews.length})</h3>
                      {reviews.length === 0 ? <p className="text-gray-400 text-sm font-medium italic">No reviews yet. Be the first!</p> : reviews.map(r => (
                        <div key={r.id} className="flex gap-4 p-5 bg-white rounded-3xl border border-gray-100">
                          <div className="w-10 h-10 bg-[#111] text-white flex items-center justify-center rounded-2xl font-black text-sm uppercase shrink-0">{r.name?.[0] || "?"}</div>
                          <div className="flex-1">
                            <div className="flex justify-between items-center mb-1">
                              <h4 className="font-black text-gray-800 text-sm">{r.name}</h4>
                              <div className="flex text-yellow-400">{Array(r.rating||5).fill(0).map((_,i)=><Star key={i} size={11} fill="currentColor"/>)}</div>
                            </div>
                            <p className="text-gray-500 text-xs font-medium leading-relaxed">{r.comment}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── RIGHT: Product Info + Actions (shows FIRST on mobile) ── */}
          <div className="w-full xl:w-[420px] shrink-0 space-y-4 order-1 xl:order-2">

            <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] shadow-sm border border-gray-100 p-5 md:p-8">

              {/* Type badge + category */}
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${isCustomized ? "bg-[#111] text-white" : "bg-rose-50 text-[#c12a52] border border-rose-100"}`}>
                  {isCustomized ? <><Scissors size={10}/> Customized</> : <><Package size={10}/> Ready Made</>}
                </span>
                {product.subCategory && (
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">{product.subCategory}</span>
                )}
              </div>

              {/* Name */}
              <h1 className="text-xl md:text-3xl font-black text-gray-900 leading-tight">{product.name}</h1>

              {/* Stars */}
              {reviews.length > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex text-yellow-400">
                    {Array(Math.round(reviews.reduce((s,r)=>s+(r.rating||5),0)/reviews.length)).fill(0).map((_,i)=><Star key={i} size={12} fill="currentColor"/>)}
                  </div>
                  <span className="text-[11px] font-black text-gray-400">{reviews.length} review{reviews.length!==1?'s':''}</span>
                </div>
              )}

              {/* Price */}
              <div className="mt-6">
                {product.originalPrice > 0 && product.originalPrice > displayPrice && (
                  <p className="text-sm font-bold text-gray-300 line-through">Rs. {Number(product.originalPrice).toLocaleString()}</p>
                )}
                <div className="flex items-baseline gap-3">
                  <p className="text-3xl md:text-4xl font-black text-[#111]">Rs. {displayPrice.toLocaleString()}</p>
                  {product.originalPrice > displayPrice && (
                    <span className="text-xs font-black text-green-600 bg-green-50 px-2 py-1 rounded-full">{Math.round((1-displayPrice/product.originalPrice)*100)}% OFF</span>
                  )}
                </div>

              </div>

              {/* Ready Made code */}
              {!isCustomized && readyMadeCode && (
                <div className="mt-4 flex items-center gap-2 px-4 py-2.5 bg-gray-50 rounded-2xl border border-gray-100 w-fit">
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Code:</span>
                  <span className="font-black text-gray-700 tracking-[0.2em] text-sm">{readyMadeCode}</span>
                </div>
              )}

              {/* ── Customized: Material + Design ── */}
              {isCustomized && (
                <div className="mt-6 space-y-3">
                  {/* Material */}
                  {materialData && (
                    <div className="flex items-center gap-3 p-3 md:p-4 bg-blue-50/70 border border-blue-100 rounded-2xl">
                      <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl overflow-hidden border-2 border-blue-200 shrink-0">
                        <img src={materialData.image} className="w-full h-full object-cover" alt="material" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-0.5">🧵 Material</p>

                        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase mt-1 ${materialInStock ? "bg-green-100 text-green-600" : "bg-red-100 text-red-500"}`}>
                          <span className={`w-1 h-1 rounded-full ${materialInStock ? "bg-green-500" : "bg-red-500"}`} />
                          {materialInStock ? (materialData.stock!=null ? `${materialData.stock} in stock` : "Available") : "Out of Stock"}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Design selector */}
                  {designsData.length > 0 && (
                    <div className="p-4 bg-purple-50/70 border border-purple-100 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[9px] font-black text-purple-500 uppercase tracking-widest">🎨 Select Design</p>
                        <span className="text-[9px] font-black text-purple-400 bg-purple-100 px-2 py-0.5 rounded-full">{designsData.length} available</span>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {designsData.map((d: any) => {
                          const isSel = (selectedDesignId || designsData[0]?.id) === d.id;
                          const dOut = d.stock === 0;
                          return (
                            <button key={d.id} type="button" onClick={() => { if (!dOut) { setSelectedDesignId(d.id); setActiveImageIndex(0); } }} disabled={dOut}
                              className={`relative w-16 h-16 md:w-16 md:h-16 rounded-2xl overflow-hidden border-2 transition-all shrink-0 ${isSel ? "border-purple-500 shadow-lg ring-2 ring-purple-200 ring-offset-1" : dOut ? "border-gray-200 opacity-40 cursor-not-allowed" : "border-gray-200 hover:border-purple-300 active:scale-95"}`}>
                              <img src={d.image} className="w-full h-full object-cover" alt="" />
                              {isSel && <div className="absolute inset-0 bg-purple-500/30 flex items-center justify-center"><Check size={16} className="text-white drop-shadow" /></div>}
                              {dOut && <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><span className="text-white text-[6px] font-black uppercase text-center leading-tight">Out of<br/>Stock</span></div>}

                            </button>
                          );
                        })}
                      </div>
                      {selectedDesign && (
                        <div className="flex items-center justify-between pt-2 border-t border-purple-100">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg overflow-hidden border border-purple-200 shrink-0">
                              <img src={selectedDesign.image} className="w-full h-full object-cover" alt="" />
                            </div>
                            <div>
                              <p className="text-[9px] font-black text-purple-400 uppercase">Selected</p>

                            </div>
                          </div>
                          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[8px] font-black uppercase ${designInStock ? "bg-green-100 text-green-600" : "bg-red-100 text-red-500"}`}>
                            <span className={`w-1 h-1 rounded-full ${designInStock ? "bg-green-500" : "bg-red-500"}`} />
                            {designInStock ? (selectedDesign.stock!=null?`${selectedDesign.stock} left`:"Available") : "Sold Out"}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Quantity */}
              {!isOutOfStock && (
                <div className="mt-6">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Quantity</p>
                  <div className="flex items-center gap-2 bg-gray-50 w-fit rounded-2xl p-1.5 border border-gray-100">
                    <button onClick={() => setQuantity(q => Math.max(1, q-1))} className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-sm hover:bg-gray-100 transition-all"><Minus size={15}/></button>
                    <span className="w-10 text-center font-black text-xl">{quantity}</span>
                    <button onClick={() => setQuantity(q => q+1)} className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-sm hover:bg-gray-100 transition-all"><Plus size={15}/></button>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="mt-6 flex flex-col gap-3">
                {specialCat ? (
                  <>
                    <div className="flex items-center gap-4 rounded-[1.5rem] px-5 py-4 border" style={{ backgroundColor: `${specialCat.accentColor}10`, borderColor: `${specialCat.accentColor}30` }}>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: specialCat.accentColor }}>
                        <MessageCircle size={16} className="text-white" />
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: specialCat.accentColor }}>Special Item ✨</p>
                        <p className="text-sm font-bold text-gray-700">Chat for best experience</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={handleCustomize} className="flex-1 py-4 font-black rounded-2xl text-xs uppercase tracking-widest text-white flex items-center justify-center gap-2 shadow-lg hover:opacity-90 transition-all active:scale-95" style={{ backgroundColor: specialCat.accentColor }}>
                        <Paintbrush size={15}/> Customize
                      </button>
                      <button onClick={handleBuyThis} className="flex-1 py-4 font-black rounded-2xl text-xs uppercase tracking-widest border-2 flex items-center justify-center gap-2 transition-all active:scale-95" style={{ color: specialCat.accentColor, borderColor: `${specialCat.accentColor}50` }}>
                        <ShoppingBag size={15}/> Buy This
                      </button>
                    </div>
                  </>
                ) : isOutOfStock ? (
                  <div className="w-full py-5 bg-gray-100 text-gray-400 font-black rounded-2xl text-xs uppercase tracking-widest text-center border border-gray-200">
                    Out of Stock
                  </div>
                ) : (
                  <>
                    <button onClick={handleCheckout} className="w-full py-4 md:py-5 bg-[#111] text-white font-black rounded-2xl text-xs uppercase tracking-widest shadow-xl hover:opacity-90 transition-all active:scale-95 flex items-center justify-center gap-2">
                      <ShoppingBag size={16}/> Buy It Now
                    </button>
                    <button onClick={handleAddToCart} className={`w-full py-4 border-2 font-black rounded-2xl text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 ${addedToCart ? "bg-green-50 border-green-300 text-green-700" : "border-[#111] text-[#111] hover:bg-gray-50"}`}>
                      {addedToCart ? <><Check size={15}/> Added!</> : <><ShoppingBag size={15}/> Add to Cart</>}
                    </button>
                  </>
                )}
                <button onClick={handleAddToWishlist} className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all border ${wishlistAdded ? "bg-gray-50 border-gray-300 text-gray-700" : "bg-transparent border-gray-200 text-gray-400 hover:border-gray-400 hover:text-gray-700"}`}>
                  <Heart size={14} className={wishlistAdded ? "fill-current" : ""} />
                  {wishlistAdded ? "Saved ✓" : "Save to Wishlist"}
                </button>
              </div>
            </div>

            {/* Related products */}
            {relatedProducts.length > 0 && (
              <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] shadow-sm border border-gray-100 p-5">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-1 h-5 bg-[#111] rounded-full"/>
                  <h2 className="text-sm font-black text-gray-800 uppercase tracking-widest">More For You</h2>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {relatedProducts.slice(0,4).map(p => (
                    <Link key={p.id} href={`/product/${p.id}`} className="group rounded-2xl overflow-hidden border border-gray-100 bg-gray-50 hover:shadow-md hover:-translate-y-0.5 transition-all">
                      <div className="aspect-[3/4] overflow-hidden bg-gray-100">
                        <img src={p.images?.[0]} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={p.name} />
                      </div>
                      <div className="p-3">
                        <p className="text-[10px] font-bold text-gray-700 line-clamp-2 leading-tight mb-1">{p.name}</p>
                        <p className="text-sm font-black text-[#111]">Rs. {(p.discountedPrice||p.price||0).toLocaleString()}</p>
                      </div>
                    </Link>
                  ))}
                </div>
                <Link href="/shop" className="mt-4 flex items-center justify-center w-full py-3 bg-gray-50 hover:bg-[#111] hover:text-white text-gray-500 font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all border border-gray-100">
                  View All
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}