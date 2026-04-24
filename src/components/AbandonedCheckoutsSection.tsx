"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { AbandonedCheckout } from "@/lib/data/types";
import {
  RefreshCw,
  ShoppingCart,
  MessageCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  Phone,
} from "lucide-react";

function formatPrice(price: string): string {
  const num = parseFloat(price);
  if (isNaN(num)) return `₹${price}`;
  return `₹${Math.round(num).toLocaleString("en-IN")}`;
}

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "< 1h ago";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const CELL_PX = 800;
const CELL_PAD_PX = 20;

function notifyPasteReady() {
  if (typeof window === "undefined" || typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification("Cart photo ready", {
      body: "Ctrl+V in WhatsApp → Send (photo goes first). Then hit Enter to send the text.",
      tag: "abandoned-wa-paste",
    });
  } catch {
    // Notification constructor can throw on some platforms; ignore.
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawContain(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cellX: number,
  cellY: number,
  cellW: number,
  cellH: number
) {
  const inner = { x: cellX + CELL_PAD_PX, y: cellY + CELL_PAD_PX, w: cellW - CELL_PAD_PX * 2, h: cellH - CELL_PAD_PX * 2 };
  const imgAspect = img.width / img.height;
  const cellAspect = inner.w / inner.h;
  let drawW: number;
  let drawH: number;
  if (imgAspect > cellAspect) {
    drawW = inner.w;
    drawH = inner.w / imgAspect;
  } else {
    drawH = inner.h;
    drawW = inner.h * imgAspect;
  }
  const dx = inner.x + (inner.w - drawW) / 2;
  const dy = inner.y + (inner.h - drawH) / 2;
  ctx.drawImage(img, dx, dy, drawW, drawH);
}

async function buildCompositeBlob(productIds: string[]): Promise<Blob> {
  if (productIds.length === 0) throw new Error("no productIds");

  const res = await fetch("/api/abandoned-checkouts/item-images", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productIds }),
  });
  if (!res.ok) throw new Error(`item-images fetch failed: ${res.status}`);
  const data = (await res.json()) as {
    images: { productId: string; imageUrl: string | null }[];
  };
  console.log("[abandoned-wa] image URLs:", data.images);

  const urlByProductId = new Map(
    data.images.map((i) => [i.productId, i.imageUrl])
  );
  const orderedUrls = productIds
    .map((id) => urlByProductId.get(id))
    .filter((u): u is string => typeof u === "string" && u.length > 0);

  if (orderedUrls.length === 0) throw new Error("no image URLs returned");

  const images = await Promise.all(
    orderedUrls.map(async (u) => {
      try {
        return await loadImage(u);
      } catch (err) {
        console.warn("[abandoned-wa] image load failed:", u, err);
        return null;
      }
    })
  );
  const drawable = images.filter((i): i is HTMLImageElement => i !== null);
  console.log(
    `[abandoned-wa] images loaded: ${drawable.length}/${orderedUrls.length}`
  );
  if (drawable.length === 0) throw new Error("no images loaded");

  const cols = drawable.length === 1 ? 1 : 2;
  const rows = Math.ceil(drawable.length / cols);
  const canvas = document.createElement("canvas");
  canvas.width = cols * CELL_PX;
  canvas.height = rows * CELL_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawable.forEach((img, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    drawContain(ctx, img, col * CELL_PX, row * CELL_PX, CELL_PX, CELL_PX);
  });

  const pngBlob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png")
  );
  if (!pngBlob) throw new Error("canvas.toBlob returned null");
  console.log("[abandoned-wa] composite blob bytes:", pngBlob.size);
  return pngBlob;
}

