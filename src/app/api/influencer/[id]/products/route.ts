import { NextRequest, NextResponse } from "next/server";
import {
  getInfluencerShipmentById,
  updateInfluencerProducts,
} from "@/lib/data/notion";
import { Product } from "@/lib/data/types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const shipment = await getInfluencerShipmentById(id);
    if (!shipment) {
      return NextResponse.json(
        { success: false, error: "Shipment not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      products: shipment.products || [],
    });
  } catch (err) {
    console.error("Get products error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { products } = (await request.json()) as { products: Product[] };

    if (!Array.isArray(products)) {
      return NextResponse.json(
        { success: false, error: "Products must be an array" },
        { status: 400 }
      );
    }

    if (products.length > 20) {
      return NextResponse.json(
        { success: false, error: "Maximum 20 products per shipment" },
        { status: 400 }
      );
    }

    for (const p of products) {
      if (!p.id || !p.name || !p.productUrl) {
        return NextResponse.json(
          {
            success: false,
            error: "Each product must have id, name, and productUrl",
          },
          { status: 400 }
        );
      }
    }

    await updateInfluencerProducts(id, products);

    return NextResponse.json({ success: true, products });
  } catch (err) {
    console.error("Update products error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to update products" },
      { status: 500 }
    );
  }
}
