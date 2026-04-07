import { NextRequest, NextResponse } from "next/server";
import {
  getInfluencerShipmentById,
  updateInfluencerProducts,
} from "@/lib/data/notion";
import { Product } from "@/lib/data/types";
import {
  extractProductHandle,
  findVariantInventoryItemId,
  adjustInventory,
} from "@/lib/shopify";

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

    // Fetch old products to compute delta
    const shipment = await getInfluencerShipmentById(id);
    const oldProducts = shipment?.products || [];
    console.log("[inventory] old products:", oldProducts.length, "new products:", products.length);

    // Compute delta: what was added vs removed
    const oldMap = new Map(oldProducts.map((p) => [p.id, p]));
    const newMap = new Map(products.map((p) => [p.id, p]));

    const toDeduct: Product[] = []; // newly added or size/url changed → -1
    const toRestore: Product[] = []; // removed or old version of changed → +1

    for (const np of products) {
      const op = oldMap.get(np.id);
      if (!op) {
        toDeduct.push(np);
      } else if (op.size !== np.size || op.productUrl !== np.productUrl) {
        toRestore.push(op);
        toDeduct.push(np);
      } else if (!op.received && np.received) {
        // Marked as "Received Back" → restore inventory
        toRestore.push(np);
      } else if (op.received && !np.received) {
        // Unmarked "Received Back" → deduct again
        toDeduct.push(np);
      }
    }
    for (const op of oldProducts) {
      if (!newMap.has(op.id) && !op.received) {
        toRestore.push(op);
      }
    }

    console.log("[inventory] toDeduct:", toDeduct.map(p => `${p.name} (${p.size})`));
    console.log("[inventory] toRestore:", toRestore.map(p => `${p.name} (${p.size})`));

    // Save to Notion first (source of truth)
    await updateInfluencerProducts(id, products);

    // Best-effort inventory adjustments
    const inventoryWarnings: string[] = [];

    async function adjustForProduct(product: Product, delta: number) {
      if (!product.size || !product.productUrl) return;
      const handle = extractProductHandle(product.productUrl);
      if (!handle) {
        inventoryWarnings.push(`Could not extract handle from ${product.productUrl}`);
        return;
      }
      console.log("[inventory] looking up handle:", handle, "size:", product.size);
      const inventoryItemId = await findVariantInventoryItemId(handle, product.size);
      console.log("[inventory] inventoryItemId:", inventoryItemId);
      if (!inventoryItemId) {
        inventoryWarnings.push(`No variant found for "${product.name}" size "${product.size}"`);
        return;
      }
      const result = await adjustInventory(inventoryItemId, delta);
      if (!result.adjusted && result.warning) {
        inventoryWarnings.push(`"${product.name}" (${product.size}): ${result.warning}`);
      }
    }

    for (const p of toDeduct) {
      try {
        await adjustForProduct(p, -1);
      } catch (err) {
        inventoryWarnings.push(`Failed to deduct inventory for "${p.name}": ${err}`);
      }
    }
    for (const p of toRestore) {
      try {
        await adjustForProduct(p, +1);
      } catch (err) {
        inventoryWarnings.push(`Failed to restore inventory for "${p.name}": ${err}`);
      }
    }

    return NextResponse.json({ success: true, products, inventoryWarnings });
  } catch (err) {
    console.error("Update products error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to update products" },
      { status: 500 }
    );
  }
}
