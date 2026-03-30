"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Minus, Download, Loader2 } from "lucide-react";
import type { Order, ShippingRateTable } from "@/lib/data/types";
import { calculateShippingCharge } from "@/lib/shipping";

interface ShippingExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: Order[];
  shippingConfig: ShippingRateTable;
}

export function ShippingExportDialog({
  open,
  onOpenChange,
  orders,
  shippingConfig,
}: ShippingExportDialogProps) {
  const exportableOrders = useMemo(
    () => orders.filter((o) => o.weightGrams > 0 && o.shippingMode),
    [orders]
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);

  const [prevOpen, setPrevOpen] = useState(false);
  if (open && !prevOpen) {
    setSelected(new Set(exportableOrders.map((o) => o.id)));
  }
  if (open !== prevOpen) setPrevOpen(open);

  const selectedOrders = useMemo(
    () => exportableOrders.filter((o) => selected.has(o.id)),
    [exportableOrders, selected]
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
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(exportableOrders.map((o) => o.id)));
  }

  function getCharge(order: Order): number | null {
    return calculateShippingCharge(
      order.weightGrams,
      order.paymentMethod,
      order.shippingMode,
      shippingConfig
    );
  }

  const totalShipping = selectedOrders.reduce(
    (sum, o) => sum + (getCharge(o) ?? 0),
    0
  );
  const totalOrderValue = selectedOrders.reduce(
    (sum, o) => sum + o.orderTotal,
    0
  );

  async function handleDownload() {
    setDownloading(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Shipping Invoice");

      // Header style
      const headerFill = {
        type: "pattern" as const,
        pattern: "solid" as const,
        fgColor: { argb: "FF1E293B" },
      };
      const headerFont = { bold: true, color: { argb: "FFF1F5F9" }, size: 11 };
      const borderStyle = {
        top: { style: "thin" as const, color: { argb: "FF334155" } },
        bottom: { style: "thin" as const, color: { argb: "FF334155" } },
        left: { style: "thin" as const, color: { argb: "FF334155" } },
        right: { style: "thin" as const, color: { argb: "FF334155" } },
      };

      // Columns
      sheet.columns = [
        { header: "Order #", key: "orderNumber", width: 14 },
        { header: "Customer", key: "customer", width: 22 },
        { header: "Tracking #", key: "tracking", width: 18 },
        { header: "Payment", key: "payment", width: 10 },
        { header: "Mode", key: "mode", width: 8 },
        { header: "Weight (g)", key: "weight", width: 12 },
        { header: "Order Total (₹)", key: "orderTotal", width: 16 },
        { header: "Shipping (₹)", key: "shipping", width: 14 },
      ];

      // Style header row
      const headerRow = sheet.getRow(1);
      headerRow.eachCell((cell) => {
        cell.fill = headerFill;
        cell.font = headerFont;
        cell.border = borderStyle;
        cell.alignment = { vertical: "middle" };
      });
      headerRow.height = 24;

      // Data rows
      for (const order of selectedOrders) {
        const charge = getCharge(order);
        const row = sheet.addRow({
          orderNumber: order.orderNumber,
          customer: order.customerName,
          tracking: order.trackingNumber,
          payment: order.paymentMethod,
          mode: order.shippingMode,
          weight: order.weightGrams,
          orderTotal: order.orderTotal,
          shipping: charge ?? 0,
        });
        row.eachCell((cell) => {
          cell.border = borderStyle;
          cell.font = { size: 10 };
        });
      }

      // Summary row
      const summaryRow = sheet.addRow({
        orderNumber: "",
        customer: "",
        tracking: "",
        payment: "",
        mode: "",
        weight: "",
        orderTotal: totalOrderValue,
        shipping: totalShipping,
      });
      summaryRow.getCell("payment").value = "TOTAL";
      summaryRow.getCell("payment").font = { bold: true, size: 11 };
      summaryRow.getCell("orderTotal").font = { bold: true, size: 11 };
      summaryRow.getCell("shipping").font = { bold: true, size: 11, color: { argb: "FF10B981" } };
      summaryRow.eachCell((cell) => {
        cell.border = borderStyle;
      });

      // Generate and download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().split("T")[0];
      a.href = url;
      a.download = `shipping-invoice-${date}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-hidden flex flex-col bg-zinc-950 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <DialogTitle className="text-zinc-100 text-base font-semibold">
            Export Shipping Invoice
          </DialogTitle>
        </DialogHeader>

        {exportableOrders.length === 0 ? (
          <p className="text-zinc-500 text-sm py-4">
            No orders with weight and shipping mode set. Enter weight for orders first.
          </p>
        ) : (
          <>
            <div className="overflow-auto max-h-[45vh] rounded-lg border border-zinc-800 bg-zinc-900/50">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-zinc-900 border-b border-zinc-800">
                    <th className="w-10 px-3 py-2.5 text-left">
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
                    <th className="px-3 py-2.5 text-left text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                      Order
                    </th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                      Pay
                    </th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                      Mode
                    </th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                      Weight
                    </th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                      Shipping
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {exportableOrders.map((order) => {
                    const isSelected = selected.has(order.id);
                    const charge = getCharge(order);
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
                        <td className="px-3 py-2">
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
                        <td className="px-3 py-2 font-mono text-[12px] text-zinc-200 font-medium">
                          {order.orderNumber}
                        </td>
                        <td className="px-3 py-2 text-[12px] text-zinc-400 max-w-[140px] truncate">
                          {order.customerName}
                        </td>
                        <td className="px-3 py-2 text-[12px] text-zinc-400">
                          {order.paymentMethod}
                        </td>
                        <td className="px-3 py-2 text-[12px] text-zinc-400">
                          {order.shippingMode}
                        </td>
                        <td className="px-3 py-2 text-[12px] text-zinc-300 text-right">
                          {order.weightGrams}g
                        </td>
                        <td className="px-3 py-2 text-[12px] text-zinc-300 text-right">
                          ₹{order.orderTotal}
                        </td>
                        <td className="px-3 py-2 text-[12px] text-emerald-400 font-medium text-right">
                          {charge !== null ? `₹${charge}` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Summary */}
            <div className="flex items-center justify-between bg-zinc-900 rounded-lg px-4 py-2.5 border border-zinc-800">
              <span className="text-xs text-zinc-500">
                {selected.size} of {exportableOrders.length} orders
              </span>
              <div className="flex items-center gap-4 text-xs">
                <span className="text-zinc-400">
                  Order Value: <span className="text-zinc-200 font-medium">₹{totalOrderValue}</span>
                </span>
                <span className="text-zinc-400">
                  Shipping: <span className="text-emerald-400 font-medium">₹{totalShipping}</span>
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Button
                size="sm"
                onClick={handleDownload}
                disabled={noneSelected || downloading}
                className="px-5 bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20 shadow-lg"
              >
                {downloading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    Download Excel
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
