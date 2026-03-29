"use client";

import { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Package,
  Users,
  BarChart3,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Phone,
  Mail,
  Check,
  Search,
  RefreshCw,
  ArrowDownUp,
  Truck,
  CircleAlert,
  CircleCheck,
  Clock,
  IndianRupee,
  RotateCcw,
  Plus,
  X,
  Menu,
  Activity,
  MapPin,
  Calendar,
  User,
  AlertTriangle,
  Loader2,
  Bell,
  Settings,
  Hash,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InfluencerSection } from "@/components/InfluencerSection";
import type { Order, DeliveryStatus, TrackingEvent } from "@/lib/data/types";

// --- CONSTANTS ---
const AUTO_REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes
const SHOPIFY_STORE_URL = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL || "";
const DEFAULT_DELAYED_THRESHOLD_DAYS = 7;

type Tab = "orders" | "influencer" | "analytics";

// --- UTILITY FUNCTIONS ---
function isDelayed(order: Order, thresholdDays: number): boolean {
  const excludedStatuses: string[] = [
    "Delivered",
    "RTO",
    "RTO Confirmed",
    "RTO Received",
    "Return Initiated",
    "Return Complete",
  ];
  if (excludedStatuses.includes(order.deliveryStatus) || !order.fulfilledDate) {
    return false;
  }
  const fulfilled = new Date(order.fulfilledDate);
  if (isNaN(fulfilled.getTime())) return false;
  const now = new Date();
  const diffDays =
    (now.getTime() - fulfilled.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays > thresholdDays;
}

function getDaysInTransit(order: Order): number {
  if (!order.fulfilledDate) return 0;
  const fulfilled = new Date(order.fulfilledDate);
  if (isNaN(fulfilled.getTime())) return 0;
  const now = new Date();
  return Math.max(0, Math.floor((now.getTime() - fulfilled.getTime()) / (1000 * 60 * 60 * 24)));
}

function getReturnWindowStatus(
  order: Order
): { isOpen: boolean; label: string } | null {
  if (order.deliveryStatus !== "Delivered") return null;
  const timestamp = order.deliveredTimestamp || order.deliveredDate;
  if (!timestamp) return null;
  const deliveredAt = new Date(timestamp);
  if (isNaN(deliveredAt.getTime())) return null;
  const windowEnd = new Date(deliveredAt.getTime() + 48 * 60 * 60 * 1000);
  const now = new Date();
  if (now < windowEnd) {
    return {
      isOpen: true,
      label: `Return window open (closes ${windowEnd.toLocaleString()})`,
    };
  }
  return { isOpen: false, label: "Return window closed" };
}

function formatTimestamp(ts: string): string {
  if (!ts) return "";
  try {
    const date = new Date(ts.replace(" ", "T"));
    return date.toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return ts;
  }
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  } catch {
    return dateStr;
  }
}

const statuses: Array<{ value: string; label: string }> = [
  { value: "all", label: "All Statuses" },
  { value: "Booked", label: "Booked" },
  { value: "Picked Up", label: "Picked Up" },
  { value: "In Transit", label: "In Transit" },
  { value: "At Destination", label: "At Destination" },
  { value: "Out for Delivery", label: "Out for Delivery" },
  { value: "Delivered", label: "Delivered" },
  { value: "Undelivered", label: "Undelivered" },
  { value: "Stuck", label: "Stuck" },
  { value: "RTO", label: "RTO" },
  { value: "RTO Confirmed", label: "RTO Confirmed" },
  { value: "RTO Received", label: "RTO Received" },
  { value: "Return Initiated", label: "Return Initiated" },
  { value: "Return Complete", label: "Return Complete" },
];

