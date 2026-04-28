// Read-only diagnostic: pull all "Out for Delivery" orders from Notion,
// hit DTDC for each, and dump what header keys actually come back —
// specifically whether `workerMobile` is populated.
//
// Run: npx tsx scripts/debug-dtdc-raw.ts

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";
const DTDC_TRACK_URL =
  "https://www.dtdc.com/wp-json/custom/v1/domestic/track";

function headers() {
  return {
    Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

async function getOrdersDbId(): Promise<string> {
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
      return block.id;
    }
  }
  throw new Error("Orders DB not found");
}

function getText(prop: any): string {
  if (!prop) return "";
  if (prop.rich_text) return (prop.rich_text || []).map((t: any) => t.plain_text || "").join("");
  if (prop.title) return (prop.title || []).map((t: any) => t.plain_text || "").join("");
  return "";
}

function getSelectName(prop: any): string {
  return prop?.select?.name || "";
}

async function main() {
  if (!process.env.NOTION_API_KEY || !process.env.NOTION_PAGE_ID) {
    console.error("Missing NOTION_API_KEY or NOTION_PAGE_ID in .env.local");
    process.exit(1);
  }

  const dbId = await getOrdersDbId();
  console.log("Orders DB:", dbId);

  async function fetchByStatus(status: string) {
    const res = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        filter: { property: "Delivery Status", select: { equals: status } },
        sorts: [{ property: "Last Updated", direction: "descending" }],
        page_size: 100,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Notion query failed for "${status}": ${JSON.stringify(data)}`);
    return (data.results || [])
      .map((p: any) => ({
        orderNumber: getText(p.properties["Order Number"]) || getText(p.properties["Name"]),
        tracking: getText(p.properties["Tracking Number"]),
        notionWorkerMobile: getText(p.properties["Worker Mobile"]),
        notionAttemptCount: p.properties["Attempt Count"]?.number ?? 0,
        notionReasonDesc: getText(p.properties["Reason Description"]),
        notionLastUpdated: p.properties["Last Updated"]?.date?.start || "",
        notionStatus: getSelectName(p.properties["Delivery Status"]),
      }))
      .filter((o: any) => o.tracking);
  }

  const ofdOrders = await fetchByStatus("Out for Delivery");
  const deliveredOrders = await fetchByStatus("Delivered");
  const rtoOrders = await fetchByStatus("RTO");
  const undeliveredOrders = await fetchByStatus("Undelivered");

  console.log(`\nFound: OFD=${ofdOrders.length}, Delivered=${deliveredOrders.length}, RTO=${rtoOrders.length}, Undelivered=${undeliveredOrders.length}`);

  function snapshot(label: string, orders: any[]) {
    if (orders.length === 0) return;
    console.log(`\n=== Notion snapshot — ${label} (showing up to 5) ===`);
    for (const o of orders.slice(0, 5)) {
      console.log(
        `  ${o.orderNumber}  AWB=${o.tracking}  workerMobile="${o.notionWorkerMobile}"  attempts=${o.notionAttemptCount}  lastUpdated=${o.notionLastUpdated}`
      );
    }
  }
  snapshot("OFD", ofdOrders);
  snapshot("Delivered", deliveredOrders);
  snapshot("RTO", rtoOrders);
  snapshot("Undelivered", undeliveredOrders);

  const samples: { label: string; order: any }[] = [
    ...ofdOrders.slice(0, 2).map((o: any) => ({ label: "OFD", order: o })),
    ...deliveredOrders.slice(0, 3).map((o: any) => ({ label: "Delivered", order: o })),
    ...rtoOrders.slice(0, 2).map((o: any) => ({ label: "RTO", order: o })),
    ...undeliveredOrders.slice(0, 2).map((o: any) => ({ label: "Undelivered", order: o })),
  ];

  console.log(`\n=== DTDC raw response for ${samples.length} sample(s) ===`);

  for (const { label, order: o } of samples) {
    console.log(`\n--- [${label}] ${o.orderNumber} (AWB ${o.tracking}) ---`);
    try {
      const res = await fetch(DTDC_TRACK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackType: "cnno", trackNumber: o.tracking }),
      });
      const json = await res.json();
      if (!json.header) {
        console.log("  (no header in DTDC response — error or invalid AWB)");
        console.log("  raw:", JSON.stringify(json).slice(0, 300));
        continue;
      }
      const header = json.header;
      console.log("  header keys:", Object.keys(header).join(", "));
      console.log("  currentStatusDescription:", header.currentStatusDescription);
      console.log("  workerMobile        :", JSON.stringify(header.workerMobile));
      console.log("  workerMobileNo      :", JSON.stringify(header.workerMobileNo));
      console.log("  workerNumber        :", JSON.stringify(header.workerNumber));
      console.log("  workerContact       :", JSON.stringify(header.workerContact));
      console.log("  workerName          :", JSON.stringify(header.workerName));
      console.log("  fieldExecutiveMobile:", JSON.stringify(header.fieldExecutiveMobile));
      console.log("  attemptCount        :", JSON.stringify(header.attemptCount));
      console.log("  reasonDesc          :", JSON.stringify(header.reasonDesc));
      console.log("  reasonCode          :", JSON.stringify(header.reasonCode));
      // Dump any key that has "mobile", "phone", "worker", or "executive" in its name
      const interesting = Object.keys(header).filter((k) =>
        /mobile|phone|worker|executive|driver|deliv/i.test(k)
      );
      console.log("  pattern-matched keys:", interesting);
      for (const k of interesting) {
        console.log(`    ${k} = ${JSON.stringify(header[k])}`);
      }
    } catch (err) {
      console.log("  ERROR:", err instanceof Error ? err.message : err);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
