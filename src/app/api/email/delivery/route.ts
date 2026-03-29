import { NextRequest, NextResponse } from "next/server";
import { data } from "@/lib/data";
import { sendDeliveryEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "Order ID is required" },
        { status: 400 }
      );
    }

    const order = await data.getOrderById(orderId);
    if (!order) {
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 }
      );
    }

    if (order.deliveryStatus !== "Delivered") {
      return NextResponse.json(
        { success: false, error: "Order has not been delivered yet" },
        { status: 400 }
      );
    }

    if (order.deliveryEmailSent) {
      return NextResponse.json(
        { success: false, error: "Delivery email already sent" },
        { status: 400 }
      );
    }

    if (!order.customerEmail) {
      return NextResponse.json(
        { success: false, error: "No customer email address" },
        { status: 400 }
      );
    }

    await sendDeliveryEmail(order);
    await data.markEmailSent(orderId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Send delivery email error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
