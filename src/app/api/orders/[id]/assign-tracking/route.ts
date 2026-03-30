import { NextRequest, NextResponse } from "next/server";
import { data } from "@/lib/data";
import { createShopifyFulfillment } from "@/lib/shopify";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { trackingNumber, courierPartner = "DTDC" } = body;

    if (!trackingNumber?.trim()) {
      return NextResponse.json(
        { success: false, error: "Tracking number is required" },
        { status: 400 }
      );
    }

    const order = await data.getOrderById(id);
    if (!order) {
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 }
      );
    }

    if (order.deliveryStatus !== "Unfulfilled") {
      return NextResponse.json(
        { success: false, error: "Order is not in Unfulfilled status" },
        { status: 400 }
      );
    }

    // Create fulfillment in Shopify
    try {
      await createShopifyFulfillment(
        order.shopifyOrderId,
        trackingNumber.trim(),
        courierPartner
      );
    } catch (shopifyError) {
      console.error("Shopify fulfillment creation failed:", shopifyError);
      return NextResponse.json(
        {
          success: false,
          error: `Shopify fulfillment failed: ${shopifyError instanceof Error ? shopifyError.message : "Unknown error"}`,
        },
        { status: 502 }
      );
    }

    // Update Notion with tracking info
    await data.assignTracking(id, trackingNumber.trim(), courierPartner);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Assign tracking error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
