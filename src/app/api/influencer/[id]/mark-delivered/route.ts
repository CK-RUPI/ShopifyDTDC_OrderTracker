import { NextRequest, NextResponse } from "next/server";
import { data } from "@/lib/data";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await data.markInfluencerDelivered(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Mark delivered error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
