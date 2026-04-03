export type DeliveryStatus =
  | "Unfulfilled"
  | "Booked"
  | "Picked Up"
  | "In Transit"
  | "At Destination"
  | "Out for Delivery"
  | "Delivered"
  | "Undelivered"
  | "RTO"
  | "RTO Confirmed"
  | "RTO Received"
  | "Return Initiated"
  | "Return Complete";

export type EmailType = "delivery_confirmation" | "review_request";

export interface TrackingEvent {
  timestamp: string;
  status: string;
  description: string;
  location: string;
  branch: string;
}

export interface Order {
  id: string; // Notion page ID
  shopifyOrderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  trackingNumber: string;
  courierPartner: string;
  paymentMethod: "COD" | "Prepaid";
  orderTotal: number;
  codCollectionStatus: "Pending" | "Collected" | "";
  orderDate: string;
  fulfilledDate: string;
  deliveryStatus: DeliveryStatus;
  originCity: string;
  destinationCity: string;
  expectedDeliveryDate: string;
  deliveredDate: string;
  deliveredTimestamp: string;
  receiverName: string;
  lastUpdated: string;
  trackingTimeline: TrackingEvent[];
  rtoTrackingNumber: string;
  deliveryEmailSent: boolean;
  reviewEmailSent: boolean;
  shippingMode: "Air" | "Road" | "";
  weightGrams: number;
}

export interface Product {
  id: string;
  name: string;
  imageUrl: string;
  size: string;
  productUrl: string;
}

export interface InfluencerShipment {
  id: string;
  label: string;
  trackingNumber: string;
  courierPartner: string;
  deliveryStatus: DeliveryStatus;
  originCity: string;
  destinationCity: string;
  expectedDeliveryDate: string;
  deliveredDate: string;
  receiverName: string;
  lastUpdated: string;
  trackingTimeline: TrackingEvent[];
  createdAt: string;
  products?: Product[];
  phoneNumber: string;
  instagramHandle: string;
  isJaipurInfluencer: boolean;
}

export interface ShippingRateSlab {
  minGrams: number;
  maxGrams: number; // use Infinity for the last slab
  rate: number;
}

export interface ShippingRateTable {
  codAir: ShippingRateSlab[];
  codRoad: ShippingRateSlab[];
  prepaidAir: ShippingRateSlab[];
  prepaidRoad: ShippingRateSlab[];
}

export interface OrderFilters {
  status?: DeliveryStatus;
  search?: string;
  hideDelivered?: boolean;
  shippingMode?: "Air" | "Road";
}

export interface DataProvider {
  getOrders(filters?: OrderFilters): Promise<Order[]>;
  upsertOrder(order: Omit<Order, "id">): Promise<Order>;
  updateOrderTracking(
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
    },
    pageId?: string
  ): Promise<void>;
  getActiveOrders(): Promise<Order[]>;
  updateDeliveryStatus(orderId: string, status: DeliveryStatus): Promise<void>;
  updateCodStatus(
    orderId: string,
    status: "Pending" | "Collected"
  ): Promise<void>;
  updateShippingMode(
    orderId: string,
    mode: "Air" | "Road"
  ): Promise<void>;
  updateOrderWeight(orderId: string, weightGrams: number): Promise<void>;
  updateRtoTracking(
    orderId: string,
    rtoTrackingNumber: string
  ): Promise<void>;
  assignTracking(
    orderId: string,
    trackingNumber: string,
    courierPartner: string
  ): Promise<void>;
  markEmailSent(orderId: string): Promise<void>;
  markReviewEmailSent(orderId: string): Promise<void>;
  getOrderById(orderId: string): Promise<Order | null>;
  // Influencer shipments
  getInfluencerShipments(): Promise<InfluencerShipment[]>;
  createInfluencerShipment(shipment: {
    label: string;
    trackingNumber: string;
    phoneNumber: string;
    instagramHandle?: string;
    isJaipurInfluencer?: boolean;
  }): Promise<InfluencerShipment>;
  getActiveInfluencerShipments(): Promise<InfluencerShipment[]>;
  updateInfluencerTracking(
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
  ): Promise<void>;
  markInfluencerDelivered(shipmentId: string): Promise<void>;
}
