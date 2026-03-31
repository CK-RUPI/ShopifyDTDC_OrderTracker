import { NextRequest, NextResponse } from "next/server";
import { data } from "@/lib/data";
import { sendReviewEmail } from "@/lib/email";

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

function isEligibleForReview(order: {
  deliveryStatus: string;
  reviewEmailSent: boolean;
  customerEmail: string;
  deliveredTimestamp: string;
}): boolean {
  if (order.deliveryStatus !== "Delivered") return false;
  if (order.reviewEmailSent) return false;
  if (!order.customerEmail) return false;
  if (!order.deliveredTimestamp) return false;
  const deliveredAt = new Date(order.deliveredTimestamp).getTime();
  if (isNaN(deliveredAt)) return false;
  return Date.now() - deliveredAt >= THREE_DAYS_MS;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Bulk mode: send to all eligible orders
    if (body.bulk) {
      const orders = await data.getOrders();
      const eligible = orders.filter(isEligibleForReview);

      let sent = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const order of eligible) {
        try {
          await sendReviewEmail(order);
          await data.markReviewEmailSent(order.id);
          sent++;
          // 1s delay between sends to avoid SMTP rate limits
          if (sent < eligible.length) {
            await new Promise((r) => setTimeout(r, 1000));
          }
        } catch (err) {
          failed++;
          errors.push(
            `${order.orderNumber}: ${err instanceof Error ? err.message : "Unknown error"}`
          );
        }
      }

      return NextResponse.json({
        success: true,
        sent,
        failed,
        total: eligible.length,
        errors: errors.length > 0 ? errors : undefined,
      });
    }

    // Single order mode
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

    if (order.reviewEmailSent) {
      return NextResponse.json(
        { success: false, error: "Review email already sent" },
        { status: 400 }
      );
    }

    if (!order.customerEmail) {
      return NextResponse.json(
        { success: false, error: "No customer email address" },
        { status: 400 }
      );
    }

    if (!order.deliveredTimestamp) {
      return NextResponse.json(
        { success: false, error: "No delivery timestamp recorded" },
        { status: 400 }
      );
    }

    const deliveredAt = new Date(order.deliveredTimestamp).getTime();
    if (Date.now() - deliveredAt < THREE_DAYS_MS) {
      const daysLeft = Math.ceil(
        (THREE_DAYS_MS - (Date.now() - deliveredAt)) / (24 * 60 * 60 * 1000)
      );
      return NextResponse.json(
        {
          success: false,
          error: `Order delivered less than 3 days ago (${daysLeft} day${daysLeft === 1 ? "" : "s"} remaining)`,
        },
        { status: 400 }
      );
    }

    await sendReviewEmail(order);
    await data.markReviewEmailSent(orderId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Send review email error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
