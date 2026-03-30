"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, RotateCcw, Save } from "lucide-react";
import type { ShippingRateSlab, ShippingRateTable } from "@/lib/data/types";
import {
  getShippingConfig,
  saveShippingConfig,
  DEFAULT_RATE_CONFIG,
} from "@/lib/shipping";

const TABS = [
  { key: "codAir" as const, label: "COD + Air" },
  { key: "codRoad" as const, label: "COD + Road" },
  { key: "prepaidAir" as const, label: "Prepaid + Air" },
  { key: "prepaidRoad" as const, label: "Prepaid + Road" },
];

interface ShippingRatesPanelProps {
  visible: boolean;
  onConfigSaved: () => void;
}

export function ShippingRatesPanel({
  visible,
  onConfigSaved,
}: ShippingRatesPanelProps) {
  const [config, setConfig] = useState<ShippingRateTable>(DEFAULT_RATE_CONFIG);
  const [activeTab, setActiveTab] = useState<keyof ShippingRateTable>("codAir");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (visible) {
      setConfig(getShippingConfig());
      setSaved(false);
    }
  }, [visible]);

  function updateSlab(
    tabKey: keyof ShippingRateTable,
    index: number,
    field: keyof ShippingRateSlab,
    value: string
  ) {
    setConfig((prev) => {
      const slabs = [...prev[tabKey]];
      const num = value === "" ? 0 : parseFloat(value);
      slabs[index] = {
        ...slabs[index],
        [field]: field === "maxGrams" && value === "" ? Infinity : num,
      };
      return { ...prev, [tabKey]: slabs };
    });
  }

  function addSlab(tabKey: keyof ShippingRateTable) {
    setConfig((prev) => {
      const slabs = [...prev[tabKey]];
      const lastMax = slabs.length > 0 ? slabs[slabs.length - 1].maxGrams : 0;
      const newMin = lastMax === Infinity ? (slabs[slabs.length - 1]?.minGrams ?? 0) + 1000 : lastMax;
      slabs.push({ minGrams: newMin, maxGrams: Infinity, rate: 0 });
      return { ...prev, [tabKey]: slabs };
    });
  }

  function removeSlab(tabKey: keyof ShippingRateTable, index: number) {
    setConfig((prev) => {
      const slabs = prev[tabKey].filter((_, i) => i !== index);
      return { ...prev, [tabKey]: slabs };
    });
  }

  function handleSave() {
    saveShippingConfig(config);
    setSaved(true);
    onConfigSaved();
    setTimeout(() => setSaved(false), 2000);
  }

  function handleReset() {
    setConfig(DEFAULT_RATE_CONFIG);
  }

  const slabs = config[activeTab];

  return (
    <div className="space-y-3">
      {/* Rate type tabs */}
      <div className="flex gap-1 bg-zinc-800/60 rounded-lg p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 text-[11px] font-medium px-2 py-1.5 rounded-md transition-all ${
              activeTab === tab.key
                ? "bg-zinc-700 text-zinc-100 shadow-sm"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Slab table */}
      <div className="overflow-auto max-h-[35vh] rounded-lg border border-zinc-800 bg-zinc-900/50">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-zinc-900 border-b border-zinc-800">
              <th className="px-3 py-2 text-left text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                Min (g)
              </th>
              <th className="px-3 py-2 text-left text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                Max (g)
              </th>
              <th className="px-3 py-2 text-left text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                Rate (₹)
              </th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {slabs.map((slab, i) => (
              <tr key={i} className="border-b border-zinc-800/60 last:border-b-0">
                <td className="px-3 py-1.5">
                  <Input
                    type="number"
                    min={0}
                    value={slab.minGrams}
                    onChange={(e) => updateSlab(activeTab, i, "minGrams", e.target.value)}
                    className="h-7 text-xs bg-zinc-800 border-zinc-700/50 text-zinc-200 w-24 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </td>
                <td className="px-3 py-1.5">
                  <Input
                    type="number"
                    min={0}
                    value={slab.maxGrams === Infinity ? "" : slab.maxGrams}
                    placeholder="∞"
                    onChange={(e) => updateSlab(activeTab, i, "maxGrams", e.target.value)}
                    className="h-7 text-xs bg-zinc-800 border-zinc-700/50 text-zinc-200 w-24 placeholder:text-zinc-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </td>
                <td className="px-3 py-1.5">
                  <Input
                    type="number"
                    min={0}
                    value={slab.rate}
                    onChange={(e) => updateSlab(activeTab, i, "rate", e.target.value)}
                    className="h-7 text-xs bg-zinc-800 border-zinc-700/50 text-emerald-400 w-24 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </td>
                <td className="px-1 py-1.5">
                  <button
                    onClick={() => removeSlab(activeTab, i)}
                    className="p-1 rounded text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {slabs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-zinc-600 text-xs">
                  No slabs configured. Add one below.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={() => addSlab(activeTab)}
        className="w-full border-zinc-800 border-dashed text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 bg-transparent"
      >
        <Plus className="h-3.5 w-3.5 mr-1.5" />
        Add Slab
      </Button>

      {/* Actions */}
      <div className="flex items-center justify-between pt-1">
        <Button
          variant="outline"
          size="sm"
          onClick={handleReset}
          className="border-zinc-700/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 bg-transparent"
        >
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          Reset Defaults
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          className={`px-5 transition-all duration-200 ${
            saved
              ? "bg-emerald-600 hover:bg-emerald-500 text-white"
              : "bg-blue-600 hover:bg-blue-500 text-white"
          }`}
        >
          {saved ? (
            <>
              <Save className="h-3.5 w-3.5 mr-1.5" />
              Saved!
            </>
          ) : (
            <>
              <Save className="h-3.5 w-3.5 mr-1.5" />
              Save Rates
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
