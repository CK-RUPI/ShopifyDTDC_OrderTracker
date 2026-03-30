import { NextRequest, NextResponse } from "next/server";
import { data } from "@/lib/data";
import { buildDeliveryEmailHtml, buildReviewEmailHtml } from "@/lib/email";
import { EmailType } from "@/lib/data/types";

export async function GET(request: NextRequest) {
  const orderId = request.nextUrl.searchParams.get("orderId");
  const type = (request.nextUrl.searchParams.get("type") || "delivery_confirmation") as EmailType;

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

  const html = type === "review_request"
    ? buildReviewEmailHtml(order)
    : buildDeliveryEmailHtml(order);

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
