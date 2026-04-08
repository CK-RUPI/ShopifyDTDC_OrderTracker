import { NextRequest, NextResponse } from "next/server";
import { data } from "@/lib/data";

const NOTION_ID_REGEX = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

export async function POST(
  request: NextRequest,
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
    const body = await request.json();
    const { isCod } = body;

    await data.markWhatsAppSent(id, !!isCod);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Mark WhatsApp sent error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
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
    const body = await request.json();
    const { status } = body;

    if (status !== "Confirmed on Call" && status !== "Confirmed on WhatsApp" && status !== "Declined" && status !== "No Reply") {
      return NextResponse.json(
        { success: false, error: "Invalid COD confirmation status" },
        { status: 400 }
      );
    }

    await data.updateCodConfirmation(id, status);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update COD confirmation error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function PUT(
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
    await data.recordWhatsAppFollowUp(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Record WhatsApp follow-up error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
