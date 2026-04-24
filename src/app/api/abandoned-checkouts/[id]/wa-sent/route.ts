import { NextResponse } from "next/server";
import { upsertAbandonedCheckoutWaSent } from "@/lib/data/notion";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { customerName, customerPhone, totalPrice, checkoutUrl } = body;
    await upsertAbandonedCheckoutWaSent(
      id,
      customerName || "",
      customerPhone || "",
      totalPrice || "",
      checkoutUrl || ""
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to mark abandoned checkout WA sent:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