export function AbandonedCheckoutsSection() {
  const [checkouts, setCheckouts] = useState<AbandonedCheckout[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hideNoPhone, setHideNoPhone] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchCheckouts = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/shopify/abandoned-checkouts");
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to load abandoned checkouts");
        return;
      }
      setCheckouts(json.checkouts || []);
    } catch {
      setError("Network error loading abandoned checkouts");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCheckouts();
  }, [fetchCheckouts]);

  // Ask for Notification permission once up-front so the first WA click
  // doesn't race the permission prompt.
  useEffect(() => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Clipboard.write() needs user activation. We call it synchronously here
  // with a Promise-of-Blob ClipboardItem so the browser reserves the slot
  // before we lose activation across awaits. Reserve-tab pattern for the
  // window.open, same as handleAssignTracking.
  const sendWhatsApp = async (checkout: AbandonedCheckout) => {
    let phone = checkout.customerPhone.replace(/\D/g, "");
    if (phone.length === 11 && phone.startsWith("0")) phone = phone.slice(1);
    if (phone.length === 10) phone = `91${phone}`;
    if (phone.length < 10) return;

    const productIds = checkout.lineItems
      .map((li) => li.productId)
      .filter((id): id is string => !!id);
    console.log("[abandoned-wa] productIds:", productIds);

    let clipboardWrite: Promise<void> | null = null;
    if (productIds.length > 0 && typeof ClipboardItem !== "undefined") {
      const blobPromise = buildCompositeBlob(productIds);
      blobPromise.catch((err) =>
        console.warn("[abandoned-wa] composite build failed:", err)
      );
      try {
        clipboardWrite = navigator.clipboard.write([
          new ClipboardItem({ "image/png": blobPromise }),
        ]);
      } catch (err) {
        console.warn("[abandoned-wa] clipboard.write threw:", err);
      }
    }

    const waTab = window.open("about:blank");

    const firstName = checkout.customerName.split(" ")[0];
    const E = {
      wave: String.fromCodePoint(0x1f44b),
      bag: String.fromCodePoint(0x1f6cd, 0xfe0f),
      heart: String.fromCodePoint(0x1f49c),
    };

    const recoveryLine = checkout.checkoutUrl
      ? `Complete your order: ${checkout.checkoutUrl}\n`
      : "";

    const message = `Hi ${firstName}! ${E.wave}

Looks like this caught your eye — and then got left behind in your *Urban Naari* cart! ${E.bag}

We're holding it for you. If you need help with sizing, fit, or fabric, just reply here. ${E.heart}

${recoveryLine}-- Team Urban Naari`;

    const url = new URL("https://web.whatsapp.com/send");
    url.searchParams.set("phone", phone);
    url.searchParams.set("text", message);
    // Tell the auto-send extension to stay out of this flow — operator will
    // paste+send the cart photo FIRST, then hit Enter to send the prefilled text.
    url.searchParams.set("autosend", "0");

    if (waTab) waTab.location.href = url.toString();
    else window.open(url.toString());

    if (clipboardWrite) {
      try {
        await clipboardWrite;
        console.log("[abandoned-wa] clipboard write succeeded");
        notifyPasteReady();
      } catch (err) {
        console.warn("[abandoned-wa] clipboard write failed:", err);
      }
    }

    fetch(`/api/abandoned-checkouts/${checkout.id}/wa-sent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: checkout.customerName,
        customerPhone: checkout.customerPhone,
        totalPrice: checkout.totalPrice,
        checkoutUrl: checkout.checkoutUrl,
      }),
    })
      .then((res) => {
        if (!res.ok) {
          alert(`Failed to record WA sent (${res.status})`);
          return;
        }
        setCheckouts((prev) =>
          prev.map((c) =>
            c.id === checkout.id ? { ...c, waMessageSent: true } : c
          )
        );
      })
      .catch((err) => {
        alert(`Failed to record WA sent: ${err?.message || String(err)}`);
      });
  };

  const hasValidPhone = (raw: string) => {
    let p = raw.replace(/\D/g, "");
    if (p.length === 11 && p.startsWith("0")) p = p.slice(1);
    if (p.length === 10) p = `91${p}`;
    return p.length >= 10;
  };

  const displayed = hideNoPhone
    ? checkouts.filter((c) => hasValidPhone(c.customerPhone))
    : checkouts;

  const totalValue = displayed.reduce(
    (sum, c) => sum + (parseFloat(c.totalPrice) || 0),
    0
  );
  const messagedCount = displayed.filter((c) => c.waMessageSent).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading abandoned checkouts...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-orange-400" />
            Abandoned Checkouts
          </h2>
          {displayed.length > 0 && (
            <p className="text-xs text-zinc-500 mt-0.5">
              {displayed.length} abandoned ·{" "}
              ₹{Math.round(totalValue).toLocaleString("en-IN")} potential ·{" "}
              {messagedCount} messaged
            </p>
          )}
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
            <Switch checked={hideNoPhone} onCheckedChange={setHideNoPhone} />
            <Phone className="h-3.5 w-3.5" />
            Only with phone
          </label>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchCheckouts(true)}
            disabled={refreshing}
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 bg-transparent"
          >
            <RefreshCw
              className={`h-4 w-4 mr-1.5 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-zinc-500 space-y-2">
          <ShoppingCart className="h-10 w-10 text-zinc-700" />
          <p className="text-sm">
            {hideNoPhone
              ? "No abandoned checkouts with phone numbers"
              : "No abandoned checkouts in the last 7 days"}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800/60 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800/60 hover:bg-transparent">
                <TableHead className="text-zinc-500 font-medium w-8" />
                <TableHead className="text-zinc-500 font-medium">Customer</TableHead>
                <TableHead className="text-zinc-500 font-medium">Phone</TableHead>
                <TableHead className="text-zinc-500 font-medium">Cart Value</TableHead>
                <TableHead className="text-zinc-500 font-medium">Items</TableHead>
                <TableHead className="text-zinc-500 font-medium">Abandoned</TableHead>
                <TableHead className="text-zinc-500 font-medium text-right">WhatsApp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayed.map((checkout) => {
                const isExpanded = expandedId === checkout.id;
                const hasPhone = hasValidPhone(checkout.customerPhone);

                return (
                  <Fragment key={checkout.id}>
                    <TableRow
                      className="border-zinc-800/40 hover:bg-zinc-800/30 cursor-pointer"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : checkout.id)
                      }
                    >
                      <TableCell className="text-zinc-600 py-3">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </TableCell>
                      <TableCell className="py-3">
                        <span className="text-zinc-200 text-sm font-medium">
                          {checkout.customerName}
                        </span>
                        {checkout.customerEmail && (
                          <p className="text-xs text-zinc-500 mt-0.5">
                            {checkout.customerEmail}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="py-3 text-sm text-zinc-400">
                        {hasPhone ? (
                          checkout.customerPhone
                        ) : (
                          <span className="text-zinc-600 italic text-xs">
                            no phone
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="py-3">
                        <span className="text-sm font-semibold text-emerald-400">
                          {formatPrice(checkout.totalPrice)}
                        </span>
                      </TableCell>
                      <TableCell className="py-3 text-sm text-zinc-400">
                        {checkout.lineItems.length} item
                        {checkout.lineItems.length !== 1 ? "s" : ""}
                      </TableCell>
                      <TableCell className="py-3 text-sm text-zinc-500">
                        {timeAgo(checkout.updatedAt)}
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {checkout.waMessageSent && (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                              <Check className="h-3.5 w-3.5" />
                              Sent
                            </span>
                          )}
                          <Button
                            size="sm"
                            disabled={!hasPhone}
                            onClick={(e) => {
                              e.stopPropagation();
                              sendWhatsApp(checkout);
                            }}
                            className={`h-7 px-2.5 text-xs border disabled:opacity-40 ${
                              checkout.waMessageSent
                                ? "bg-zinc-800/60 hover:bg-zinc-700/60 text-zinc-400 border-zinc-700/50"
                                : "bg-green-600/20 hover:bg-green-600/30 text-green-400 border-green-600/30"
                            }`}
                            variant="outline"
                          >
                            <MessageCircle className="h-3.5 w-3.5 mr-1" />
                            {checkout.waMessageSent ? "Resend" : "WhatsApp"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow className="border-zinc-800/40 bg-zinc-900/50">
                        <TableCell colSpan={7} className="py-3 px-6">
                          <div className="space-y-1">
                            <p className="text-xs text-zinc-500 font-medium mb-2">
                              Cart items
                            </p>
                            {checkout.lineItems.length === 0 ? (
                              <p className="text-xs text-zinc-600">
                                No items available
                              </p>
                            ) : (
                              checkout.lineItems.map((li, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between text-sm"
                                >
                                  <span className="text-zinc-300">
                                    {li.title}
                                    {li.variantTitle && (
                                      <span className="text-zinc-500">
                                        {" "}
                                        ({li.variantTitle})
                                      </span>
                                    )}
                                    <span className="text-zinc-500">
                                      {" "}
                                      × {li.quantity}
                                    </span>
                                  </span>
                                  <span className="text-zinc-400 text-xs">
                                    {formatPrice(li.price)}
                                  </span>
                                </div>
                              ))
                            )}
                            {checkout.checkoutUrl && (
                              <div className="mt-3 pt-3 border-t border-zinc-800/60">
                                <a
                                  href={checkout.checkoutUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-400 hover:text-blue-300 underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  View checkout →
                                </a>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
