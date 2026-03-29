import { NextResponse } from "next/server";
import { data } from "@/lib/data";
import { trackShipment } from "@/lib/dtdc";
import { resolveStatus, validateTransition, logBlockedTransition } from "@/lib/status-machine";

export async function POST() {
  try {
    const activeOrders = await data.getActiveOrders();

    if (activeOrders.length === 0) {
      return NextResponse.json({
        success: true,
        refreshed: 0,
        message: "No active orders to refresh",
      });
    }

    let refreshed = 0;
    let errors = 0;
    let blocked = 0;
    const results: Array<{ trackingNumber: string; status: string; error?: string; blocked?: boolean; reason?: string }> = [];

    for (const order of activeOrders) {
      if (!order.trackingNumber) continue;

      const result = await trackShipment(order.trackingNumber);

      if (result.success) {
        const resolvedStatus = resolveStatus(result.deliveryStatus, order.deliveryStatus);
        const validation = validateTransition(order.deliveryStatus, resolvedStatus, false);

        if (!validation.allowed) {
          logBlockedTransition(order.trackingNumber, order.deliveryStatus, resolvedStatus, "bulk-refresh");
          blocked++;
          results.push({
            trackingNumber: order.trackingNumber,
            status: order.deliveryStatus,
            blocked: true,
            reason: validation.warning,
          });
        } else {
          // Build delivered timestamp from DTDC data
          let deliveredTimestamp = "";
          if (resolvedStatus === "Delivered" || resolvedStatus === "RTO Received") {
            const lastEvent = result.timeline[result.timeline.length - 1];
            deliveredTimestamp = lastEvent?.timestamp || result.deliveredDate || "";
          }

          try {
            await data.updateOrderTracking(order.trackingNumber, {
              deliveryStatus: resolvedStatus,
              originCity: result.originCity,
              destinationCity: result.destinationCity,
              expectedDeliveryDate: result.expectedDeliveryDate,
              deliveredDate: result.deliveredDate,
              deliveredTimestamp,
              receiverName: result.receiverName,
              lastUpdated: new Date().toISOString().split("T")[0],
              trackingTimeline: result.timeline,
            });
            refreshed++;
            results.push({
              trackingNumber: order.trackingNumber,
              status: resolvedStatus,
            });
          } catch (updateError) {
            errors++;
            results.push({
              trackingNumber: order.trackingNumber,
              status: "Error",
              error: updateError instanceof Error ? updateError.message : "Notion update failed",
            });
          }
        }
      } else {
        errors++;
        results.push({
          trackingNumber: order.trackingNumber,
          status: "Error",
          error: result.error,
        });
      }

      // Delay between orders to respect DTDC + Notion API rate limits
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return NextResponse.json({
      success: true,
      refreshed,
      errors,
      blocked,
      total: activeOrders.length,
      results,
    });
  } catch (error) {
    console.error("Tracking refresh error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
