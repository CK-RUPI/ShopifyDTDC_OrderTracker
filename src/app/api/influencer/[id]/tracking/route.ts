import { NextRequest, NextResponse } from "next/server";
import { data } from "@/lib/data";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { trackingNumber } = await request.json();

    if (typeof trackingNumber !== "string") {
      return NextResponse.json(
        { success: false, error: "Tracking number must be a string" },
        { status: 400 }
      );
    }

    await data.updateInfluencerTrackingNumber(id, trackingNumber);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update influencer tracking number error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
