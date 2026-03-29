"use client";

import { Badge } from "@/components/ui/badge";
import { DeliveryStatus } from "@/lib/data/types";

const statusConfig: Record<
  DeliveryStatus,
  { className: string; label: string }
> = {
  Booked: {
    className: "bg-yellow-100 text-yellow-800 border-yellow-300",
    label: "Booked",
  },
  "Picked Up": {
    className: "bg-yellow-100 text-yellow-800 border-yellow-300",
    label: "Picked Up",
  },
  "In Transit": {
    className: "bg-blue-100 text-blue-800 border-blue-300",
    label: "In Transit",
  },
  "At Destination": {
    className: "bg-orange-100 text-orange-800 border-orange-300",
    label: "At Destination",
  },
  "Out for Delivery": {
    className: "bg-orange-100 text-orange-800 border-orange-300",
    label: "Out for Delivery",
  },
  Delivered: {
    className: "bg-green-100 text-green-800 border-green-300",
    label: "Delivered",
  },
  Undelivered: {
    className: "bg-red-100 text-red-800 border-red-300",
    label: "Undelivered",
  },
  Stuck: {
    className: "bg-red-100 text-red-800 border-red-300",
    label: "Stuck",
  },
  RTO: {
    className: "bg-purple-100 text-purple-800 border-purple-300",
    label: "RTO",
  },
  "RTO Confirmed": {
    className: "bg-purple-100 text-purple-800 border-purple-300",
    label: "RTO Confirmed",
  },
  "RTO Received": {
    className: "bg-purple-100 text-purple-800 border-purple-300",
    label: "RTO Received",
  },
  "Return Initiated": {
    className: "bg-rose-100 text-rose-800 border-rose-300",
    label: "Return Initiated",
  },
  "Return Complete": {
    className: "bg-teal-100 text-teal-800 border-teal-300",
    label: "Return Complete",
  },
};

export function StatusBadge({ status }: { status: DeliveryStatus }) {
  const config = statusConfig[status] || statusConfig["Booked"];
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
