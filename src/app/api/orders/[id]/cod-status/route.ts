import { NextRequest, NextResponse } from "next/server";
import { data } from "@/lib/data";
import { markShopifyOrderPaid } from "@/lib/shopify";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { codCollectionStatus } = body;

    if (codCollectionStatus !== "Pending" && codCollectionStatus !== "Collected") {
      return NextResponse.json(
        { success: false, error: "Invalid COD collection status" },
        { status: 400 }
      );
    }

    await data.updateCodStatus(id, codCollectionStatus);

    let shopifyWarning: string | undefined;
    if (codCollectionStatus === "Collected") {
      const order = await data.getOrderById(id);
      if (order?.shopifyOrderId && order.paymentMethod === "COD") {
        try {
          await markShopifyOrderPaid(order.shopifyOrderId);
        } catch (shopifyErr) {
          shopifyWarning =
            shopifyErr instanceof Error ? shopifyErr.message : "Shopify mark-paid failed";
          console.error(
            `Shopify mark-paid failed for order ${order.orderNumber}: ${shopifyWarning}`
          );
        }
      }
    }

    return NextResponse.json({ success: true, shopifyWarning });
  } catch (error) {
    console.error("Update COD status error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
