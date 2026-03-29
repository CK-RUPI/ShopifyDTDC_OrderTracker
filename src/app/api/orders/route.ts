import { NextRequest, NextResponse } from "next/server";
import { data, DeliveryStatus } from "@/lib/data";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status") as DeliveryStatus | null;
    const search = searchParams.get("search") || undefined;
    const hideDelivered = searchParams.get("hideDelivered") === "true";

    const orders = await data.getOrders({
      status: status || undefined,
      search,
      hideDelivered,
    });

    return NextResponse.json({ success: true, orders });
  } catch (error) {
    console.error("Get orders error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
