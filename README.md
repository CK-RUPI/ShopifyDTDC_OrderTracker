# Urban Naari Order Tracker

Internal dashboard for tracking Urban Naari Shopify orders via DTDC courier. Pulls fulfilled orders from Shopify, fetches live tracking from DTDC, stores everything in Notion, and displays it in a dark-themed Command Center dashboard.

## Features

- **Shopify sync** — pulls all fulfilled orders with tracking numbers
- **DTDC tracking** — fetches live status, milestones, and delivery timeline
- **Notion storage** — all data stored in the cloud, accessible from any device
- **Command Center dashboard** — dark theme with Orders, Influencer, and Analytics tabs
- **Auto-refresh** — polls DTDC every 30 minutes for non-delivered orders
- **COD tracking** — pending amount display and collection toggle per order
- **Delivery emails** — manually triggered delivery confirmation emails via SMTP
- **Influencer shipments** — separate tracking for influencer packages
- **Analytics** — delivery rate, RTO rate, stuck orders, COD collection %, top destinations

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- A Shopify store with a custom app (Client ID + Secret)
- A [Notion integration](https://www.notion.so/my-integrations) with a shared page

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Create `.env.local` in the project root:

```
# Shopify
SHOPIFY_STORE_URL=your-store.myshopify.com
SHOPIFY_CLIENT_ID=your_client_id
SHOPIFY_CLIENT_SECRET=your_client_secret
NEXT_PUBLIC_SHOPIFY_STORE_URL=your-store.myshopify.com

# Notion
NOTION_API_KEY=your_notion_api_key
NOTION_PAGE_ID=your_notion_page_id

# SMTP (for delivery emails)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email
SMTP_PASS=your_password
SMTP_FROM=your_from_address

# Email Test Mode (redirects all emails to your inbox instead of customers)
EMAIL_TEST_MODE=true
EMAIL_TEST_RECIPIENT=your_test_email@example.com
```

### 3. Set up Notion database

Run once to create the database in your Notion page:

```bash
npx tsx src/lib/notion-setup.ts
```

### 4. Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Usage

1. **Sync Orders** — pulls latest fulfilled orders from Shopify into Notion
2. **Refresh Tracking** — fetches DTDC tracking status for all active orders
3. **Click any row** — expands to show full tracking timeline and actions
4. **Search** — filter by order number, customer name, tracking number, or city
5. **Status filter** — show only orders with a specific delivery status
6. **COD toggle** — mark COD orders as collected in the expanded row
7. **Mark RTO** — flag returned orders and add RTO tracking numbers
8. **RTO Received** — confirm RTO product received back at warehouse
9. **Initiate Return** — start a return for delivered orders
10. **Mark Return Complete** — confirm returned product received back
11. **Send Email** — manually send delivery confirmation to customer

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/orders` | GET | Fetch orders with filters |
| `/api/orders/[id]/status` | PATCH | Update delivery status |
| `/api/orders/[id]/cod-status` | PATCH | Toggle COD collection |
| `/api/orders/[id]/rto-tracking` | PATCH | Save RTO tracking number |
| `/api/shopify/sync` | POST | Sync fulfilled orders from Shopify |
| `/api/tracking/refresh` | POST | Refresh DTDC tracking for all active orders |
| `/api/email/delivery` | POST | Send delivery confirmation email |
| `/api/email/preview` | GET | Preview delivery email HTML (pass `?orderId=`) |
| `/api/influencer` | GET/POST | List or create influencer shipments |
| `/api/influencer/refresh` | POST | Refresh DTDC tracking for influencer shipments |

## Key Behaviors

- **Order sorting**: Orders are sorted by Shopify Order ID in descending order to display them in proper sequential order
- **Order filter**: Orders #1025 and below are hidden (initial test orders)
- **Auto-refresh**: Tracking refreshes every 30 minutes
- **Delayed flag**: Orders in transit for 7+ days are highlighted in red
- **Return window**: 48-hour return window tracked after delivery
- **Delivery emails**: Branded template (coral palette matching website), manually triggered, with browser preview at `/api/email/preview?orderId=`
- **Email test mode**: Set `EMAIL_TEST_MODE=true` to redirect all emails to `EMAIL_TEST_RECIPIENT` instead of customers
- **Status mapping**: DTDC statuses map to 12 internal states: Booked, Picked Up, In Transit, At Destination, Out for Delivery, Delivered, Undelivered, Stuck, RTO, RTO Received, Return Initiated, Return Complete
- **RTO flow**: Mark as RTO → enter RTO tracking number → RTO Received (when product arrives back)
- **Return flow**: Delivered → Initiate Return → Mark Return Complete (when product arrives back)

## Tech Stack

- Next.js 16.2.1 (App Router, TypeScript)
- React 19
- Tailwind CSS 4 + shadcn/ui (add components via `npx shadcn@latest add <component>`)
- Notion API (cloud data store)
- DTDC Tracking API
- Nodemailer (SMTP)

## Project Structure

```
src/
  app/
    page.tsx                  # Main dashboard (all tabs, order table, analytics)
    api/                      # API routes
  components/
    InfluencerSection.tsx     # Influencer tab
    TrackingTimeline.tsx      # Tracking event timeline
    StatusBadge.tsx           # Color-coded status badges
    ui/                       # shadcn/ui components
  lib/
    dtdc.ts                   # DTDC API integration & status mapping
    shopify.ts                # Shopify Admin API client
    email.ts                  # SMTP email templates
    data/
      types.ts                # TypeScript interfaces (Order, TrackingEvent, etc.)
      notion.ts               # Notion database CRUD operations
      index.ts                # Data provider export
```

## Shopify App Setup

1. Go to Shopify Admin > Settings > Apps and sales channels > Develop apps
2. Create a custom app
3. Add scopes: `read_orders`, `read_fulfillments`, `read_all_orders`
4. Install the app
5. Use the Client ID and Client Secret in `.env.local`

## Notion Setup

1. Go to https://www.notion.so/my-integrations
2. Create a new integration, copy the API key
3. Create a blank Notion page
4. Share the page with your integration (click Share > invite the integration)
5. Copy the page ID from the URL (the 32-character hex string after the page title)
