import { NextRequest, NextResponse } from "next/server";
import { data } from "@/lib/data";
import { buildDeliveryEmailHtml } from "@/lib/email";

export async function GET(request: NextRequest) {
  const orderId = request.nextUrl.searchParams.get("orderId");

  if (!orderId) {
    return NextResponse.json(
      { error: "orderId query param is required" },
      { status: 400 }
    );
  }

  const order = await data.getOrderById(orderId);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const html = buildDeliveryEmailHtml(order);

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
