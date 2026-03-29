import { NextResponse } from "next/server";
import { data } from "@/lib/data";
import { trackShipment } from "@/lib/dtdc";

export async function POST() {
  try {
    const activeShipments = await data.getActiveInfluencerShipments();

    if (activeShipments.length === 0) {
      return NextResponse.json({
        success: true,
        refreshed: 0,
        message: "No active influencer shipments to refresh",
      });
    }

    let refreshed = 0;
    let errors = 0;
    const results: Array<{ trackingNumber: string; status: string; error?: string }> = [];

    for (const shipment of activeShipments) {
      if (!shipment.trackingNumber) continue;

      const result = await trackShipment(shipment.trackingNumber);

      if (result.success) {
        await data.updateInfluencerTracking(shipment.trackingNumber, {
          deliveryStatus: result.deliveryStatus,
          originCity: result.originCity,
          destinationCity: result.destinationCity,
          expectedDeliveryDate: result.expectedDeliveryDate,
          deliveredDate: result.deliveredDate,
          receiverName: result.receiverName,
          lastUpdated: new Date().toISOString().split("T")[0],
          trackingTimeline: result.timeline,
        });
        refreshed++;
        results.push({
          trackingNumber: shipment.trackingNumber,
          status: result.deliveryStatus,
        });
      } else {
        errors++;
        results.push({
          trackingNumber: shipment.trackingNumber,
          status: "Error",
          error: result.error,
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return NextResponse.json({
      success: true,
      refreshed,
      errors,
      total: activeShipments.length,
      results,
    });
  } catch (error) {
    console.error("Influencer tracking refresh error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
