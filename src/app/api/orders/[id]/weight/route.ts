import { NextRequest, NextResponse } from "next/server";
import { data } from "@/lib/data";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { weightGrams } = body;

    if (typeof weightGrams !== "number" || weightGrams < 0) {
      return NextResponse.json(
        { success: false, error: "Invalid weight" },
        { status: 400 }
      );
    }

    await data.updateOrderWeight(id, weightGrams);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update weight error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
