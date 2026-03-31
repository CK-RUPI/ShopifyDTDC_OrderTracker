import { ShippingRateTable, ShippingRateSlab } from "./data/types";

const STORAGE_KEY = "shippingRateConfig";

export const DEFAULT_RATE_CONFIG: ShippingRateTable = {
  codAir: [
    { minGrams: 0, maxGrams: 500, rate: 70 },
    { minGrams: 500, maxGrams: 1000, rate: 100 },
    { minGrams: 1000, maxGrams: 2000, rate: 150 },
    { minGrams: 2000, maxGrams: Infinity, rate: 200 },
  ],
  codRoad: [
    { minGrams: 0, maxGrams: 500, rate: 50 },
    { minGrams: 500, maxGrams: 1000, rate: 80 },
    { minGrams: 1000, maxGrams: 2000, rate: 120 },
    { minGrams: 2000, maxGrams: Infinity, rate: 160 },
  ],
  prepaidAir: [
    { minGrams: 0, maxGrams: 500, rate: 60 },
    { minGrams: 500, maxGrams: 1000, rate: 90 },
    { minGrams: 1000, maxGrams: 2000, rate: 130 },
    { minGrams: 2000, maxGrams: Infinity, rate: 180 },
  ],
  prepaidRoad: [
    { minGrams: 0, maxGrams: 500, rate: 40 },
    { minGrams: 500, maxGrams: 1000, rate: 65 },
    { minGrams: 1000, maxGrams: 2000, rate: 100 },
    { minGrams: 2000, maxGrams: Infinity, rate: 140 },
  ],
};

function reviveInfinity(slabs: ShippingRateSlab[]): ShippingRateSlab[] {
  return slabs.map((s) => ({
    ...s,
    maxGrams: s.maxGrams === null || s.maxGrams === 999999 ? Infinity : s.maxGrams,
  }));
}

export function getShippingConfig(): ShippingRateTable {
  if (typeof window === "undefined") return DEFAULT_RATE_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_RATE_CONFIG;
    const parsed = JSON.parse(raw) as ShippingRateTable;
    return {
      codAir: reviveInfinity(parsed.codAir),
      codRoad: reviveInfinity(parsed.codRoad),
      prepaidAir: reviveInfinity(parsed.prepaidAir),
      prepaidRoad: reviveInfinity(parsed.prepaidRoad),
    };
  } catch {
    return DEFAULT_RATE_CONFIG;
  }
}

export function saveShippingConfig(config: ShippingRateTable): void {
  // JSON.stringify cannot handle Infinity, so replace with 999999
  const serializable = {
    codAir: config.codAir.map((s) => ({ ...s, maxGrams: s.maxGrams === Infinity ? 999999 : s.maxGrams })),
    codRoad: config.codRoad.map((s) => ({ ...s, maxGrams: s.maxGrams === Infinity ? 999999 : s.maxGrams })),
    prepaidAir: config.prepaidAir.map((s) => ({ ...s, maxGrams: s.maxGrams === Infinity ? 999999 : s.maxGrams })),
    prepaidRoad: config.prepaidRoad.map((s) => ({ ...s, maxGrams: s.maxGrams === Infinity ? 999999 : s.maxGrams })),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
}

export function calculateShippingCharge(
  weightGrams: number,
  paymentMethod: "COD" | "Prepaid",
  shippingMode: "Air" | "Road" | "",
  config: ShippingRateTable
): number | null {
  if (weightGrams <= 0 || !shippingMode) return null;

  const key =
    paymentMethod === "COD"
      ? shippingMode === "Air"
        ? "codAir"
        : "codRoad"
      : shippingMode === "Air"
        ? "prepaidAir"
        : "prepaidRoad";

  const slabs = config[key];
  const slab = slabs.find(
    (s) => weightGrams >= s.minGrams && weightGrams < s.maxGrams
  );

  return slab ? slab.rate : null;
}
