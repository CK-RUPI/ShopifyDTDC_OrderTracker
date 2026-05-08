import { NextRequest, NextResponse } from "next/server";
import { data } from "@/lib/data";

const NOTION_ID_REGEX = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!NOTION_ID_REGEX.test(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid order ID" },
        { status: 400 }
      );
    }

    await data.markOfdWhatsAppSent(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Mark OFD WhatsApp sent error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
