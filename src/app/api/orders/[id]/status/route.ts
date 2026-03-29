import { NextRequest, NextResponse } from "next/server";
import { data } from "@/lib/data";
import { DeliveryStatus } from "@/lib/data/types";
import { validateTransition } from "@/lib/status-machine";

const VALID_STATUSES: DeliveryStatus[] = [
  "Booked",
  "Picked Up",
  "In Transit",
  "At Destination",
  "Out for Delivery",
  "Delivered",
  "Undelivered",
  "Stuck",
  "RTO",
  "RTO Confirmed",
  "RTO Received",
  "Return Initiated",
  "Return Complete",
];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { deliveryStatus } = body;

    if (!deliveryStatus || !VALID_STATUSES.includes(deliveryStatus)) {
      return NextResponse.json(
        { success: false, error: "Invalid delivery status" },
        { status: 400 }
      );
    }

    const order = await data.getOrderById(id);
    const validation = order
      ? validateTransition(order.deliveryStatus, deliveryStatus, true)
      : { allowed: true };

    await data.updateDeliveryStatus(id, deliveryStatus);
    return NextResponse.json({
      success: true,
      ...(validation.warning ? { warning: validation.warning } : {}),
    });
  } catch (error) {
    console.error("Update status error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
