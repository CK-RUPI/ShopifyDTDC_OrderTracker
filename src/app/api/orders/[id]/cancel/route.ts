import { NextRequest, NextResponse } from "next/server";
import { data } from "@/lib/data";
import { cancelShopifyOrder } from "@/lib/shopify";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const reason = typeof body.reason === "string"
      ? body.reason.trim().slice(0, 500)
      : "No reason provided";

    const order = await data.getOrderById(id);
    if (!order) {
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 }
      );
    }

    if (order.deliveryStatus !== "Unfulfilled") {
      return NextResponse.json(
        { success: false, error: "Only unfulfilled orders can be cancelled" },
        { status: 400 }
      );
    }

    if (!order.shopifyOrderId) {
      return NextResponse.json(
        { success: false, error: "Order has no Shopify Order ID" },
        { status: 400 }
      );
    }

    // Cancel on Shopify
    try {
      await cancelShopifyOrder(order.shopifyOrderId, reason);
    } catch (shopifyError) {
      const msg = shopifyError instanceof Error ? shopifyError.message : "Unknown error";
      // 404 = order already cancelled or doesn't exist on Shopify — proceed to update Notion
      if (msg.includes("(404)")) {
        console.warn("Shopify order not found (may already be cancelled), proceeding with Notion update");
      } else {
        console.error("Shopify cancellation failed:", shopifyError);
        return NextResponse.json(
          { success: false, error: `Shopify cancellation failed: ${msg}` },
          { status: 502 }
        );
      }
    }

    // Update Notion
    try {
      await data.cancelOrder(id, reason);
    } catch (notionErr) {
      console.error("Shopify cancelled but Notion update failed:", notionErr);
      return NextResponse.json({
        success: true,
        warning: "Cancelled on Shopify but Notion update failed. Trigger a sync to reconcile.",
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Cancel order error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
