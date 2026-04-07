const STORE_URL = process.env.SHOPIFY_STORE_URL!;
const CLIENT_ID = process.env.SHOPIFY_CLIENT_ID!;
const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET!;

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 5min buffer)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 300000) {
    return cachedToken.token;
  }

  const response = await fetch(
    `https://${STORE_URL}/admin/oauth/access_token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Shopify auth failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 86400) * 1000,
  };

  return data.access_token;
}

async function shopifyFetch(
  endpoint: string,
  options?: { method?: string; body?: unknown }
): Promise<unknown> {
  const token = await getAccessToken();
  const response = await fetch(`https://${STORE_URL}/admin/api/2024-01${endpoint}`, {
    method: options?.method || "GET",
    headers: {
      "X-Shopify-Access-Token": token,
      "Content-Type": "application/json",
    },
    ...(options?.body ? { body: JSON.stringify(options.body) } : {}),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Shopify API error (${response.status}): ${text}`);
  }

  return response.json();
}

export interface ShopifyOrder {
  id: number;
  name: string; // order number like "#1042"
  email: string;
  created_at: string;
  total_price: string;
  financial_status: string;
  payment_gateway_names: string[];
  customer: {
    first_name: string;
    last_name: string;
    email: string;
  } | null;
  shipping_address: {
    address1: string;
    address2: string;
    city: string;
    province: string;
    zip: string;
    country: string;
    phone: string;
  } | null;
  line_items: Array<{
    id: number;
    title: string;
    quantity: number;
  }>;
  cancelled_at: string | null;
  fulfillments: Array<{
    id: number;
    status: string;
    created_at: string;
    tracking_number: string | null;
    tracking_numbers: string[];
    tracking_company: string | null;
  }>;
}

export async function getFulfilledOrders(updatedAtMin?: string): Promise<ShopifyOrder[]> {
  const allOrders: ShopifyOrder[] = [];
  const dateFilter = updatedAtMin ? `&updated_at_min=${updatedAtMin}` : "";
  let url = `/orders.json?fulfillment_status=shipped&status=any&limit=50${dateFilter}`;

  while (url) {
    const data = (await shopifyFetch(url)) as {
      orders: ShopifyOrder[];
    };
    allOrders.push(...data.orders);

    // Simple pagination — if we got 50, there might be more
    if (data.orders.length === 50) {
      const lastId = data.orders[data.orders.length - 1].id;
      url = `/orders.json?fulfillment_status=shipped&status=any&limit=50${dateFilter}&since_id=${lastId}`;
    } else {
      url = "";
    }
  }

  return allOrders;
}

export async function getUnfulfilledOrders(updatedAtMin?: string): Promise<ShopifyOrder[]> {
  const allOrders: ShopifyOrder[] = [];
  const dateFilter = updatedAtMin ? `&updated_at_min=${updatedAtMin}` : "";
  let url = `/orders.json?fulfillment_status=unfulfilled&status=open&limit=50${dateFilter}`;

  while (url) {
    const data = (await shopifyFetch(url)) as {
      orders: ShopifyOrder[];
    };
    allOrders.push(...data.orders);

    if (data.orders.length === 50) {
      const lastId = data.orders[data.orders.length - 1].id;
      url = `/orders.json?fulfillment_status=unfulfilled&status=open&limit=50${dateFilter}&since_id=${lastId}`;
    } else {
      url = "";
    }
  }

  return allOrders;
}

export async function createShopifyFulfillment(
  shopifyOrderId: string,
  trackingNumber: string,
  courierPartner: string
): Promise<void> {
  const foData = (await shopifyFetch(
    `/orders/${shopifyOrderId}/fulfillment_orders.json`
  )) as {
    fulfillment_orders: Array<{
      id: number;
      status: string;
      line_items: Array<{ id: number; quantity: number; fulfillable_quantity: number }>;
    }>;
  };

  const fulfillmentOrders = foData.fulfillment_orders;
  if (!fulfillmentOrders || fulfillmentOrders.length === 0) {
    throw new Error("No fulfillment orders found for this order");
  }

  // Only include fulfillment orders that have fulfillable items
  const lineItemsByFulfillmentOrder = fulfillmentOrders
    .filter((fo) => fo.status === "open" || fo.status === "in_progress")
    .map((fo) => ({
      fulfillment_order_id: fo.id,
      fulfillment_order_line_items: fo.line_items
        .filter((li) => li.fulfillable_quantity > 0)
        .map((li) => ({
          id: li.id,
          quantity: li.fulfillable_quantity,
        })),
    }))
    .filter((fo) => fo.fulfillment_order_line_items.length > 0);

  if (lineItemsByFulfillmentOrder.length === 0) {
    const debug = fulfillmentOrders.map((fo) => ({
      id: fo.id,
      status: fo.status,
      items: fo.line_items.map((li) => ({
        id: li.id,
        qty: li.quantity,
        fulfillable: li.fulfillable_quantity,
      })),
    }));
    throw new Error(
      `No fulfillable items found. Fulfillment orders: ${JSON.stringify(debug)}`
    );
  }

  await shopifyFetch("/fulfillments.json", {
    method: "POST",
    body: {
      fulfillment: {
        line_items_by_fulfillment_order: lineItemsByFulfillmentOrder,
        tracking_info: {
          number: trackingNumber,
          company: courierPartner || "DTDC",
        },
      },
    },
  });
}

export async function getOrderLineItems(
  shopifyOrderId: string
): Promise<Array<{ title: string; quantity: number; variantTitle: string }>> {
  const data = (await shopifyFetch(`/orders/${shopifyOrderId}.json`)) as {
    order: {
      line_items: Array<{
        title: string;
        quantity: number;
        variant_title: string | null;
      }>;
    };
  };
  return data.order.line_items.map((li) => ({
    title: li.title,
    quantity: li.quantity,
    variantTitle: li.variant_title || "",
  }));
}

export async function cancelShopifyOrder(shopifyOrderId: string): Promise<void> {
  await shopifyFetch(`/orders/${shopifyOrderId}/cancel.json`, {
    method: "POST",
    body: { reason: "other", email: false },
  });
}

export async function getShopifyOrder(shopifyOrderId: string): Promise<ShopifyOrder> {
  const data = (await shopifyFetch(`/orders/${shopifyOrderId}.json`)) as {
    order: ShopifyOrder;
  };
  return data.order;
}

export function extractProductHandle(url: string): string | null {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    const match = parsed.pathname.match(/\/products\/([^/?#]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export async function getProductFromPublicUrl(
  url: string,
  handle: string
): Promise<{ title: string; imageUrl: string } | null> {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    const jsonUrl = `${parsed.origin}/products/${handle}.json`;

    const res = await fetch(jsonUrl, {
      headers: { Accept: "application/json" },
    });

    if (!res.ok) return null;

    const data = await res.json();
    const product = data?.product;
    if (!product) return null;

    return {
      title: product.title || "",
      imageUrl: product.images?.[0]?.src || product.image?.src || "",
    };
  } catch {
    return null;
  }
}

export function formatShippingAddress(
  addr: ShopifyOrder["shipping_address"]
): string {
  if (!addr) return "";
  const parts = [
    addr.address1,
    addr.address2,
    addr.city,
    addr.province,
    addr.zip,
    addr.country,
  ].filter(Boolean);
  return parts.join(", ");
}
