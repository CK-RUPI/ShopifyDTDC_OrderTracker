import { NextRequest, NextResponse } from "next/server";
import { data } from "@/lib/data";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { rtoTrackingNumber } = body;

    if (typeof rtoTrackingNumber !== "string") {
      return NextResponse.json(
        { success: false, error: "RTO tracking number is required" },
        { status: 400 }
      );
    }

    await data.updateRtoTracking(id, rtoTrackingNumber);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update RTO tracking error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
