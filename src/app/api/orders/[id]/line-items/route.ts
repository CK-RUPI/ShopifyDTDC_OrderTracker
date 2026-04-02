import { NextRequest, NextResponse } from "next/server";
import { data } from "@/lib/data";
import { getOrderLineItems } from "@/lib/shopify";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const order = await data.getOrderById(id);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (!order.shopifyOrderId) {
      return NextResponse.json({ error: "No Shopify order ID" }, { status: 400 });
    }

    const lineItems = await getOrderLineItems(order.shopifyOrderId);
    return NextResponse.json({ lineItems });
  } catch (err) {
    console.error("Failed to fetch line items:", err);
    return NextResponse.json(
      { error: "Failed to fetch line items" },
      { status: 500 }
    );
  }
}
