import { NextRequest, NextResponse } from "next/server";
import { updateInfluencerStatus } from "@/lib/data/notion";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { status } = await request.json();

    if (!status) {
      return NextResponse.json(
        { success: false, error: "Status is required" },
        { status: 400 }
      );
    }

    await updateInfluencerStatus(id, status);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update influencer status error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
