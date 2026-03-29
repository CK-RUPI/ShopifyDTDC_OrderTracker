import { NextRequest, NextResponse } from "next/server";
import { extractProductHandle, getProductFromPublicUrl } from "@/lib/shopify";

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { success: false, error: "URL is required" },
        { status: 400 }
      );
    }

    const handle = extractProductHandle(url);
    if (!handle) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid product URL. Expected format: store.com/products/product-name",
        },
        { status: 400 }
      );
    }

    const product = await getProductFromPublicUrl(url, handle);
    if (!product) {
      return NextResponse.json(
        { success: false, error: "Product not found. Enter name manually." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      product: {
        name: product.title,
        imageUrl: product.imageUrl,
        handle,
      },
    });
  } catch (err) {
    console.error("Product lookup error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to look up product" },
      { status: 500 }
    );
  }
}