// =============================================================================
// SIDEBAR COMPONENT
// =============================================================================
interface SidebarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems: Array<{
    id: Tab;
    label: string;
    icon: React.ReactNode;
  }> = [
    {
      id: "orders",
      label: "Orders",
      icon: <Package className="h-5 w-5" />,
    },
    {
      id: "influencer",
      label: "Influencer",
      icon: <Users className="h-5 w-5" />,
    },
    {
      id: "analytics",
      label: "Analytics",
      icon: <BarChart3 className="h-5 w-5" />,
    },
  ];

  const handleTabChange = (tab: Tab) => {
    onTabChange(tab);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        className="fixed top-4 left-4 z-50 lg:hidden flex items-center justify-center w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle navigation"
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-40 h-screen bg-zinc-950 border-r border-zinc-800/50
          flex flex-col transition-all duration-300 ease-in-out
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0 lg:static lg:z-auto
          ${collapsed ? "lg:w-[68px]" : "lg:w-[220px]"}
          w-[220px]
        `}
      >
        {/* Logo / Brand */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-zinc-800/50 shrink-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 shrink-0">
            <Truck className="h-4 w-4 text-white" />
          </div>
          <span
            className={`font-semibold text-zinc-100 text-sm whitespace-nowrap overflow-hidden transition-all duration-300 ${
              collapsed ? "lg:w-0 lg:opacity-0" : "lg:w-auto lg:opacity-100"
            }`}
          >
            Urban Naari
          </span>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                  transition-all duration-150 group relative
                  ${
                    isActive
                      ? "bg-blue-600/15 text-blue-400"
                      : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
                  }
                `}
                title={collapsed ? item.label : undefined}
              >
                {/* Active indicator bar */}
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-blue-500 rounded-r" />
                )}
                <span className={`shrink-0 ${isActive ? "text-blue-400" : "text-zinc-500 group-hover:text-zinc-300"}`}>
                  {item.icon}
                </span>
                <span
                  className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${
                    collapsed ? "lg:w-0 lg:opacity-0" : "lg:w-auto lg:opacity-100"
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Collapse toggle (desktop only) */}
        <div className="hidden lg:flex items-center justify-center px-3 py-3 border-t border-zinc-800/50">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60 transition-colors"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <ArrowDownUp className="h-3.5 w-3.5 rotate-90 shrink-0" />
            <span
              className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${
                collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
              }`}
            >
              Collapse
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}

// =============================================================================
// STATS CARDS (DARK)
// =============================================================================
interface StatsCardsDarkProps {
  orders: Order[];
  delayThresholdDays: number;
  onDelayedClick?: () => void;
}

function StatsCardsDark({ orders, delayThresholdDays, onDelayedClick }: StatsCardsDarkProps) {
  const total = orders.length;
  const delivered = orders.filter(
    (o) => o.deliveryStatus === "Delivered"
  ).length;
  const inTransit = orders.filter(
    (o) =>
      o.deliveryStatus === "In Transit" ||
      o.deliveryStatus === "At Destination" ||
      o.deliveryStatus === "Out for Delivery"
  ).length;
  const stuck = orders.filter((o) => o.deliveryStatus === "Stuck").length;
  const booked = orders.filter(
    (o) => o.deliveryStatus === "Booked" || o.deliveryStatus === "Picked Up"
  ).length;
  const rto = orders.filter(
    (o) => o.deliveryStatus === "RTO" || o.deliveryStatus === "RTO Confirmed" || o.deliveryStatus === "RTO Received"
  ).length;
  const returns = orders.filter(
    (o) =>
      o.deliveryStatus === "Return Initiated" ||
      o.deliveryStatus === "Return Complete"
  ).length;
  const delayed = orders.filter((o) => isDelayed(o, delayThresholdDays)).length;
  const pendingCodAmount = orders
    .filter(
      (o) =>
        o.paymentMethod === "COD" &&
        o.codCollectionStatus !== "Collected" &&
        o.deliveryStatus === "Delivered"
    )
    .reduce((sum, o) => sum + (o.orderTotal || 0), 0);

  const stats: Array<{
    title: string;
    value: string | number;
    icon: React.ReactNode;
    accentColor: string;
    glowColor: string;
  }> = [
    {
      title: "Total Orders",
      value: total,
      icon: <Package className="h-5 w-5" />,
      accentColor: "text-zinc-100",
      glowColor: "shadow-zinc-500/5",
    },
    {
      title: "In Transit",
      value: inTransit,
      icon: <Truck className="h-5 w-5" />,
      accentColor: "text-blue-400",
      glowColor: "shadow-blue-500/10",
    },
    {
      title: "Delivered",
      value: delivered,
      icon: <CircleCheck className="h-5 w-5" />,
      accentColor: "text-emerald-400",
      glowColor: "shadow-emerald-500/10",
    },
    {
      title: "Booked",
      value: booked,
      icon: <Clock className="h-5 w-5" />,
      accentColor: "text-amber-400",
      glowColor: "shadow-amber-500/10",
    },
    {
      title: "Stuck",
      value: stuck,
      icon: <CircleAlert className="h-5 w-5" />,
      accentColor: "text-red-400",
      glowColor: "shadow-red-500/10",
    },
    {
      title: "Delayed",
      value: delayed,
      icon: <AlertTriangle className="h-5 w-5" />,
      accentColor: "text-red-400",
      glowColor: "shadow-red-500/10",
    },
    {
      title: "RTO",
      value: rto,
      icon: <RotateCcw className="h-5 w-5" />,
      accentColor: "text-purple-400",
      glowColor: "shadow-purple-500/10",
    },
    {
      title: "Returns",
      value: returns,
      icon: <RotateCcw className="h-5 w-5" />,
      accentColor: "text-rose-400",
      glowColor: "shadow-rose-500/10",
    },
    {
      title: "Pending COD",
      value:
        pendingCodAmount > 0
          ? `\u20B9${pendingCodAmount.toLocaleString("en-IN")}`
          : "\u20B90",
      icon: <IndianRupee className="h-5 w-5" />,
      accentColor: "text-orange-400",
      glowColor: "shadow-orange-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-9 gap-2">
      {stats.map((stat) => (
        <div
          key={stat.title}
          onClick={stat.title === "Delayed" ? onDelayedClick : undefined}
          className={`
            relative rounded-lg bg-zinc-900 border border-zinc-800/60 px-3 py-2.5
            shadow-lg ${stat.glowColor}
            hover:border-zinc-700/80 transition-all duration-200 group
            ${stat.title === "Delayed" ? "cursor-pointer" : ""}
          `}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider leading-tight">
              {stat.title}
            </span>
            <span className={`${stat.accentColor} opacity-40 group-hover:opacity-70 transition-opacity [&>svg]:h-4 [&>svg]:w-4`}>
              {stat.icon}
            </span>
          </div>
          <div className={`text-xl lg:text-2xl font-bold ${stat.accentColor} tracking-tight`}>
            {stat.value}
          </div>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// SEARCH FILTER (COMMAND PALETTE STYLE)
// =============================================================================
interface SearchFilterDarkProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string | null) => void;
  showDelivered: boolean;
  onShowDeliveredChange: (value: boolean) => void;
}

function SearchFilterDark({
  search,
  onSearchChange,
  statusFilter,
  onStatusChange,
  showDelivered,
  onShowDeliveredChange,
}: SearchFilterDarkProps) {
  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800/60 p-4">
      <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center">
        {/* Command palette style search */}
        <div className="relative flex-1 w-full lg:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            placeholder="Search orders, customers, tracking..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-16 h-9 bg-zinc-800/60 border-zinc-700/50 text-zinc-200 placeholder:text-zinc-500 focus-visible:border-blue-500/50 focus-visible:ring-blue-500/20"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-0.5 rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-[10px] font-mono text-zinc-500">
            Ctrl K
          </kbd>
        </div>

        {/* Status filter */}
        <Select value={statusFilter} onValueChange={onStatusChange}>
          <SelectTrigger className="w-full sm:w-44 h-9 bg-zinc-800/60 border-zinc-700/50 text-zinc-300 [&_svg]:text-zinc-500">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-700/50 text-zinc-300">
            {statuses.map((s) => (
              <SelectItem
                key={s.value}
                value={s.value}
                className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100"
              >
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Show delivered toggle */}
        <div className="flex items-center gap-2.5 shrink-0">
          <Switch
            id="show-delivered-dark"
            checked={showDelivered}
            onCheckedChange={onShowDeliveredChange}
            className="data-checked:bg-blue-600 data-unchecked:bg-zinc-700"
          />
          <label
            htmlFor="show-delivered-dark"
            className="text-sm text-zinc-400 cursor-pointer whitespace-nowrap select-none"
          >
            Show delivered
          </label>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// STATUS BADGE (DARK)
// =============================================================================
const darkStatusConfig: Record<
  DeliveryStatus,
  { className: string; label: string }
> = {
  Booked: {
    className: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    label: "Booked",
  },
  "Picked Up": {
    className: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    label: "Picked Up",
  },
  "In Transit": {
    className: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    label: "In Transit",
  },
  "At Destination": {
    className: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    label: "At Destination",
  },
  "Out for Delivery": {
    className: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    label: "Out for Delivery",
  },
  Delivered: {
    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    label: "Delivered",
  },
  Undelivered: {
    className: "bg-red-500/10 text-red-400 border-red-500/20",
    label: "Undelivered",
  },
  Stuck: {
    className: "bg-red-500/10 text-red-400 border-red-500/20",
    label: "Stuck",
  },
  RTO: {
    className: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    label: "RTO",
  },
  "RTO Confirmed": {
    className: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    label: "RTO Confirmed",
  },
  "RTO Received": {
    className: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    label: "RTO Received",
  },
  "Return Initiated": {
    className: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    label: "Return Initiated",
  },
  "Return Complete": {
    className: "bg-teal-500/10 text-teal-400 border-teal-500/20",
    label: "Return Complete",
  },
};

function StatusBadgeDark({ status }: { status: DeliveryStatus }) {
  const config = darkStatusConfig[status] || darkStatusConfig["Booked"];
  return (
    <Badge
      variant="outline"
      className={`${config.className} text-[11px] font-medium`}
    >
      {config.label}
    </Badge>
  );
}

// =============================================================================
// PAYMENT BADGE (DARK)
// =============================================================================
function PaymentBadgeDark({ method }: { method: "COD" | "Prepaid" }) {
  const config =
    method === "COD"
      ? {
          className:
            "bg-orange-500/10 text-orange-400 border-orange-500/20",
          label: "COD",
        }
      : {
          className:
            "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
          label: "Prepaid",
        };

  return (
    <Badge
      variant="outline"
      className={`${config.className} text-[10px] px-1.5 py-0`}
    >
      {config.label}
    </Badge>
  );
}

// =============================================================================
// TRACKING TIMELINE (DARK)
// =============================================================================
interface TrackingTimelineDarkProps {
  events: TrackingEvent[];
}

function TrackingTimelineDark({ events }: TrackingTimelineDarkProps) {
  if (!events || events.length === 0) {
    return (
      <p className="text-sm text-zinc-500 py-4">
        No tracking events yet. Click &quot;Refresh Tracking&quot; to fetch
        updates.
      </p>
    );
  }

  const sortedEvents = [...events].reverse();

  return (
    <div className="py-4 px-2">
      <div className="relative">
        {sortedEvents.map((event, index) => (
          <div key={index} className="flex gap-4 pb-4 last:pb-0">
            {/* Timeline dot and line */}
            <div className="flex flex-col items-center">
              <div
                className={`w-2.5 h-2.5 rounded-full ring-2 ${
                  index === 0
                    ? "bg-blue-500 ring-blue-500/30"
                    : "bg-zinc-700 ring-zinc-700/30"
                }`}
              />
              {index < sortedEvents.length - 1 && (
                <div className="w-px h-full bg-zinc-800 mt-1" />
              )}
            </div>

            {/* Event content */}
            <div className="flex-1 -mt-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm text-zinc-200">
                  {event.status}
                </span>
                <span className="text-xs text-zinc-500">
                  {event.location}
                  {event.branch ? ` - ${event.branch}` : ""}
                </span>
              </div>
              {event.description && (
                <p className="text-xs text-zinc-500 mt-0.5">
                  {event.description}
                </p>
              )}
              <p className="text-xs text-zinc-600 mt-0.5">
                {formatTimestamp(event.timestamp)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// ORDER TABLE (DARK)
// =============================================================================
interface OrderTableDarkProps {
  orders: Order[];
  onOrderUpdated?: () => void;
  delayThresholdDays: number;
}

function OrderTableDark({ orders, onOrderUpdated, delayThresholdDays }: OrderTableDarkProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rtoInput, setRtoInput] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  if (orders.length === 0) {
    return (
      <div className="text-center py-16 text-zinc-500">
        <Package className="h-12 w-12 mx-auto mb-3 text-zinc-700" />
        <p className="text-lg text-zinc-400">No orders found</p>
        <p className="text-sm mt-1 text-zinc-600">
          Click &quot;Sync Orders&quot; to pull orders from Shopify
        </p>
      </div>
    );
  }

  const handleCodToggle = async (orderId: string, currentStatus: string) => {
    setActionLoading(`cod-${orderId}`);
    try {
      const newStatus =
        currentStatus === "Collected" ? "Pending" : "Collected";
      await fetch(`/api/orders/${orderId}/cod-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codCollectionStatus: newStatus }),
      });
      onOrderUpdated?.();
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkRtoConfirmed = async (orderId: string) => {
    setActionLoading(`rto-confirmed-${orderId}`);
    try {
      await fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryStatus: "RTO Confirmed" }),
      });
      onOrderUpdated?.();
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkRtoReceived = async (orderId: string) => {
    setActionLoading(`rto-received-${orderId}`);
    try {
      await fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryStatus: "RTO Received" }),
      });
      onOrderUpdated?.();
    } finally {
      setActionLoading(null);
    }
  };

  const handleInitiateReturn = async (orderId: string) => {
    setActionLoading(`return-init-${orderId}`);
    try {
      await fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryStatus: "Return Initiated" }),
      });
      onOrderUpdated?.();
    } finally {
      setActionLoading(null);
    }
  };

  const handleReturnComplete = async (orderId: string) => {
    setActionLoading(`return-complete-${orderId}`);
    try {
      await fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryStatus: "Return Complete" }),
      });
      onOrderUpdated?.();
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveRtoTracking = async (orderId: string) => {
    const trackingNum = rtoInput[orderId];
    if (!trackingNum) return;
    setActionLoading(`rto-save-${orderId}`);
    try {
      await fetch(`/api/orders/${orderId}/rto-tracking`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rtoTrackingNumber: trackingNum }),
      });
      onOrderUpdated?.();
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendEmail = async (orderId: string) => {
    setActionLoading(`email-${orderId}`);
    try {
      const res = await fetch("/api/email/delivery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      if (!data.success) {
        alert(`Email failed: ${data.error}`);
        return;
      }
      alert("Delivery email sent!");
      onOrderUpdated?.();
    } finally {
      setActionLoading(null);
    }
  };

  const handleRefreshOrder = async (orderId: string) => {
    setActionLoading(`refresh-${orderId}`);
    try {
      const res = await fetch(`/api/orders/${orderId}/refresh`, {
        method: "POST",
      });
      if (!res.ok) {
        const text = await res.text();
        let errorMsg = `Server error (${res.status})`;
        try {
          const json = JSON.parse(text);
          errorMsg = json.error || errorMsg;
        } catch {}
        alert(`Refresh failed: ${errorMsg}`);
        return;
      }
      const data = await res.json();
      if (!data.success) {
        alert(`Refresh failed: ${data.error}`);
        return;
      }
      onOrderUpdated?.();
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800/60 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-zinc-800/60 hover:bg-transparent">
            <TableHead className="w-[40px] text-zinc-500"></TableHead>
            <TableHead className="w-[110px] text-zinc-500 text-xs uppercase tracking-wider font-medium">
              Order
            </TableHead>
            <TableHead className="text-zinc-500 text-xs uppercase tracking-wider font-medium">
              Customer
            </TableHead>
            <TableHead className="hidden md:table-cell text-zinc-500 text-xs uppercase tracking-wider font-medium">
              Destination
            </TableHead>
            <TableHead className="text-zinc-500 text-xs uppercase tracking-wider font-medium">
              Status
            </TableHead>
            <TableHead className="hidden md:table-cell text-zinc-500 text-xs uppercase tracking-wider font-medium">
              Initiated
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => {
            const delayed = isDelayed(order, delayThresholdDays);
            const isExpanded = expandedId === order.id;

            return (
              <Fragment key={order.id}>
                <TableRow
                  className={`
                    border-b border-zinc-800/40 hover:bg-zinc-800/40 transition-colors cursor-pointer
                    ${delayed ? "bg-red-950/20 border-l-2 border-l-red-500/60" : ""}
                    ${isExpanded ? "bg-zinc-800/30" : ""}
                  `}
                  onClick={() =>
                    setExpandedId(isExpanded ? null : order.id)
                  }
                >
                  <TableCell className="px-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedId(isExpanded ? null : order.id);
                      }}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </TableCell>
                  <TableCell className="font-medium">
                    {SHOPIFY_STORE_URL ? (
                      <a
                        href={`https://${SHOPIFY_STORE_URL}/admin/orders/${order.shopifyOrderId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 hover:underline inline-flex items-center gap-1 text-sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {order.orderNumber}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-zinc-200 text-sm">
                        {order.orderNumber}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-sm text-zinc-200">
                          {order.customerName}
                        </span>
                        <PaymentBadgeDark method={order.paymentMethod} />
                      </div>
                      {order.customerPhone && (
                        <a
                          href={`tel:${order.customerPhone}`}
                          className="text-xs text-blue-400/70 hover:text-blue-400 hover:underline inline-flex items-center gap-0.5 mt-0.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Phone className="h-3 w-3" />
                          {order.customerPhone}
                        </a>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-zinc-400">
                    {order.destinationCity || "-"}
                  </TableCell>
                  <TableCell>
                    <StatusBadgeDark status={order.deliveryStatus} />
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-zinc-400">
                    {formatDate(order.fulfilledDate) || "-"}
                  </TableCell>
                </TableRow>

                {/* Expanded detail row */}
                {isExpanded && (
                  <TableRow
                    key={`${order.id}-details`}
                    className="hover:bg-transparent"
                  >
                    <TableCell
                      colSpan={6}
                      className="bg-zinc-900/80 border-b border-zinc-800/40 p-0"
                    >
                      <div className="px-6 py-5 border-l-2 border-l-blue-500/30">
                        {/* Info grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                          <div className="flex items-center gap-2">
                            <Hash className="h-3.5 w-3.5 text-zinc-600" />
                            <div>
                              <span className="text-zinc-500 text-xs block">
                                Tracking #
                              </span>
                              <span className="font-medium text-zinc-300">
                                {order.trackingNumber || "-"}
                              </span>
                            </div>
                          </div>
                          {order.deliveredTimestamp && (
                            <div className="flex items-center gap-2">
                              <Calendar className="h-3.5 w-3.5 text-zinc-600" />
                              <div>
                                <span className="text-zinc-500 text-xs block">
                                  Delivered at
                                </span>
                                <span className="font-medium text-zinc-300">
                                  {order.deliveredTimestamp}
                                </span>
                              </div>
                            </div>
                          )}
                          {order.paymentMethod === "COD" && (
                            <div className="flex items-center gap-2">
                              <IndianRupee className="h-3.5 w-3.5 text-zinc-600" />
                              <div>
                                <span className="text-zinc-500 text-xs block">
                                  Order Total
                                </span>
                                <span className="font-medium text-zinc-300">
                                  {"\u20B9"}
                                  {order.orderTotal?.toLocaleString("en-IN") ||
                                    "0"}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Shipping address */}
                        {order.shippingAddress && (
                          <p className="text-xs text-zinc-500 mb-4 flex items-start gap-1.5">
                            <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                            {order.shippingAddress}
                          </p>
                        )}

                        {/* Delayed warning */}
                        {delayed && (
                          <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            <span>
                              This order has been in transit for more than{" "}
                              {delayThresholdDays} days ({getDaysInTransit(order)} days)
                            </span>
                          </div>
                        )}

                        {/* Return window */}
                        {(() => {
                          const rw = getReturnWindowStatus(order);
                          if (!rw) return null;
                          return (
                            <div
                              className={`text-sm mb-4 px-3 py-2 rounded-lg inline-flex items-center gap-2 ${
                                rw.isOpen
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                  : "bg-zinc-800 text-zinc-500 border border-zinc-700/50"
                              }`}
                            >
                              {rw.isOpen ? (
                                <Clock className="h-3.5 w-3.5" />
                              ) : (
                                <Check className="h-3.5 w-3.5" />
                              )}
                              {rw.label}
                            </div>
                          );
                        })()}

                        {/* Actions row */}
                        <div className="flex flex-wrap gap-2 mt-4 mb-4">
                          {/* Refresh this order */}
                          {order.trackingNumber && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-zinc-700/50 text-zinc-300 hover:bg-zinc-800 bg-transparent"
                              disabled={
                                actionLoading === `refresh-${order.id}`
                              }
                              onClick={() => handleRefreshOrder(order.id)}
                            >
                              {actionLoading === `refresh-${order.id}` ? (
                                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                              ) : (
                                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                              )}
                              Refresh Tracking
                            </Button>
                          )}

                          {/* COD collection toggle */}
                          {order.paymentMethod === "COD" && (
                            <Button
                              size="sm"
                              variant={
                                order.codCollectionStatus === "Collected"
                                  ? "outline"
                                  : "default"
                              }
                              disabled={
                                actionLoading === `cod-${order.id}`
                              }
                              onClick={() =>
                                handleCodToggle(
                                  order.id,
                                  order.codCollectionStatus
                                )
                              }
                              className={
                                order.codCollectionStatus === "Collected"
                                  ? "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 bg-transparent"
                                  : "bg-blue-600 hover:bg-blue-700 text-white"
                              }
                            >
                              {actionLoading === `cod-${order.id}` ? (
                                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                              ) : (
                                <IndianRupee className="h-3.5 w-3.5 mr-1.5" />
                              )}
                              {order.codCollectionStatus === "Collected"
                                ? "COD Collected"
                                : "Mark COD Collected"}
                              {order.codCollectionStatus === "Collected" && (
                                <Check className="h-3.5 w-3.5 ml-1" />
                              )}
                            </Button>
                          )}

                          {/* RTO Confirmed */}
                          {order.deliveryStatus === "RTO" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10 bg-transparent"
                              disabled={
                                actionLoading === `rto-confirmed-${order.id}`
                              }
                              onClick={() =>
                                handleMarkRtoConfirmed(order.id)
                              }
                            >
                              {actionLoading ===
                              `rto-confirmed-${order.id}` ? (
                                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                              ) : (
                                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                              )}
                              RTO Confirmed
                            </Button>
                          )}

                          {/* RTO Received */}
                          {order.deliveryStatus === "RTO Confirmed" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10 bg-transparent"
                              disabled={
                                actionLoading === `rto-received-${order.id}`
                              }
                              onClick={() =>
                                handleMarkRtoReceived(order.id)
                              }
                            >
                              {actionLoading ===
                              `rto-received-${order.id}` ? (
                                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                              ) : (
                                <Package className="h-3.5 w-3.5 mr-1.5" />
                              )}
                              RTO Received
                            </Button>
                          )}

                          {/* Initiate Return */}
                          {order.deliveryStatus === "Delivered" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10 bg-transparent"
                              disabled={
                                actionLoading ===
                                `return-init-${order.id}`
                              }
                              onClick={() =>
                                handleInitiateReturn(order.id)
                              }
                            >
                              {actionLoading ===
                              `return-init-${order.id}` ? (
                                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                              ) : (
                                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                              )}
                              Initiate Return
                            </Button>
                          )}

                          {/* Mark Return Complete */}
                          {order.deliveryStatus === "Return Initiated" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-teal-500/30 text-teal-400 hover:bg-teal-500/10 bg-transparent"
                              disabled={
                                actionLoading ===
                                `return-complete-${order.id}`
                              }
                              onClick={() =>
                                handleReturnComplete(order.id)
                              }
                            >
                              {actionLoading ===
                              `return-complete-${order.id}` ? (
                                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                              ) : (
                                <Package className="h-3.5 w-3.5 mr-1.5" />
                              )}
                              Mark Return Complete
                            </Button>
                          )}

                          {/* Send delivery email */}
                          {order.deliveryStatus === "Delivered" &&
                            !order.deliveryEmailSent && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-zinc-700/50 text-zinc-300 hover:bg-zinc-800 bg-transparent"
                                disabled={
                                  actionLoading === `email-${order.id}`
                                }
                                onClick={() =>
                                  handleSendEmail(order.id)
                                }
                              >
                                {actionLoading === `email-${order.id}` ? (
                                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                ) : (
                                  <Mail className="h-3.5 w-3.5 mr-1.5" />
                                )}
                                Send Delivery Email
                              </Button>
                            )}
                          {order.deliveryEmailSent && (
                            <span className="text-xs text-emerald-500 flex items-center gap-1.5 px-2 py-1">
                              <Check className="h-3.5 w-3.5" />
                              Delivery email sent
                            </span>
                          )}
                        </div>

                        {/* RTO tracking input */}
                        {order.deliveryStatus === "RTO" && (
                          <div className="flex gap-2 items-center mb-4">
                            {order.rtoTrackingNumber ? (
                              <div className="text-sm flex items-center gap-2">
                                <span className="text-zinc-500">
                                  RTO Tracking:
                                </span>
                                <code className="bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded text-xs border border-zinc-700/50 font-mono">
                                  {order.rtoTrackingNumber}
                                </code>
                              </div>
                            ) : (
                              <>
                                <Input
                                  placeholder="Enter RTO tracking number"
                                  className="w-64 h-8 text-sm bg-zinc-800/60 border-zinc-700/50 text-zinc-200 placeholder:text-zinc-600"
                                  value={rtoInput[order.id] || ""}
                                  onChange={(e) =>
                                    setRtoInput((prev) => ({
                                      ...prev,
                                      [order.id]: e.target.value,
                                    }))
                                  }
                                />
                                <Button
                                  size="sm"
                                  disabled={
                                    !rtoInput[order.id] ||
                                    actionLoading ===
                                      `rto-save-${order.id}`
                                  }
                                  className="bg-blue-600 hover:bg-blue-700 text-white"
                                  onClick={() =>
                                    handleSaveRtoTracking(order.id)
                                  }
                                >
                                  {actionLoading ===
                                  `rto-save-${order.id}` ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    "Save"
                                  )}
                                </Button>
                              </>
                            )}
                          </div>
                        )}

                        {/* Tracking timeline */}
                        <div className="border-t border-zinc-800/60 pt-4 mt-2">
                          <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Activity className="h-3.5 w-3.5" />
                            Tracking Timeline
                          </h4>
                          <TrackingTimelineDark
                            events={order.trackingTimeline}
                          />
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// =============================================================================
// ANALYTICS PLACEHOLDER (DARK)
// =============================================================================
function AnalyticsSectionDark({ orders }: { orders: Order[] }) {
  const total = orders.length;
  const delivered = orders.filter(
    (o) => o.deliveryStatus === "Delivered"
  ).length;
  const deliveryRate = total > 0 ? ((delivered / total) * 100).toFixed(1) : "0";
  const stuck = orders.filter((o) => o.deliveryStatus === "Stuck").length;
  const rto = orders.filter(
    (o) => o.deliveryStatus === "RTO" || o.deliveryStatus === "RTO Confirmed" || o.deliveryStatus === "RTO Received"
  ).length;
  const rtoRate = total > 0 ? ((rto / total) * 100).toFixed(1) : "0";

  const codOrders = orders.filter((o) => o.paymentMethod === "COD");
  const prepaidOrders = orders.filter((o) => o.paymentMethod === "Prepaid");
  const codCollected = codOrders.filter(
    (o) => o.codCollectionStatus === "Collected"
  ).length;

  // Group by destination city
  const cityMap: Record<string, number> = {};
  orders.forEach((o) => {
    const city = o.destinationCity || "Unknown";
    cityMap[city] = (cityMap[city] || 0) + 1;
  });
  const topCities = Object.entries(cityMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Key metrics row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl bg-zinc-900 border border-zinc-800/60 p-5">
          <span className="text-xs text-zinc-500 uppercase tracking-wider">
            Delivery Rate
          </span>
          <div className="text-3xl font-bold text-emerald-400 mt-2">
            {deliveryRate}%
          </div>
          <div className="text-xs text-zinc-600 mt-1">
            {delivered} of {total} orders
          </div>
        </div>
        <div className="rounded-xl bg-zinc-900 border border-zinc-800/60 p-5">
          <span className="text-xs text-zinc-500 uppercase tracking-wider">
            RTO Rate
          </span>
          <div className="text-3xl font-bold text-purple-400 mt-2">
            {rtoRate}%
          </div>
          <div className="text-xs text-zinc-600 mt-1">
            {rto} returns to origin
          </div>
        </div>
        <div className="rounded-xl bg-zinc-900 border border-zinc-800/60 p-5">
          <span className="text-xs text-zinc-500 uppercase tracking-wider">
            Stuck Orders
          </span>
          <div className="text-3xl font-bold text-red-400 mt-2">{stuck}</div>
          <div className="text-xs text-zinc-600 mt-1">Require attention</div>
        </div>
        <div className="rounded-xl bg-zinc-900 border border-zinc-800/60 p-5">
          <span className="text-xs text-zinc-500 uppercase tracking-wider">
            COD Collection
          </span>
          <div className="text-3xl font-bold text-orange-400 mt-2">
            {codOrders.length > 0
              ? ((codCollected / codOrders.length) * 100).toFixed(0)
              : 0}
            %
          </div>
          <div className="text-xs text-zinc-600 mt-1">
            {codCollected} of {codOrders.length} collected
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Payment method breakdown */}
        <div className="rounded-xl bg-zinc-900 border border-zinc-800/60 p-5">
          <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-4">
            Payment Methods
          </h3>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-zinc-400">COD</span>
                <span className="text-zinc-300 font-medium">
                  {codOrders.length}
                </span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-500/60 rounded-full transition-all duration-500"
                  style={{
                    width: total > 0 ? `${(codOrders.length / total) * 100}%` : "0%",
                  }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-zinc-400">Prepaid</span>
                <span className="text-zinc-300 font-medium">
                  {prepaidOrders.length}
                </span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500/60 rounded-full transition-all duration-500"
                  style={{
                    width:
                      total > 0
                        ? `${(prepaidOrders.length / total) * 100}%`
                        : "0%",
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Top destinations */}
        <div className="rounded-xl bg-zinc-900 border border-zinc-800/60 p-5">
          <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-4">
            Top Destinations
          </h3>
          {topCities.length > 0 ? (
            <div className="space-y-2.5">
              {topCities.map(([city, count], index) => (
                <div
                  key={city}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-600 w-4 text-right font-mono">
                      {index + 1}
                    </span>
                    <span className="text-zinc-300">{city}</span>
                  </div>
                  <span className="text-zinc-500 font-mono text-xs">
                    {count} order{count !== 1 ? "s" : ""}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-600">No data available</p>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN DASHBOARD
// =============================================================================
export default function DashboardCommandCenter() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showDelivered, setShowDelivered] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>("");
  const [activeTab, setActiveTab] = useState<Tab>("orders");
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [delayThresholdDays, setDelayThresholdDays] = useState(DEFAULT_DELAYED_THRESHOLD_DAYS);
  const [thresholdInput, setThresholdInput] = useState("");
  const [showDelayedOnly, setShowDelayedOnly] = useState(false);
  const [delayBannerOpen, setDelayBannerOpen] = useState(true);
  const [delayDialogOpen, setDelayDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);

  // Load threshold from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("delayThresholdDays");
    if (saved) {
      const num = parseInt(saved, 10);
      if (!isNaN(num) && num > 0) {
        setDelayThresholdDays(num);
      }
    }
  }, []);

  const delayedOrders = useMemo(
    () => orders.filter((o) => isDelayed(o, delayThresholdDays)),
    [orders, delayThresholdDays]
  );

  const handleSaveThreshold = () => {
    const num = parseInt(thresholdInput, 10);
    if (!isNaN(num) && num > 0) {
      setDelayThresholdDays(num);
      localStorage.setItem("delayThresholdDays", String(num));
      setSettingsDialogOpen(false);
    }
  };

  const fetchOrders = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "all")
        params.set("status", statusFilter);
      if (search) params.set("search", search);
      if (!showDelivered) params.set("hideDelivered", "true");

      const res = await fetch(`/api/orders?${params}`);
      const data = await res.json();
      if (data.success) {
        setOrders(data.orders);
      }
    } catch (err) {
      console.error("Failed to fetch orders:", err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, showDelivered]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Auto-refresh tracking every 30 minutes
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        await fetch("/api/tracking/refresh", { method: "POST" });
        setLastRefreshed(new Date().toLocaleTimeString());
        fetchOrders();
      } catch {
        // silent fail for auto-refresh
      }
    }, AUTO_REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const handleSync = async () => {
    setSyncing(true);
    setMessage(null);
    try {
      const res = await fetch("/api/shopify/sync", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setMessage({
          type: "success",
          text: `Synced ${data.synced} orders from Shopify (${data.skipped} skipped - no tracking)`,
        });
        fetchOrders();
      } else {
        setMessage({ type: "error", text: data.error || "Sync failed" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to connect to Shopify" });
    } finally {
      setSyncing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setMessage(null);
    try {
      const res = await fetch("/api/tracking/refresh", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setMessage({
          type: "success",
          text: `Refreshed ${data.refreshed} orders${data.errors ? ` (${data.errors} errors)` : ""}`,
        });
        setLastRefreshed(new Date().toLocaleTimeString());
        fetchOrders();
      } else {
        setMessage({ type: "error", text: data.error || "Refresh failed" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to refresh tracking" });
    } finally {
      setRefreshing(false);
    }
  };

  // Auto-dismiss message after 8 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100">
      {/* Sidebar */}
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main content area */}
      <main className="flex-1 overflow-y-auto">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/50">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 lg:px-6 py-4">
            <div className="pl-12 lg:pl-0">
              <h1 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
                {activeTab === "orders" && (
                  <>
                    <Package className="h-5 w-5 text-blue-400" />
                    Order Command Center
                  </>
                )}
                {activeTab === "influencer" && (
                  <>
                    <Users className="h-5 w-5 text-blue-400" />
                    Influencer Tracking
                  </>
                )}
                {activeTab === "analytics" && (
                  <>
                    <BarChart3 className="h-5 w-5 text-blue-400" />
                    Analytics Overview
                  </>
                )}
              </h1>
              <p className="text-xs text-zinc-500 mt-0.5">
                Shopify + DTDC tracking
                {lastRefreshed && (
                  <span className="text-zinc-600">
                    {" "}
                    | Last refreshed: {lastRefreshed}
                  </span>
                )}
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pl-12 lg:pl-0 items-center">
              {/* Notification bell (orders tab only) */}
              {activeTab === "orders" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="relative h-9 w-9 p-0 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                  onClick={() => setDelayDialogOpen(true)}
                >
                  <Bell className="h-4 w-4" />
                  {delayedOrders.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center font-bold px-1">
                      {delayedOrders.length}
                    </span>
                  )}
                </Button>
              )}

              {/* Settings (orders tab only) */}
              {activeTab === "orders" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 p-0 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                  onClick={() => {
                    setThresholdInput(String(delayThresholdDays));
                    setSettingsDialogOpen(true);
                  }}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={handleSync}
                disabled={syncing}
                className="border-zinc-700/50 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 bg-transparent"
              >
                {syncing ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <ArrowDownUp className="h-3.5 w-3.5 mr-1.5" />
                )}
                {syncing ? "Syncing..." : "Sync Orders"}
              </Button>
              <Button
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {refreshing ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                )}
                {refreshing ? "Refreshing..." : "Refresh Tracking"}
              </Button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="px-4 lg:px-6 py-6 space-y-6">
          {/* Message toast */}
          {message && (
            <div
              className={`flex items-center gap-2 p-3 rounded-lg text-sm border ${
                message.type === "success"
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-red-500/10 text-red-400 border-red-500/20"
              }`}
            >
              {message.type === "success" ? (
                <CircleCheck className="h-4 w-4 shrink-0" />
              ) : (
                <CircleAlert className="h-4 w-4 shrink-0" />
              )}
              <span className="flex-1">{message.text}</span>
              <button
                onClick={() => setMessage(null)}
                className="text-zinc-500 hover:text-zinc-300 shrink-0"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Orders tab */}
          {activeTab === "orders" && (
            <>
              {/* Stats */}
              <StatsCardsDark
                orders={orders}
                delayThresholdDays={delayThresholdDays}
                onDelayedClick={() => setShowDelayedOnly((prev) => !prev)}
              />

              {/* Delay alert banner */}
              {delayedOrders.length > 0 && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setDelayBannerOpen((prev) => !prev)}
                  >
                    <div className="flex items-center gap-2">
                      {delayBannerOpen ? (
                        <ChevronDown className="h-4 w-4 text-red-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-red-400" />
                      )}
                      <AlertTriangle className="h-5 w-5 text-red-400" />
                      <span className="text-sm font-semibold text-red-400">
                        {delayedOrders.length} order{delayedOrders.length !== 1 ? "s" : ""} delayed
                      </span>
                      <span className="text-xs text-red-400/60">
                        — in transit for more than {delayThresholdDays} days
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`text-xs ${showDelayedOnly ? "text-red-300 bg-red-500/20" : "text-red-400/70 hover:text-red-300 hover:bg-red-500/10"}`}
                      onClick={(e) => { e.stopPropagation(); setShowDelayedOnly((prev) => !prev); }}
                    >
                      {showDelayedOnly ? "Show All" : "View Delayed Only"}
                    </Button>
                  </div>
                  {delayBannerOpen && (
                    <div className="space-y-1.5 mt-3">
                      {delayedOrders.slice(0, 5).map((order) => (
                        <div
                          key={order.id}
                          className="flex items-center justify-between text-sm px-3 py-1.5 rounded-lg bg-red-500/5"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-red-300 font-mono text-xs">{order.orderNumber}</span>
                            <span className="text-zinc-300">{order.customerName}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-zinc-500 text-xs">{order.destinationCity || "-"}</span>
                            <span className="text-red-400 font-medium text-xs">
                              {getDaysInTransit(order)}d
                            </span>
                          </div>
                        </div>
                      ))}
                      {delayedOrders.length > 5 && (
                        <p className="text-xs text-red-400/50 px-3 pt-1">
                          +{delayedOrders.length - 5} more delayed order{delayedOrders.length - 5 !== 1 ? "s" : ""}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Search & Filter */}
              <SearchFilterDark
                search={search}
                onSearchChange={setSearch}
                statusFilter={statusFilter}
                onStatusChange={(v) => setStatusFilter(v || "all")}
                showDelivered={showDelivered}
                onShowDeliveredChange={setShowDelivered}
              />

              {/* Delayed-only filter indicator */}
              {showDelayedOnly && (
                <div className="flex items-center gap-2 text-sm text-red-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Showing delayed orders only</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-zinc-400 hover:text-zinc-200 h-6 px-2"
                    onClick={() => setShowDelayedOnly(false)}
                  >
                    Clear filter
                  </Button>
                </div>
              )}

              {/* Orders Table */}
              {loading ? (
                <div className="flex items-center justify-center py-16 text-zinc-500">
                  <Loader2 className="h-6 w-6 mr-2 animate-spin" />
                  Loading orders...
                </div>
              ) : (
                <OrderTableDark
                  orders={showDelayedOnly ? delayedOrders : orders}
                  onOrderUpdated={fetchOrders}
                  delayThresholdDays={delayThresholdDays}
                />
              )}
            </>
          )}

          {/* Influencer tab */}
          {activeTab === "influencer" && <InfluencerSection />}

          {/* Analytics tab */}
          {activeTab === "analytics" && (
            <AnalyticsSectionDark orders={orders} />
          )}
        </div>

        {/* Delay notification dialog */}
        <Dialog open={delayDialogOpen} onOpenChange={setDelayDialogOpen}>
          <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-zinc-100">
                <Bell className="h-5 w-5 text-red-400" />
                Delayed Orders
                {delayedOrders.length > 0 && (
                  <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20 ml-2">
                    {delayedOrders.length}
                  </Badge>
                )}
              </DialogTitle>
            </DialogHeader>
            {delayedOrders.length === 0 ? (
              <div className="text-center py-8 text-zinc-500">
                <CircleCheck className="h-10 w-10 mx-auto mb-3 text-emerald-500/50" />
                <p className="text-sm">No delayed orders</p>
                <p className="text-xs text-zinc-600 mt-1">
                  All orders within {delayThresholdDays}-day threshold
                </p>
              </div>
            ) : (
              <div className="space-y-2 mt-2">
                <p className="text-xs text-zinc-500 mb-3">
                  Orders in transit for more than {delayThresholdDays} days since fulfillment
                </p>
                {delayedOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/60 border border-zinc-700/30"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-zinc-200">{order.orderNumber}</span>
                        <StatusBadgeDark status={order.deliveryStatus} />
                      </div>
                      <div className="text-xs text-zinc-500">
                        {order.customerName} — {order.destinationCity || "Unknown"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-red-400">
                        {getDaysInTransit(order)}d
                      </div>
                      <div className="text-[10px] text-zinc-600">in transit</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Settings dialog */}
        <Dialog open={settingsDialogOpen} onOpenChange={(open) => {
          if (!open) setThresholdInput(String(delayThresholdDays));
          setSettingsDialogOpen(open);
        }}>
          <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-zinc-100">
                <Settings className="h-5 w-5 text-zinc-400" />
                Alert Settings
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <label className="text-sm text-zinc-400 block mb-2">
                  Mark orders as delayed after
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    value={thresholdInput}
                    onChange={(e) => setThresholdInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSaveThreshold()}
                    className="w-24 h-9 bg-zinc-800/60 border-zinc-700/50 text-zinc-200 text-center"
                  />
                  <span className="text-sm text-zinc-500">days in transit</span>
                </div>
                <p className="text-xs text-zinc-600 mt-2">
                  Currently set to {delayThresholdDays} day{delayThresholdDays !== 1 ? "s" : ""}
                </p>
              </div>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white w-full"
                onClick={handleSaveThreshold}
              >
                Save
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
