import { NextRequest, NextResponse } from "next/server";
import { data } from "@/lib/data";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { shippingMode } = body;

    if (shippingMode !== "Air" && shippingMode !== "Road") {
      return NextResponse.json(
        { success: false, error: "Invalid shipping mode" },
        { status: 400 }
      );
    }

    await data.updateShippingMode(id, shippingMode);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update shipping mode error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
