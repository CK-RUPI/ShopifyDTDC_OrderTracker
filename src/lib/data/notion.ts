import {
  DataProvider,
  Order,
  OrderFilters,
  DeliveryStatus,
  TrackingEvent,
  InfluencerShipment,
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
  const orderTotalProp = props["Order Total"] as { number?: number | null } | undefined;
  const orderTotal = orderTotalProp?.number ?? 0;

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
  };
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
  };
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
      filterConditions.push({
        property: "Delivery Status",
        select: { does_not_equal: "RTO Received" },
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
      // Don't overwrite delivery status and tracking data on re-sync
      const updateProps = { ...properties };
      delete updateProps["Delivery Status"];
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
    }
  ): Promise<void> {
    const databaseId = await getDatabaseId();

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
        { property: "Delivery Status", select: { does_not_equal: "RTO" } },
        { property: "Delivery Status", select: { does_not_equal: "RTO Received" } },
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

  async getOrderById(orderId: string): Promise<Order | null> {
    const res = await fetch(`${NOTION_API}/pages/${orderId}`, {
      headers: headers(),
    });
    if (!res.ok) return null;
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
  }): Promise<InfluencerShipment> {
    const databaseId = await getInfluencerDatabaseId();
    const now = new Date().toISOString().split("T")[0];

    const res = await fetch(`${NOTION_API}/pages`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties: {
          Label: {
            title: [{ text: { content: shipment.label || "Untitled" } }],
          },
          "Tracking Number": {
            rich_text: [{ text: { content: shipment.trackingNumber } }],
          },
          "Courier Partner": { select: { name: "DTDC" } },
          "Delivery Status": { select: { name: "Booked" } },
          "Created At": { date: { start: now } },
          "Last Updated": { date: { start: now } },
        },
      }),
    });

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
};
