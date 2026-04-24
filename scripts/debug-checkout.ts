import "dotenv/config";

const STORE_URL = process.env.SHOPIFY_STORE_URL!;
const CLIENT_ID = process.env.SHOPIFY_CLIENT_ID!;
const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET!;

const CHECKOUT_ID = process.argv[2];
if (!CHECKOUT_ID) {
  console.error("Usage: npx tsx scripts/debug-checkout.ts <checkout-id>");
  process.exit(1);
}

async function getToken(): Promise<string> {
  const res = await fetch(`https://${STORE_URL}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });
  if (!res.ok) {
    throw new Error(`auth failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

type Checkout = {
  id: number;
  email: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  closed_at?: string | null;
  abandoned_checkout_url?: string;
  line_items: { title: string; quantity: number }[];
};

async function main() {
  const token = await getToken();
  const base = `https://${STORE_URL}/admin/api/2024-01`;
  const headers = { "X-Shopify-Access-Token": token };

  console.log(`\n== checking checkout ${CHECKOUT_ID} ==\n`);

  const statuses = ["open", "closed", "any"] as const;
  for (const status of statuses) {
    const res = await fetch(
      `${base}/checkouts.json?status=${status}&limit=250`,
      { headers }
    );
    if (!res.ok) {
      console.log(`status=${status} → HTTP ${res.status}: ${await res.text()}`);
      continue;
    }
    const json = (await res.json()) as { checkouts: Checkout[] };
    const total = json.checkouts?.length ?? 0;
    const match = json.checkouts?.find((c) => String(c.id) === CHECKOUT_ID);
    console.log(
      `status=${status}: returned ${total} checkouts, match=${match ? "FOUND" : "not found"}`
    );
    if (match) {
      console.log("  email          :", match.email);
      console.log("  phone          :", match.phone);
      console.log("  created_at     :", match.created_at);
      console.log("  updated_at     :", match.updated_at);
      console.log("  completed_at   :", match.completed_at);
      console.log("  closed_at      :", match.closed_at ?? "(n/a)");
      console.log("  line_items     :", match.line_items.length);
      console.log("  recovery_url?  :", !!match.abandoned_checkout_url);

      const now = Date.now();
      const updatedAgoMin = Math.round(
        (now - new Date(match.updated_at).getTime()) / 60000
      );
      console.log(`  updated ${updatedAgoMin} min ago`);

      const dashFilterPasses =
        updatedAgoMin >= 60 && updatedAgoMin <= 60 * 24 * 7 && !match.completed_at;
      console.log(
        `  dashboard filter pass? ${dashFilterPasses} ` +
          `(>= 60 min old, <= 7 days old, not completed)`
      );
      if (!dashFilterPasses) {
        const reasons: string[] = [];
        if (updatedAgoMin < 60)
          reasons.push(`updated < 1h ago (${updatedAgoMin} min)`);
        if (updatedAgoMin > 60 * 24 * 7)
          reasons.push(`updated > 7 days ago (${updatedAgoMin} min)`);
        if (match.completed_at)
          reasons.push(`completed at ${match.completed_at}`);
        console.log("  reason(s) filtered:", reasons.join(", "));
      }
    }
  }

  console.log("\n== done ==\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
