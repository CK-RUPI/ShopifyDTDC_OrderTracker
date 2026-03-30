import { DeliveryStatus } from "@/lib/data/types";

// Allowed automated transitions from each status
const ALLOWED_TRANSITIONS: Record<DeliveryStatus, DeliveryStatus[]> = {
  "Unfulfilled": ["Booked", "Picked Up", "In Transit", "At Destination", "Out for Delivery", "Delivered", "Undelivered", "Stuck", "RTO"],
  "Booked": ["Picked Up", "In Transit", "At Destination", "Out for Delivery", "Delivered", "Undelivered", "Stuck", "RTO"],
  "Picked Up": ["In Transit", "At Destination", "Out for Delivery", "Delivered", "Undelivered", "Stuck", "RTO"],
  "In Transit": ["At Destination", "Out for Delivery", "Delivered", "Undelivered", "Stuck", "RTO"],
  "At Destination": ["Out for Delivery", "Delivered", "Undelivered", "Stuck", "RTO"],
  "Out for Delivery": ["Delivered", "Undelivered", "Stuck", "RTO"],
  "Delivered": [],
  "Undelivered": ["Out for Delivery", "In Transit", "At Destination", "Delivered", "Stuck", "RTO"],
  "Stuck": ["In Transit", "At Destination", "Out for Delivery", "Delivered", "Undelivered", "RTO"],
  "RTO": [],
  "RTO Confirmed": [],
  "RTO Received": [],
  "Return Initiated": [],
  "Return Complete": [],
};

/**
 * Context-aware status resolution.
 * Remaps DTDC-derived status based on the order's current state.
 * e.g., RTO + "Delivered" from DTDC → "RTO Received"
 */
export function resolveStatus(
  dtdcMappedStatus: DeliveryStatus,
  currentOrderStatus: DeliveryStatus
): DeliveryStatus {
  if (currentOrderStatus === "RTO") {
    // RTO Confirmed must be set manually — never auto-transition
    return "RTO";
  }

  if (currentOrderStatus === "RTO Confirmed") {
    // RTO Received must be set manually — never auto-transition
    return "RTO Confirmed";
  }

  if (currentOrderStatus === "Return Initiated") {
    // Return Complete must be set manually — never auto-transition
    return "Return Initiated";
  }

  return dtdcMappedStatus;
}

/**
 * Validates whether a status transition is allowed.
 * Manual transitions always succeed but return a warning if non-standard.
 */
export function validateTransition(
  from: DeliveryStatus,
  to: DeliveryStatus,
  isManual: boolean
): { allowed: boolean; warning?: string } {
  // No-op is always fine
  if (from === to) return { allowed: true };

  const allowed = ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;

  if (isManual) {
    return {
      allowed: true,
      warning: allowed ? undefined : `Non-standard transition: ${from} → ${to}`,
    };
  }

  if (!allowed) {
    return {
      allowed: false,
      warning: `Blocked: ${from} → ${to} is not an allowed automated transition`,
    };
  }

  return { allowed: true };
}

/**
 * Logs a blocked or overridden transition for debugging.
 */
export function logBlockedTransition(
  trackingNumber: string,
  from: DeliveryStatus,
  to: DeliveryStatus,
  source: "bulk-refresh" | "single-refresh" | "manual"
): void {
  console.warn(
    `[STATUS GUARD] BLOCKED: ${trackingNumber} transition ${from} → ${to} (source: ${source})`
  );
}
