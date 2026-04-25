import { NextRequest, NextResponse } from "next/server";
import { data } from "@/lib/data";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { shippingChargePaid } = body;

    if (typeof shippingChargePaid !== "boolean") {
      return NextResponse.json(
        { success: false, error: "shippingChargePaid must be boolean" },
        { status: 400 }
      );
    }

    await data.updateShippingChargePaid(id, shippingChargePaid);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update shipping-paid error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
