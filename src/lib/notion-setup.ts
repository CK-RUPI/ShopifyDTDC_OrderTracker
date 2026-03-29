import { Client } from "@notionhq/client";
import * as dotenv from "dotenv";
import * as path from "path";

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const pageId = process.env.NOTION_PAGE_ID!;

async function setup() {
  console.log("Checking Notion database...");

  const children = await notion.blocks.children.list({ block_id: pageId });
  for (const block of children.results) {
    if ("type" in block && block.type === "child_database") {
      console.log("Database found:", block.id);
      console.log("Setup complete! Run: npm run dev");
      return;
    }
  }

  // Create via raw fetch since SDK v5 changed the databases.create API
  const response = await fetch("https://api.notion.com/v1/databases", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      parent: { type: "page_id", page_id: pageId },
      title: [{ text: { content: "Shopify Orders" } }],
      properties: {
        "Order Number": { title: {} },
        "Shopify Order ID": { number: {} },
        "Customer Name": { rich_text: {} },
        "Customer Email": { email: {} },
        "Shipping Address": { rich_text: {} },
        "Tracking Number": { rich_text: {} },
        "Courier Partner": {
          select: { options: [{ name: "DTDC", color: "blue" }] },
        },
        "Order Date": { date: {} },
        "Fulfilled Date": { date: {} },
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
      },
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.message || "Failed to create database");
  }

  const data = await response.json();
  console.log("Database created:", data.id);
  console.log("Setup complete! Run: npm run dev");
}

setup().catch((err) => {
  console.error("Setup failed:", err.message);
  process.exit(1);
});
