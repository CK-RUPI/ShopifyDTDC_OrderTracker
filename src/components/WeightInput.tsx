"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Loader2, Weight } from "lucide-react";

interface WeightInputProps {
  orderId: string;
  initialWeight: number;
  shippingCharge: number | null;
  onWeightSaved: (orderId: string, weight: number) => void;
}

export function WeightInput({
  orderId,
  initialWeight,
  shippingCharge,
  onWeightSaved,
}: WeightInputProps) {
  const [value, setValue] = useState(initialWeight > 0 ? String(initialWeight) : "");
  const [saving, setSaving] = useState(false);

  async function save() {
    const weight = parseInt(value, 10);
    if (isNaN(weight) || weight < 0) return;
    if (weight === initialWeight) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/weight`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weightGrams: weight }),
      });
      if (res.ok) {
        onWeightSaved(orderId, weight);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <Weight className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
        <Input
          type="number"
          min={0}
          placeholder="Weight"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => e.key === "Enter" && save()}
          className="w-[110px] h-8 pl-7 pr-7 text-xs bg-zinc-900 border-zinc-700/50 text-zinc-200 placeholder:text-zinc-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          disabled={saving}
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500 font-medium">
          g
        </span>
        {saving && (
          <Loader2 className="absolute right-6 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin text-zinc-400" />
        )}
      </div>
      {shippingCharge !== null && (
        <span className="text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-1.5 py-0.5 whitespace-nowrap">
          ₹{shippingCharge}
        </span>
      )}
    </div>
  );
}
