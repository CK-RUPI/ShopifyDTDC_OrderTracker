import { NextRequest, NextResponse } from "next/server";
import { data } from "@/lib/data";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { codCollectionStatus } = body;

    if (codCollectionStatus !== "Pending" && codCollectionStatus !== "Collected") {
      return NextResponse.json(
        { success: false, error: "Invalid COD collection status" },
        { status: 400 }
      );
    }

    await data.updateCodStatus(id, codCollectionStatus);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update COD status error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
