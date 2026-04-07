import {
  DataProvider,
  Order,
  OrderFilters,
  DeliveryStatus,
  TrackingEvent,
  InfluencerShipment,
  Product,
} from "./types";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

function headers() {
  return {
    Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

let cachedDatabaseId: string | null = null;
let cachedInfluencerDbId: string | null = null;
let shippingModePropertyCreated = false;
let reviewEmailPropertyCreated = false;
let weightPropertyCreated = false;
let cancelReasonPropertyCreated = false;

async function getDatabaseId(): Promise<string> {
  if (cachedDatabaseId) return cachedDatabaseId;

  const pageId = process.env.NOTION_PAGE_ID!;
  const res = await fetch(
    `${NOTION_API}/blocks/${pageId}/children?page_size=100`,
    { headers: headers() }
  );
  const data = await res.json();

  for (const block of data.results || []) {
    if (
      block.type === "child_database" &&
      block.child_database?.title !== "Influencer Shipments"
    ) {
      cachedDatabaseId = block.id;
      return block.id;
    }
  }

  throw new Error(
    "Notion database not found. Run: npx tsx src/lib/notion-setup.ts"
  );
}

async function getInfluencerDatabaseId(): Promise<string> {
  if (cachedInfluencerDbId) return cachedInfluencerDbId;

  const pageId = process.env.NOTION_PAGE_ID!;
  const res = await fetch(
    `${NOTION_API}/blocks/${pageId}/children?page_size=100`,
    { headers: headers() }
  );
  const data = await res.json();

  for (const block of data.results || []) {
    if (
      block.type === "child_database" &&
      block.child_database?.title === "Influencer Shipments"
    ) {
      cachedInfluencerDbId = block.id;
      return block.id;
    }
  }

  throw new Error(
    "Influencer Shipments database not found. Run: npx tsx src/lib/notion-migrate.ts"
  );
}

async function queryDatabase(
  databaseId: string,
  filter?: Record<string, unknown>,
  sorts?: Array<Record<string, unknown>>
): Promise<Record<string, unknown>[]> {
  const allResults: Record<string, unknown>[] = [];
  let startCursor: string | undefined;

  do {
    const body: Record<string, unknown> = {};
    if (filter) body.filter = filter;
    if (sorts) body.sorts = sorts;
    if (startCursor) body.start_cursor = startCursor;

    const res = await fetch(`${NOTION_API}/databases/${databaseId}/query`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      const errorMsg = data.message || JSON.stringify(data);
      console.error("Notion query error:", errorMsg);
      throw new Error(`Notion query failed (${res.status}): ${errorMsg}`);
    }

    allResults.push(...(data.results || []));
    startCursor = data.has_more ? data.next_cursor : undefined;
  } while (startCursor);

  return allResults;
}

function toRichTextBlocks(str: string): Array<{ text: { content: string } }> {
  const BLOCK_LIMIT = 2000;
  const blocks: Array<{ text: { content: string } }> = [];
  for (let i = 0; i < str.length; i += BLOCK_LIMIT) {
    blocks.push({ text: { content: str.slice(i, i + BLOCK_LIMIT) } });
  }
  if (blocks.length === 0) {
    blocks.push({ text: { content: "" } });
  }
  return blocks;
}

function parseOrder(page: Record<string, unknown>): Order {
  const props = page.properties as Record<string, unknown>;

  const getText = (prop: unknown): string => {
    const p = prop as { rich_text?: Array<{ plain_text: string }> };
    return p?.rich_text?.map(b => b.plain_text).join("") || "";
  };

  const getTitle = (prop: unknown): string => {
    const p = prop as { title?: Array<{ plain_text: string }> };
    return p?.title?.[0]?.plain_text || "";
  };

  const getDate = (prop: unknown): string => {
    const p = prop as { date?: { start: string } | null };
    return p?.date?.start || "";
  };

  const getSelect = (prop: unknown): string => {
    const p = prop as { select?: { name: string } | null };
    return p?.select?.name || "";
  };

  const getNumber = (prop: unknown): string => {
    const p = prop as { number?: number | null };
    return p?.number?.toString() || "";
  };

  const getEmail = (prop: unknown): string => {
    const p = prop as { email?: string | null };
    return p?.email || "";
  };

  const getPhone = (prop: unknown): string => {
    const p = prop as { phone_number?: string | null };
    return p?.phone_number || "";
  };

  const getCheckbox = (prop: unknown): boolean => {
    const p = prop as { checkbox?: boolean };
    return p?.checkbox || false;
  };

  let timeline: TrackingEvent[] = [];
  const timelineStr = getText(props["Tracking Timeline"]);
  if (timelineStr) {
    try {
      timeline = JSON.parse(timelineStr);
    } catch {
      timeline = [];
    }
  }

  const paymentMethod = getSelect(props["Payment Method"]);
  const codStatus = getSelect(props["COD Collection Status"]);
  const shippingModeRaw = getSelect(props["Shipping Mode"]);
  const orderTotalProp = props["Order Total"] as { number?: number | null } | undefined;
  const orderTotal = orderTotalProp?.number ?? 0;
  const weightProp = props["Weight (g)"] as { number?: number | null } | undefined;
  const weightGrams = weightProp?.number ?? 0;

  return {
    id: (page as { id: string }).id,
    shopifyOrderId: getNumber(props["Shopify Order ID"]),
    orderNumber: getTitle(props["Order Number"]),
    customerName: getText(props["Customer Name"]),
    customerEmail: getEmail(props["Customer Email"]),
    customerPhone: getPhone(props["Customer Phone"]),
    shippingAddress: getText(props["Shipping Address"]),
    trackingNumber: getText(props["Tracking Number"]),
    courierPartner: getSelect(props["Courier Partner"]),
    paymentMethod: (paymentMethod === "COD" ? "COD" : "Prepaid") as "COD" | "Prepaid",
    orderTotal,
    codCollectionStatus: (codStatus === "Pending" || codStatus === "Collected" ? codStatus : "") as "Pending" | "Collected" | "",
    orderDate: getDate(props["Order Date"]),
    fulfilledDate: getDate(props["Fulfilled Date"]),
    deliveryStatus: (getSelect(props["Delivery Status"]) ||
      "Booked") as DeliveryStatus,
    originCity: getText(props["Origin City"]),
    destinationCity: getText(props["Destination City"]),
    expectedDeliveryDate: getDate(props["Expected Delivery"]),
    deliveredDate: getDate(props["Delivered Date"]),
    deliveredTimestamp: getText(props["Delivered Timestamp"]),
    receiverName: getText(props["Receiver Name"]),
    lastUpdated: getDate(props["Last Updated"]),
    trackingTimeline: timeline,
    rtoTrackingNumber: getText(props["RTO Tracking Number"]),
    deliveryEmailSent: getCheckbox(props["Delivery Email Sent"]),
    reviewEmailSent: getCheckbox(props["Review Email Sent"]),
    shippingMode: (shippingModeRaw || (paymentMethod === "COD" ? "Road" : "Air")) as "Air" | "Road",
    weightGrams,
    cancellationReason: getText(props["Cancellation Reason"]),
  };
}

let influencerDbMigrated = false;
async function ensureInfluencerDbProperties(databaseId: string) {
  if (influencerDbMigrated) return;
  try {
    await fetch(`${NOTION_API}/databases/${databaseId}`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({
        properties: {
          "Phone Number": { rich_text: {} },
          "Instagram Handle": { rich_text: {} },
          "Jaipur Influencer": { checkbox: {} },
          "Products": { rich_text: {} },
          "Courier Partner": {
            select: {
              options: [
                { name: "DTDC", color: "blue" },
                { name: "Hand Delivery", color: "green" },
              ],
            },
          },
        },
      }),
    });
    influencerDbMigrated = true;
  } catch {
    // Properties may already exist, that's fine
    influencerDbMigrated = true;
  }
}

function parseInfluencerShipment(page: Record<string, unknown>): InfluencerShipment {
  const props = page.properties as Record<string, unknown>;

  const getText = (prop: unknown): string => {
    const p = prop as { rich_text?: Array<{ plain_text: string }> };
    return p?.rich_text?.map(b => b.plain_text).join("") || "";
  };

  const getTitle = (prop: unknown): string => {
    const p = prop as { title?: Array<{ plain_text: string }> };
    return p?.title?.[0]?.plain_text || "";
  };

  const getDate = (prop: unknown): string => {
    const p = prop as { date?: { start: string } | null };
    return p?.date?.start || "";
  };

  const getSelect = (prop: unknown): string => {
    const p = prop as { select?: { name: string } | null };
    return p?.select?.name || "";
  };

  let timeline: TrackingEvent[] = [];
  const timelineStr = getText(props["Tracking Timeline"]);
  if (timelineStr) {
    try {
      timeline = JSON.parse(timelineStr);
    } catch {
      timeline = [];
    }
  }

  let products: Product[] = [];
  const productsStr = getText(props["Products"]);
  if (productsStr) {
    try {
      products = JSON.parse(productsStr);
    } catch {
      products = [];
    }
  }

  const getCheckbox = (prop: unknown): boolean => {
    const p = prop as { checkbox?: boolean };
    return p?.checkbox ?? false;
  };

  return {
    id: (page as { id: string }).id,
    label: getTitle(props["Label"]),
    trackingNumber: getText(props["Tracking Number"]),
    courierPartner: getSelect(props["Courier Partner"]),
    deliveryStatus: (getSelect(props["Delivery Status"]) || "Booked") as DeliveryStatus,
    originCity: getText(props["Origin City"]),
    destinationCity: getText(props["Destination City"]),
    expectedDeliveryDate: getDate(props["Expected Delivery"]),
    deliveredDate: getDate(props["Delivered Date"]),
    receiverName: getText(props["Receiver Name"]),
    lastUpdated: getDate(props["Last Updated"]),
    trackingTimeline: timeline,
    createdAt: getDate(props["Created At"]),
    products,
    phoneNumber: getText(props["Phone Number"]),
    instagramHandle: getText(props["Instagram Handle"]),
    isJaipurInfluencer: getCheckbox(props["Jaipur Influencer"]),
  };
}

export async function getInfluencerShipmentById(
  pageId: string
): Promise<InfluencerShipment | null> {
  const res = await fetch(`${NOTION_API}/pages/${pageId}`, {
    headers: headers(),
  });
  if (!res.ok) return null;
  const page = await res.json();
  return parseInfluencerShipment(page);
}

export async function updateInfluencerProducts(
  pageId: string,
  products: Product[]
): Promise<void> {
  const productsStr = JSON.stringify(products);
  const res = await fetch(`${NOTION_API}/pages/${pageId}`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify({
      properties: {
        Products: {
          rich_text: toRichTextBlocks(productsStr),
        },
      },
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error(`Notion PATCH failed for products on ${pageId}: ${res.status}`, errorBody);
    throw new Error(`Notion update failed: ${res.status}`);
  }
}

export const notionProvider: DataProvider = {
  async getOrders(filters?: OrderFilters): Promise<Order[]> {
    const databaseId = await getDatabaseId();

    const filterConditions: Record<string, unknown>[] = [];

    if (filters?.status) {
      filterConditions.push({
        property: "Delivery Status",
        select: { equals: filters.status },
      });
    }

    if (filters?.hideDelivered) {
      filterConditions.push({
        property: "Delivery Status",
        select: { does_not_equal: "Delivered" },
      });
    }

    let filter: Record<string, unknown> | undefined;
    if (filterConditions.length === 1) {
      filter = filterConditions[0];
    } else if (filterConditions.length > 1) {
      filter = { and: filterConditions };
    }

    const sorts = [{ property: "Shopify Order ID", direction: "descending" }];
    const results = await queryDatabase(databaseId, filter, sorts);
    let orders = results.map((page) => parseOrder(page));

    // Hide initial test orders (#1024 and below)
    orders = orders.filter((o) => {
      const num = parseInt(o.orderNumber.replace(/\D/g, ""), 10);
      return !isNaN(num) && num > 1025;
    });

    // Client-side filter: hide terminal statuses (can't filter in Notion until option exists)
    if (filters?.hideDelivered) {
      orders = orders.filter((o) => o.deliveryStatus !== "RTO Received" && o.deliveryStatus !== "Cancelled");
    }

    if (filters?.search) {
      const search = filters.search.toLowerCase();
      orders = orders.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(search) ||
          o.customerName.toLowerCase().includes(search) ||
          o.trackingNumber.toLowerCase().includes(search) ||
          o.destinationCity.toLowerCase().includes(search)
      );
    }

    // Client-side filter: Shipping Mode (can't filter in Notion until property exists)
    if (filters?.shippingMode) {
      orders = orders.filter((o) => o.shippingMode === filters.shippingMode);
    }

    return orders;
  },

  async upsertOrder(order: Omit<Order, "id">): Promise<Order> {
    const databaseId = await getDatabaseId();

    // Check if order exists
    const existing = await queryDatabase(databaseId, {
      property: "Shopify Order ID",
      number: { equals: parseInt(order.shopifyOrderId) },
    });

    const properties: Record<string, unknown> = {
      "Order Number": {
        title: [{ text: { content: order.orderNumber } }],
      },
      "Shopify Order ID": { number: parseInt(order.shopifyOrderId) },
      "Customer Name": {
        rich_text: [{ text: { content: order.customerName } }],
      },
      "Customer Email": { email: order.customerEmail || null },
      "Customer Phone": { phone_number: order.customerPhone || null },
      "Shipping Address": {
        rich_text: [{ text: { content: order.shippingAddress } }],
      },
      "Tracking Number": {
        rich_text: [{ text: { content: order.trackingNumber } }],
      },
      "Courier Partner": {
        select: { name: order.courierPartner || "DTDC" },
      },
      "Delivery Status": {
        select: { name: order.deliveryStatus || "Booked" },
      },
      "Payment Method": {
        select: { name: order.paymentMethod },
      },
      "Order Total": { number: order.orderTotal },
    };

    if (order.codCollectionStatus) {
      properties["COD Collection Status"] = {
        select: { name: order.codCollectionStatus },
      };
    }

    if (order.orderDate) {
      properties["Order Date"] = { date: { start: order.orderDate } };
    }
    if (order.fulfilledDate) {
      properties["Fulfilled Date"] = {
        date: { start: order.fulfilledDate },
      };
    }

    if (existing.length > 0) {
      const pageId = (existing[0] as { id: string }).id;
      // Don't overwrite delivery status, COD collection status, and tracking data on re-sync
      const updateProps = { ...properties };
      delete updateProps["Delivery Status"];
      delete updateProps["COD Collection Status"];
      const res = await fetch(`${NOTION_API}/pages/${pageId}`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({ properties: updateProps }),
      });
      const data = await res.json();
      return parseOrder(data);
    } else {
      const res = await fetch(`${NOTION_API}/pages`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          parent: { database_id: databaseId },
          properties,
        }),
      });
      const data = await res.json();
      return parseOrder(data);
    }
  },

  async updateOrderTracking(
    trackingNumber: string,
    data: {
      deliveryStatus: DeliveryStatus;
      originCity: string;
      destinationCity: string;
      expectedDeliveryDate: string;
      deliveredDate: string;
      deliveredTimestamp: string;
      receiverName: string;
      lastUpdated: string;
      trackingTimeline: TrackingEvent[];
    },
    knownPageId?: string
  ): Promise<void> {
    let pageId = knownPageId;

    if (!pageId) {
      const databaseId = await getDatabaseId();
      const existing = await queryDatabase(databaseId, {
        property: "Tracking Number",
        rich_text: { equals: trackingNumber },
      });
      if (existing.length === 0) return;
      pageId = (existing[0] as { id: string }).id;
    }
    const timelineStr = JSON.stringify(data.trackingTimeline);

    const properties: Record<string, unknown> = {
      "Delivery Status": { select: { name: data.deliveryStatus } },
      "Origin City": {
        rich_text: [{ text: { content: data.originCity } }],
      },
      "Destination City": {
        rich_text: [{ text: { content: data.destinationCity } }],
      },
      "Receiver Name": {
        rich_text: [{ text: { content: data.receiverName } }],
      },
      "Last Updated": { date: { start: data.lastUpdated } },
      "Tracking Timeline": {
        rich_text: toRichTextBlocks(timelineStr),
      },
    };

    if (data.expectedDeliveryDate) {
      properties["Expected Delivery"] = {
        date: { start: data.expectedDeliveryDate },
      };
    }
    if (data.deliveredDate) {
      properties["Delivered Date"] = {
        date: { start: data.deliveredDate },
      };
    }
    if (data.deliveredTimestamp) {
      properties["Delivered Timestamp"] = {
        rich_text: [{ text: { content: data.deliveredTimestamp } }],
      };
    }

    const patchRes = await fetch(`${NOTION_API}/pages/${pageId}`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({ properties }),
    });

    if (!patchRes.ok) {
      const errorBody = await patchRes.text();
      console.error(`Notion PATCH failed for tracking ${trackingNumber}: ${patchRes.status}`, errorBody);
      throw new Error(`Notion update failed: ${patchRes.status}`);
    }
  },

  async getActiveOrders(): Promise<Order[]> {
    const databaseId = await getDatabaseId();

    const results = await queryDatabase(databaseId, {
      and: [
        { property: "Delivery Status", select: { does_not_equal: "Delivered" } },
        { property: "Delivery Status", select: { does_not_equal: "RTO Received" } },
        { property: "Delivery Status", select: { does_not_equal: "Return Complete" } },
        { property: "Delivery Status", select: { does_not_equal: "Cancelled" } },
      ],
    });

    let orders = results.map((page) => parseOrder(page));

    // Exclude test orders (#1025 and below)
    orders = orders.filter((o) => {
      const num = parseInt(o.orderNumber.replace(/\D/g, ""), 10);
      return !isNaN(num) && num > 1025;
    });

    return orders;
  },

  async assignTracking(
    orderId: string,
    trackingNumber: string,
    courierPartner: string
  ): Promise<void> {
    const today = new Date().toISOString().split("T")[0];
    const res = await fetch(`${NOTION_API}/pages/${orderId}`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({
        properties: {
          "Tracking Number": {
            rich_text: [{ text: { content: trackingNumber } }],
          },
          "Delivery Status": { select: { name: "Booked" } },
          "Courier Partner": { select: { name: courierPartner || "DTDC" } },
          "Fulfilled Date": { date: { start: today } },
          "Last Updated": { date: { start: today } },
        },
      }),
    });
    if (!res.ok) {
      const errorBody = await res.text();
      console.error(`Notion assignTracking failed for ${orderId}: ${res.status}`, errorBody);
      throw new Error(`Notion update failed: ${res.status}`);
    }
  },

  async getOrderById(orderId: string): Promise<Order | null> {
    const res = await fetch(`${NOTION_API}/pages/${orderId}`, {
      headers: headers(),
    });
    if (!res.ok) {
      const errorBody = await res.text();
      console.error(`getOrderById failed for ${orderId}: ${res.status}`, errorBody);
      return null;
    }
    const page = await res.json();
    return parseOrder(page);
  },

  async updateDeliveryStatus(orderId: string, status: DeliveryStatus): Promise<void> {
    await fetch(`${NOTION_API}/pages/${orderId}`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({
        properties: {
          "Delivery Status": { select: { name: status } },
        },
      }),
    });
  },

  async updateCodStatus(orderId: string, status: "Pending" | "Collected"): Promise<void> {
    await fetch(`${NOTION_API}/pages/${orderId}`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({
        properties: {
          "COD Collection Status": { select: { name: status } },
        },
      }),
    });
  },

  async updateShippingMode(orderId: string, mode: "Air" | "Road"): Promise<void> {
    // Ensure the "Shipping Mode" property exists on the database
    if (!shippingModePropertyCreated) {
      const databaseId = await getDatabaseId();
      await fetch(`${NOTION_API}/databases/${databaseId}`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({
          properties: {
            "Shipping Mode": {
              select: {
                options: [
                  { name: "Air", color: "blue" },
                  { name: "Road", color: "orange" },
                ],
              },
            },
          },
        }),
      });
      shippingModePropertyCreated = true;
    }

    const res = await fetch(`${NOTION_API}/pages/${orderId}`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({
        properties: {
          "Shipping Mode": { select: { name: mode } },
        },
      }),
    });
    if (!res.ok) {
      const errorBody = await res.text();
      console.error(`Notion updateShippingMode failed for ${orderId}: ${res.status}`, errorBody);
      throw new Error(`Notion update failed: ${res.status}`);
    }
  },

  async updateOrderWeight(orderId: string, weightGrams: number): Promise<void> {
    if (!weightPropertyCreated) {
      const databaseId = await getDatabaseId();
      await fetch(`${NOTION_API}/databases/${databaseId}`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({
          properties: {
            "Weight (g)": { number: {} },
          },
        }),
      });
      weightPropertyCreated = true;
    }

    const res = await fetch(`${NOTION_API}/pages/${orderId}`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({
        properties: {
          "Weight (g)": { number: weightGrams },
        },
      }),
    });
    if (!res.ok) {
      const errorBody = await res.text();
      console.error(`Notion updateOrderWeight failed for ${orderId}: ${res.status}`, errorBody);
      throw new Error(`Notion update failed: ${res.status}`);
    }
  },

  async updateRtoTracking(orderId: string, rtoTrackingNumber: string): Promise<void> {
    await fetch(`${NOTION_API}/pages/${orderId}`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({
        properties: {
          "RTO Tracking Number": {
            rich_text: [{ text: { content: rtoTrackingNumber } }],
          },
        },
      }),
    });
  },

  async markEmailSent(orderId: string): Promise<void> {
    await fetch(`${NOTION_API}/pages/${orderId}`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({
        properties: {
          "Delivery Email Sent": { checkbox: true },
        },
      }),
    });
  },

  async markReviewEmailSent(orderId: string): Promise<void> {
    if (!reviewEmailPropertyCreated) {
      const databaseId = await getDatabaseId();
      await fetch(`${NOTION_API}/databases/${databaseId}`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({
          properties: {
            "Review Email Sent": { checkbox: {} },
          },
        }),
      });
      reviewEmailPropertyCreated = true;
    }

    await fetch(`${NOTION_API}/pages/${orderId}`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({
        properties: {
          "Review Email Sent": { checkbox: true },
        },
      }),
    });
  },

  async cancelOrder(orderId: string, reason: string): Promise<void> {
    // Ensure the "Cancellation Reason" property exists
    if (!cancelReasonPropertyCreated) {
      const databaseId = await getDatabaseId();
      await fetch(`${NOTION_API}/databases/${databaseId}`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({
          properties: {
            "Cancellation Reason": { rich_text: {} },
          },
        }),
      });
      cancelReasonPropertyCreated = true;
    }

    const now = new Date().toISOString().split("T")[0];
    const res = await fetch(`${NOTION_API}/pages/${orderId}`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({
        properties: {
          "Delivery Status": { select: { name: "Cancelled" } },
          "Cancellation Reason": {
            rich_text: [{ text: { content: reason } }],
          },
          "Last Updated": { date: { start: now } },
        },
      }),
    });
    if (!res.ok) {
      const errorBody = await res.text();
      console.error(`Notion cancelOrder failed for ${orderId}: ${res.status}`, errorBody);
      throw new Error(`Notion update failed: ${res.status}`);
    }
  },

  // Influencer Shipments
  async getInfluencerShipments(): Promise<InfluencerShipment[]> {
    const databaseId = await getInfluencerDatabaseId();
    const sorts = [{ property: "Created At", direction: "descending" }];
    const results = await queryDatabase(databaseId, undefined, sorts);
    return results.map((page) => parseInfluencerShipment(page));
  },

  async createInfluencerShipment(shipment: {
    label: string;
    trackingNumber: string;
    phoneNumber: string;
    instagramHandle?: string;
    isJaipurInfluencer?: boolean;
  }): Promise<InfluencerShipment> {
    const databaseId = await getInfluencerDatabaseId();
    const now = new Date().toISOString().split("T")[0];
    const isJaipur = shipment.isJaipurInfluencer ?? false;

    // Ensure new properties exist in the database schema
    await ensureInfluencerDbProperties(databaseId);

    const properties: Record<string, unknown> = {
      Label: {
        title: [{ text: { content: shipment.label || "Untitled" } }],
      },
      "Phone Number": {
        rich_text: [{ text: { content: shipment.phoneNumber || "" } }],
      },
      "Courier Partner": { select: { name: isJaipur ? "Hand Delivery" : "DTDC" } },
      "Delivery Status": { select: { name: "Booked" } },
      "Created At": { date: { start: now } },
      "Last Updated": { date: { start: now } },
      "Jaipur Influencer": { checkbox: isJaipur },
    };

    if (!isJaipur && shipment.trackingNumber) {
      properties["Tracking Number"] = {
        rich_text: [{ text: { content: shipment.trackingNumber } }],
      };
    }

    if (isJaipur) {
      properties["Destination City"] = {
        rich_text: [{ text: { content: "Jaipur" } }],
      };
    }

    if (shipment.instagramHandle) {
      properties["Instagram Handle"] = {
        rich_text: [{ text: { content: shipment.instagramHandle } }],
      };
    }

    const res = await fetch(`${NOTION_API}/pages`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties,
      }),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      console.error(`Notion create influencer shipment failed: ${res.status}`, errorBody);
      throw new Error(`Notion create failed: ${res.status}`);
    }

    const data = await res.json();
    return parseInfluencerShipment(data);
  },

  async getActiveInfluencerShipments(): Promise<InfluencerShipment[]> {
    const databaseId = await getInfluencerDatabaseId();
    const results = await queryDatabase(databaseId, {
      property: "Delivery Status",
      select: { does_not_equal: "Delivered" },
    });
    return results.map((page) => parseInfluencerShipment(page));
  },

  async updateInfluencerTracking(
    trackingNumber: string,
    data: {
      deliveryStatus: DeliveryStatus;
      originCity: string;
      destinationCity: string;
      expectedDeliveryDate: string;
      deliveredDate: string;
      receiverName: string;
      lastUpdated: string;
      trackingTimeline: TrackingEvent[];
    }
  ): Promise<void> {
    const databaseId = await getInfluencerDatabaseId();

    const existing = await queryDatabase(databaseId, {
      property: "Tracking Number",
      rich_text: { equals: trackingNumber },
    });

    if (existing.length === 0) return;

    const pageId = (existing[0] as { id: string }).id;
    const timelineStr = JSON.stringify(data.trackingTimeline);

    const properties: Record<string, unknown> = {
      "Delivery Status": { select: { name: data.deliveryStatus } },
      "Origin City": {
        rich_text: [{ text: { content: data.originCity } }],
      },
      "Destination City": {
        rich_text: [{ text: { content: data.destinationCity } }],
      },
      "Receiver Name": {
        rich_text: [{ text: { content: data.receiverName } }],
      },
      "Last Updated": { date: { start: data.lastUpdated } },
      "Tracking Timeline": {
        rich_text: toRichTextBlocks(timelineStr),
      },
    };

    if (data.expectedDeliveryDate) {
      properties["Expected Delivery"] = {
        date: { start: data.expectedDeliveryDate },
      };
    }
    if (data.deliveredDate) {
      properties["Delivered Date"] = {
        date: { start: data.deliveredDate },
      };
    }

    await fetch(`${NOTION_API}/pages/${pageId}`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({ properties }),
    });
  },

  async markInfluencerDelivered(shipmentId: string): Promise<void> {
    const now = new Date().toISOString().split("T")[0];
    const res = await fetch(`${NOTION_API}/pages/${shipmentId}`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({
        properties: {
          "Delivery Status": { select: { name: "Delivered" } },
          "Delivered Date": { date: { start: now } },
          "Last Updated": { date: { start: now } },
        },
      }),
    });
    if (!res.ok) {
      const errorBody = await res.text();
      console.error(`Failed to mark delivered: ${res.status}`, errorBody);
      throw new Error(`Notion update failed: ${res.status}`);
    }
  },
};

export async function updateInfluencerStatus(
  shipmentId: string,
  status: string
): Promise<void> {
  const now = new Date().toISOString().split("T")[0];
  const res = await fetch(`${NOTION_API}/pages/${shipmentId}`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify({
      properties: {
        "Delivery Status": { select: { name: status } },
        "Last Updated": { date: { start: now } },
      },
    }),
  });
  if (!res.ok) {
    const errorBody = await res.text();
    console.error(`Failed to update influencer status: ${res.status}`, errorBody);
    throw new Error(`Notion update failed: ${res.status}`);
  }
}
