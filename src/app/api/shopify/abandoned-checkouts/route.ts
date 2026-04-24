import { NextResponse } from "next/server";
import { getAbandonedCheckouts } from "@/lib/shopify";
import { getAbandonedCheckoutWaSentIds } from "@/lib/data/notion";

export async function GET() {
  try {
    const [checkouts, waSentIds] = await Promise.all([
      getAbandonedCheckouts(),
      getAbandonedCheckoutWaSentIds(),
    ]);

    const merged = checkouts.map((c) => ({
      ...c,
      waMessageSent: waSentIds.has(c.id),
    }));

    return NextResponse.json({ checkouts: merged });
  } catch (err) {
    console.error("Failed to fetch abandoned checkouts:", err);
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
