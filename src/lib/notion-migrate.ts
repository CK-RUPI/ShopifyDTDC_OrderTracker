import * as dotenv from "dotenv";
import * as path from "path";

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

function headers() {
  return {
    Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

async function findDatabase(pageId: string, name: string): Promise<string | null> {
  const res = await fetch(`${NOTION_API}/blocks/${pageId}/children?page_size=100`, {
    headers: headers(),
  });
  const data = await res.json();
  for (const block of data.results || []) {
    if (
      block.type === "child_database" &&
      block.child_database?.title === name
    ) {
      return block.id;
    }
  }
  return null;
}

async function migrate() {
  const pageId = process.env.NOTION_PAGE_ID!;
  if (!pageId) {
    throw new Error("NOTION_PAGE_ID is required");
  }

  console.log("Finding Shopify Orders database...");

  // Find the existing orders database
  const res = await fetch(`${NOTION_API}/blocks/${pageId}/children?page_size=100`, {
    headers: headers(),
  });
  const data = await res.json();

  let orderDbId: string | null = null;
  for (const block of data.results || []) {
    if (block.type === "child_database") {
      orderDbId = block.id;
      break;
    }
  }

  if (!orderDbId) {
    throw new Error("Shopify Orders database not found. Run notion-setup.ts first.");
  }

  console.log(`Found orders database: ${orderDbId}`);

  // Add new properties to the orders database
  console.log("Adding new properties to orders database...");
  const updateRes = await fetch(`${NOTION_API}/databases/${orderDbId}`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify({
      properties: {
        "Customer Phone": { phone_number: {} },
        "Payment Method": {
          select: {
            options: [
              { name: "COD", color: "orange" },
              { name: "Prepaid", color: "green" },
            ],
          },
        },
        "Order Total": { number: { format: "number" } },
        "COD Collection Status": {
          select: {
            options: [
              { name: "Pending", color: "yellow" },
              { name: "Collected", color: "green" },
            ],
          },
        },
        "RTO Tracking Number": { rich_text: {} },
        "Delivered Timestamp": { rich_text: {} },
        "Delivery Email Sent": { checkbox: {} },
        // Update Delivery Status to include RTO
        "Delivery Status": {
          select: {
            options: [
              { name: "Booked", color: "yellow" },
              { name: "Picked Up", color: "yellow" },
              { name: "In Transit", color: "blue" },
              { name: "At Destination", color: "orange" },
              { name: "Out for Delivery", color: "orange" },
              { name: "Delivered", color: "green" },
              { name: "Stuck", color: "red" },
              { name: "RTO", color: "purple" },
            ],
          },
        },
      },
    }),
  });

  if (!updateRes.ok) {
    const err = await updateRes.json();
    throw new Error(`Failed to update orders database: ${err.message}`);
  }

  console.log("Orders database updated successfully.");

  // Create Influencer Shipments database
  console.log("Creating Influencer Shipments database...");

  const existing = await findDatabase(pageId, "Influencer Shipments");
  if (existing) {
    console.log(`Influencer Shipments database already exists: ${existing}`);
  } else {
    const createRes = await fetch(`${NOTION_API}/databases`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        parent: { type: "page_id", page_id: pageId },
        title: [{ text: { content: "Influencer Shipments" } }],
        properties: {
          Label: { title: {} },
          "Tracking Number": { rich_text: {} },
          "Courier Partner": {
            select: { options: [{ name: "DTDC", color: "blue" }] },
          },
          "Delivery Status": {
            select: {
              options: [
                { name: "Booked", color: "yellow" },
                { name: "Picked Up", color: "yellow" },
                { name: "In Transit", color: "blue" },
                { name: "At Destination", color: "orange" },
                { name: "Out for Delivery", color: "orange" },
                { name: "Delivered", color: "green" },
                { name: "Stuck", color: "red" },
                { name: "RTO", color: "purple" },
              ],
            },
          },
          "Origin City": { rich_text: {} },
          "Destination City": { rich_text: {} },
          "Expected Delivery": { date: {} },
          "Delivered Date": { date: {} },
          "Receiver Name": { rich_text: {} },
          "Last Updated": { date: {} },
          "Tracking Timeline": { rich_text: {} },
          "Created At": { date: {} },
        },
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.json();
      throw new Error(`Failed to create influencer database: ${err.message}`);
    }

    const createData = await createRes.json();
    console.log(`Influencer Shipments database created: ${createData.id}`);
  }

  console.log("Migration complete!");
}

migrate().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
