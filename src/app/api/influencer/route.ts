import { NextRequest, NextResponse } from "next/server";
import { data } from "@/lib/data";

export async function GET() {
  try {
    const shipments = await data.getInfluencerShipments();
    return NextResponse.json({ success: true, shipments });
  } catch (error) {
    console.error("Get influencer shipments error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { trackingNumber, label, phoneNumber, instagramHandle, isJaipurInfluencer } = body;

    if (!isJaipurInfluencer && !trackingNumber) {
      return NextResponse.json(
        { success: false, error: "Tracking number is required" },
        { status: 400 }
      );
    }

    if (!phoneNumber) {
      return NextResponse.json(
        { success: false, error: "Phone number is required" },
        { status: 400 }
      );
    }

    const shipment = await data.createInfluencerShipment({
      label: label || "Untitled",
      trackingNumber: trackingNumber || "",
      phoneNumber,
      instagramHandle,
      isJaipurInfluencer,
    });

    return NextResponse.json({ success: true, shipment });
  } catch (error) {
    console.error("Create influencer shipment error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
