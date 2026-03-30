"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Check, Minus } from "lucide-react";
import type { Order } from "@/lib/data/types";

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function buildWhatsAppText(orders: Order[]): string {
  const lines: string[] = [
    `\u{1F4E6} Follow-up ${formatDate(new Date())}`,
    "",
  ];

  for (const order of orders) {
    // Add a zero-width space after every 4th digit to prevent WhatsApp
    // from auto-linking tracking numbers as phone numbers
    const tn = order.trackingNumber.replace(/(\d{4})/g, "$1\u200B");
    lines.push(
      `${tn} | ${order.deliveryStatus} | ${order.destinationCity || "N/A"}`
    );
  }

  return lines.join("\n");
}

interface DTDCExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: Order[];
}

export function DTDCExportDialog({
  open,
  onOpenChange,
  orders,
}: DTDCExportDialogProps) {
  // Show all orders that have a tracking number
  const exportableOrders = useMemo(
    () => orders.filter((o) => o.trackingNumber),
    [orders]
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  // Reset selection when dialog opens
  const [prevOpen, setPrevOpen] = useState(false);
  if (open && !prevOpen) {
    setSelected(new Set(exportableOrders.map((o) => o.id)));
  }
  if (open !== prevOpen) setPrevOpen(open);

  const selectedOrders = useMemo(
    () => exportableOrders.filter((o) => selected.has(o.id)),
    [exportableOrders, selected]
  );

  const previewText = useMemo(
    () => buildWhatsAppText(selectedOrders),
    [selectedOrders]
  );

  const allSelected =
    exportableOrders.length > 0 && selected.size === exportableOrders.length;
  const noneSelected = selected.size === 0;

  function toggleOrder(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(exportableOrders.map((o) => o.id)));
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(previewText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col bg-zinc-950 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <DialogTitle className="text-zinc-100 text-base font-semibold">
            Export for DTDC WhatsApp
          </DialogTitle>
        </DialogHeader>

        {exportableOrders.length === 0 ? (
          <p className="text-zinc-500 text-sm py-4">
            No orders with tracking numbers to export.
          </p>
        ) : (
          <>
            {/* Selectable table */}
            <div className="overflow-auto max-h-[40vh] rounded-lg border border-zinc-800 bg-zinc-900/50">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-zinc-900 border-b border-zinc-800">
                    <th className="w-12 px-3 py-2.5 text-left">
                      <button
                        onClick={toggleAll}
                        className="h-[18px] w-[18px] rounded-[4px] border-2 flex items-center justify-center transition-all duration-150"
                        style={{
                          borderColor: allSelected || !noneSelected ? "#3b82f6" : "#52525b",
                          backgroundColor: allSelected ? "#3b82f6" : "transparent",
                        }}
                      >
                        {allSelected ? (
                          <Check className="h-3 w-3 text-white" strokeWidth={3} />
                        ) : !noneSelected ? (
                          <Minus className="h-3 w-3 text-blue-400" strokeWidth={3} />
                        ) : null}
                      </button>
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                      Tracking #
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                      Destination
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {exportableOrders.map((order, i) => {
                    const isSelected = selected.has(order.id);
                    return (
                      <tr
                        key={order.id}
                        className={`cursor-pointer transition-all duration-100 border-b border-zinc-800/60 last:border-b-0 ${
                          isSelected
                            ? "bg-zinc-800/70 hover:bg-zinc-800/90"
                            : "bg-transparent opacity-40 hover:opacity-60"
                        }`}
                        onClick={() => toggleOrder(order.id)}
                      >
                        <td className="px-3 py-2.5">
                          <div
                            className="h-[18px] w-[18px] rounded-[4px] border-2 flex items-center justify-center transition-all duration-150"
                            style={{
                              borderColor: isSelected ? "#3b82f6" : "#52525b",
                              backgroundColor: isSelected ? "#3b82f6" : "transparent",
                            }}
                          >
                            {isSelected && (
                              <Check className="h-3 w-3 text-white" strokeWidth={3} />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[13px] text-zinc-200 font-medium">
                          {order.trackingNumber}
                        </td>
                        <td className="px-4 py-2.5 text-[13px] text-zinc-400">
                          {order.deliveryStatus}
                        </td>
                        <td className="px-4 py-2.5 text-[13px] text-zinc-400">
                          {order.destinationCity || "\u2014"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Preview */}
            <div className="space-y-1.5">
              <p className="text-[11px] text-zinc-600 uppercase tracking-widest font-semibold">
                Preview
              </p>
              <pre className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-[13px] text-zinc-300 whitespace-pre-wrap max-h-[18vh] overflow-auto leading-relaxed">
                {previewText}
              </pre>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-zinc-600">
                {selected.size} of {exportableOrders.length} selected
              </span>
              <Button
                size="sm"
                onClick={handleCopy}
                disabled={noneSelected}
                className={`px-4 transition-all duration-200 ${
                  copied
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20 shadow-lg"
                    : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20 shadow-lg"
                }`}
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 mr-1.5" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 mr-1.5" />
                    Copy to Clipboard
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
