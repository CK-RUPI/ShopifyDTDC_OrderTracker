import { NextResponse } from "next/server";
import { data } from "@/lib/data";
import {
  getFulfilledOrders,
  getUnfulfilledOrders,
  formatShippingAddress,
} from "@/lib/shopify";

export async function POST() {
  try {
    const shopifyOrders = await getFulfilledOrders();
    let synced = 0;
    let skipped = 0;

    for (const order of shopifyOrders) {
      // Get tracking number from fulfillments
      const trackingNumber =
        order.fulfillments?.[0]?.tracking_number ||
        order.fulfillments?.[0]?.tracking_numbers?.[0] ||
        "";

      if (!trackingNumber) {
        skipped++;
        continue;
      }

      const customerName = order.customer
        ? `${order.customer.first_name || ""} ${order.customer.last_name || ""}`.trim()
        : "Unknown";

      // Determine COD vs Prepaid from financial status and payment gateways
      const gateways = (order.payment_gateway_names || []).map((g) =>
        g.toLowerCase()
      );
      const isCOD =
        order.financial_status === "pending" ||
        gateways.some(
          (g) =>
            g.includes("cash on delivery") ||
            g.includes("cod") ||
            g.includes("payment pending")
        );
      const paymentMethod = isCOD ? "COD" : "Prepaid";

      await data.upsertOrder({
        shopifyOrderId: order.id.toString(),
        orderNumber: order.name,
        customerName,
        customerEmail: order.email || order.customer?.email || "",
        customerPhone: order.shipping_address?.phone || "",
        shippingAddress: formatShippingAddress(order.shipping_address),
        trackingNumber,
        courierPartner:
          order.fulfillments?.[0]?.tracking_company || "DTDC",
        paymentMethod,
        orderTotal: parseFloat(order.total_price || "0"),
        codCollectionStatus: isCOD ? "Pending" : "",
        orderDate: order.created_at.split("T")[0],
        fulfilledDate: order.fulfillments?.[0]?.created_at?.split("T")[0] || "",
        deliveryStatus: "Booked",
        originCity: "",
        destinationCity: order.shipping_address?.city || "",
        expectedDeliveryDate: "",
        deliveredDate: "",
        deliveredTimestamp: "",
        receiverName: "",
        lastUpdated: new Date().toISOString().split("T")[0],
        trackingTimeline: [],
        rtoTrackingNumber: "",
        deliveryEmailSent: false,
        reviewEmailSent: false,
        shippingMode: isCOD ? "Road" : "Air",
      });
      synced++;
    }

    // Phase 2: Sync unfulfilled orders
    const unfulfilledOrders = await getUnfulfilledOrders();
    let unfulfilled = 0;

    for (const order of unfulfilledOrders) {
      const customerName = order.customer
        ? `${order.customer.first_name || ""} ${order.customer.last_name || ""}`.trim()
        : "Unknown";

      const gateways = (order.payment_gateway_names || []).map((g) =>
        g.toLowerCase()
      );
      const isCOD =
        order.financial_status === "pending" ||
        gateways.some(
          (g) =>
            g.includes("cash on delivery") ||
            g.includes("cod") ||
            g.includes("payment pending")
        );
      const paymentMethod = isCOD ? "COD" : "Prepaid";

      await data.upsertOrder({
        shopifyOrderId: order.id.toString(),
        orderNumber: order.name,
        customerName,
        customerEmail: order.email || order.customer?.email || "",
        customerPhone: order.shipping_address?.phone || "",
        shippingAddress: formatShippingAddress(order.shipping_address),
        trackingNumber: "",
        courierPartner: "",
        paymentMethod,
        orderTotal: parseFloat(order.total_price || "0"),
        codCollectionStatus: isCOD ? "Pending" : "",
        orderDate: order.created_at.split("T")[0],
        fulfilledDate: "",
        deliveryStatus: "Unfulfilled",
        originCity: "",
        destinationCity: order.shipping_address?.city || "",
        expectedDeliveryDate: "",
        deliveredDate: "",
        deliveredTimestamp: "",
        receiverName: "",
        lastUpdated: new Date().toISOString().split("T")[0],
        trackingTimeline: [],
        rtoTrackingNumber: "",
        deliveryEmailSent: false,
        reviewEmailSent: false,
        shippingMode: isCOD ? "Road" : "Air",
      });
      unfulfilled++;
    }

    return NextResponse.json({
      success: true,
      synced,
      skipped,
      unfulfilled,
      total: shopifyOrders.length + unfulfilledOrders.length,
    });
  } catch (error) {
    console.error("Shopify sync error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
