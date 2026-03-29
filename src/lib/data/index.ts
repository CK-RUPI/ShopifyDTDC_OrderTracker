import { notionProvider } from "./notion";
import { DataProvider } from "./types";

// Abstracted data provider — swap to Supabase by changing this export
export const data: DataProvider = notionProvider;

export type { Order, OrderFilters, DeliveryStatus, TrackingEvent, InfluencerShipment, EmailType } from "./types";
export type { DataProvider } from "./types";
