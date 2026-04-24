import { NextResponse } from "next/server";
import { getShopifyProductImage } from "@/lib/shopify";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const productIds: unknown = body?.productIds;
    if (!Array.isArray(productIds)) {
      return NextResponse.json(
        { error: "productIds must be an array" },
        { status: 400 }
      );
    }

    const ids = productIds.filter(
      (id): id is string => typeof id === "string" && id.length > 0
    );

    const images = await Promise.all(
      ids.map(async (productId) => ({
        productId,
        imageUrl: await getShopifyProductImage(productId),
      }))
    );

    return NextResponse.json({ images });
  } catch (err) {
    console.error("Failed to fetch abandoned-checkout item images:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
