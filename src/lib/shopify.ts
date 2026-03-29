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

async function shopifyFetch(endpoint: string): Promise<unknown> {
  const token = await getAccessToken();
  const response = await fetch(`https://${STORE_URL}/admin/api/2024-01${endpoint}`, {
    headers: {
      "X-Shopify-Access-Token": token,
      "Content-Type": "application/json",
    },
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
  fulfillments: Array<{
    id: number;
    status: string;
    created_at: string;
    tracking_number: string | null;
    tracking_numbers: string[];
    tracking_company: string | null;
  }>;
}

export async function getFulfilledOrders(): Promise<ShopifyOrder[]> {
  const allOrders: ShopifyOrder[] = [];
  let url = "/orders.json?fulfillment_status=shipped&status=any&limit=50";

  while (url) {
    const data = (await shopifyFetch(url)) as {
      orders: ShopifyOrder[];
    };
    allOrders.push(...data.orders);

    // Simple pagination — if we got 50, there might be more
    if (data.orders.length === 50) {
      const lastId = data.orders[data.orders.length - 1].id;
      url = `/orders.json?fulfillment_status=shipped&status=any&limit=50&since_id=${lastId}`;
    } else {
      url = "";
    }
  }

  return allOrders;
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
