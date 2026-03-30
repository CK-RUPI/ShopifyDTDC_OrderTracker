"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { InfluencerShipment, Product, DeliveryStatus } from "@/lib/data/types";
import { TrackingTimeline } from "./TrackingTimeline";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Search,
  Pencil,
  Trash2,
  Package,
  X,
  Save,
  Activity,
} from "lucide-react";

// Dark-themed status badge matching the orders table
const darkStatusConfig: Record<
  DeliveryStatus,
  { className: string; label: string }
> = {
  Unfulfilled: {
    className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    label: "Unfulfilled",
  },
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

interface ProductFormState {
  url: string;
  name: string;
  imageUrl: string;
  size: string;
  lookingUp: boolean;
  lookupDone: boolean;
  error: string;
}

const emptyForm: ProductFormState = {
  url: "",
  name: "",
  imageUrl: "",
  size: "",
  lookingUp: false,
  lookupDone: false,
  error: "",
};

export function InfluencerSection() {
  const [shipments, setShipments] = useState<InfluencerShipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newTracking, setNewTracking] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Product management state
  const [products, setProducts] = useState<Record<string, Product[]>>({});
  const [showProductForm, setShowProductForm] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState<ProductFormState>(emptyForm);
  const [savingProducts, setSavingProducts] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Set<string>>(new Set());
  const [timelineOpen, setTimelineOpen] = useState<Set<string>>(new Set());

  const fetchShipments = useCallback(async () => {
    try {
      const res = await fetch("/api/influencer");
      const data = await res.json();
      if (data.success) {
        setShipments(data.shipments);
        const productMap: Record<string, Product[]> = {};
        for (const s of data.shipments) {
          if (s.products) {
            productMap[s.id] = s.products;
          }
        }
        setProducts((prev) => ({ ...prev, ...productMap }));
      }
    } catch (err) {
      console.error("Failed to fetch influencer shipments:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShipments();
  }, [fetchShipments]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setMessage(null);
    try {
      const res = await fetch("/api/influencer/refresh", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setMessage({
          type: "success",
          text: `Refreshed ${data.refreshed} shipments${data.errors ? ` (${data.errors} errors)` : ""}`,
        });
        fetchShipments();
      } else {
        setMessage({ type: "error", text: data.error || "Refresh failed" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to refresh tracking" });
    } finally {
      setRefreshing(false);
    }
  };

  const handleAdd = async () => {
    if (!newTracking) return;
    setAdding(true);
    setMessage(null);
    try {
      const res = await fetch("/api/influencer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackingNumber: newTracking,
          label: newLabel || "Untitled",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNewTracking("");
        setNewLabel("");
        setShowAdd(false);
        fetchShipments();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to add" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to add shipment" });
    } finally {
      setAdding(false);
    }
  };

  const handleProductLookup = async () => {
    if (!productForm.url) return;
    setProductForm((f) => ({ ...f, lookingUp: true, error: "" }));
    try {
      const res = await fetch("/api/influencer/product-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: productForm.url }),
      });
      const data = await res.json();
      if (data.success) {
        setProductForm((f) => ({
          ...f,
          name: data.product.name,
          imageUrl: data.product.imageUrl,
          lookingUp: false,
          lookupDone: true,
          error: "",
        }));
      } else {
        setProductForm((f) => ({
          ...f,
          lookingUp: false,
          lookupDone: true,
          error: data.error || "Product not found. Enter name manually.",
        }));
      }
    } catch {
      setProductForm((f) => ({
        ...f,
        lookingUp: false,
        lookupDone: true,
        error: "Lookup failed. Enter name manually.",
      }));
    }
  };

  const handleAddProduct = (shipmentId: string) => {
    if (!productForm.name || !productForm.url) return;
    const newProduct: Product = {
      id: crypto.randomUUID(),
      name: productForm.name,
      imageUrl: productForm.imageUrl,
      size: productForm.size,
      productUrl: productForm.url,
    };

    setProducts((prev) => ({
      ...prev,
      [shipmentId]: [...(prev[shipmentId] || []), newProduct],
    }));
    setPendingChanges((prev) => new Set(prev).add(shipmentId));
    setProductForm(emptyForm);
    setShowProductForm(null);
  };

  const handleEditProduct = (shipmentId: string) => {
    if (!productForm.name || !productForm.url || !editingProductId) return;

    setProducts((prev) => ({
      ...prev,
      [shipmentId]: (prev[shipmentId] || []).map((p) =>
        p.id === editingProductId
          ? {
              ...p,
              name: productForm.name,
              imageUrl: productForm.imageUrl,
              size: productForm.size,
              productUrl: productForm.url,
            }
          : p
      ),
    }));
    setPendingChanges((prev) => new Set(prev).add(shipmentId));
    setProductForm(emptyForm);
    setEditingProductId(null);
    setShowProductForm(null);
  };

  const handleRemoveProduct = (shipmentId: string, productId: string) => {
    setProducts((prev) => ({
      ...prev,
      [shipmentId]: (prev[shipmentId] || []).filter((p) => p.id !== productId),
    }));
    setPendingChanges((prev) => new Set(prev).add(shipmentId));
  };

  const startEditProduct = (shipmentId: string, product: Product) => {
    setEditingProductId(product.id);
    setShowProductForm(shipmentId);
    setProductForm({
      url: product.productUrl,
      name: product.name,
      imageUrl: product.imageUrl,
      size: product.size,
      lookingUp: false,
      lookupDone: true,
      error: "",
    });
  };

  const handleSaveProducts = async (shipmentId: string) => {
    setSavingProducts(shipmentId);
    try {
      const res = await fetch(`/api/influencer/${shipmentId}/products`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products: products[shipmentId] || [] }),
      });
      const data = await res.json();
      if (data.success) {
        setPendingChanges((prev) => {
          const next = new Set(prev);
          next.delete(shipmentId);
          return next;
        });
        setMessage({ type: "success", text: "Products saved" });
      } else {
        setMessage({
          type: "error",
          text: data.error || "Failed to save products",
        });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to save products" });
    } finally {
      setSavingProducts(null);
    }
  };

  const cancelProductForm = () => {
    setShowProductForm(null);
    setEditingProductId(null);
    setProductForm(emptyForm);
  };

  if (loading) {
    return (
      <div className="text-center py-12 text-zinc-500">
        Loading influencer shipments...
      </div>
    );
  }

  return (
    <div>
      {/* Actions */}
      <div className="flex gap-3 mb-4">
        <Button size="sm" onClick={() => setShowAdd(!showAdd)}>
          <Plus className="h-4 w-4 mr-1" />
          Add Shipment
        </Button>
        <Button size="sm" onClick={handleRefresh} disabled={refreshing}>
          {refreshing ? "Refreshing..." : "Refresh All"}
        </Button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="flex gap-2 mb-4 items-center p-3 bg-zinc-900 rounded-md border border-zinc-800">
          <Input
            placeholder="Tracking Number *"
            value={newTracking}
            onChange={(e) => setNewTracking(e.target.value)}
            className="w-56"
          />
          <Input
            placeholder="Label (optional)"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            className="w-48"
          />
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={!newTracking || adding}
          >
            {adding ? "Adding..." : "Add"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>
            Cancel
          </Button>
        </div>
      )}

      {/* Message */}
      {message && (
        <div
          className={`mb-4 p-3 rounded-md text-sm ${
            message.type === "success"
              ? "bg-green-900/50 text-green-300 border border-green-700"
              : "bg-red-900/50 text-red-300 border border-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Table */}
      {shipments.length === 0 ? (
        <div className="text-center py-16 text-zinc-500">
          <Package className="h-12 w-12 mx-auto mb-3 text-zinc-700" />
          <p className="text-lg text-zinc-400">No influencer shipments</p>
          <p className="text-sm mt-1 text-zinc-600">
            Click &quot;Add Shipment&quot; to track a package
          </p>
        </div>
      ) : (
        <div className="rounded-md border border-zinc-800">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-zinc-800/60 hover:bg-transparent">
                <TableHead className="w-[40px] text-zinc-500"></TableHead>
                <TableHead className="text-zinc-500 text-xs uppercase tracking-wider font-medium">
                  Label
                </TableHead>
                <TableHead className="text-zinc-500 text-xs uppercase tracking-wider font-medium">
                  Status
                </TableHead>
                <TableHead className="hidden md:table-cell text-zinc-500 text-xs uppercase tracking-wider font-medium">
                  Destination
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shipments.map((shipment) => {
                const isExpanded = expandedId === shipment.id;
                const shipmentProducts = products[shipment.id] || [];
                const hasPending = pendingChanges.has(shipment.id);
                return (
                  <Fragment key={shipment.id}>
                    <TableRow
                      className={`
                        border-b border-zinc-800/40 hover:bg-zinc-800/40 transition-colors cursor-pointer
                        ${isExpanded ? "bg-zinc-800/30" : ""}
                      `}
                      onClick={() =>
                        setExpandedId(isExpanded ? null : shipment.id)
                      }
                    >
                      <TableCell className="px-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedId(isExpanded ? null : shipment.id);
                          }}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium text-sm text-zinc-200">
                        {shipment.label}
                        {shipmentProducts.length > 0 && (
                          <span className="ml-2 text-xs text-zinc-500">
                            ({shipmentProducts.length} product
                            {shipmentProducts.length !== 1 ? "s" : ""})
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`${(darkStatusConfig[shipment.deliveryStatus] || darkStatusConfig["Booked"]).className} text-[11px] font-medium`}
                        >
                          {(darkStatusConfig[shipment.deliveryStatus] || darkStatusConfig["Booked"]).label}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-zinc-400">
                        {shipment.destinationCity || "-"}
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow
                        key={`${shipment.id}-details`}
                        className="hover:bg-transparent"
                      >
                        <TableCell
                          colSpan={4}
                          className="bg-zinc-900/80 border-b border-zinc-800/40 p-0 whitespace-normal"
                        >
                          <div className="px-6 py-5 border-l-2 border-l-blue-500/30">
                            <div className="flex gap-8 text-sm mb-3">
                              <div>
                                <span className="text-zinc-500">From:</span>{" "}
                                <span className="font-medium text-zinc-200">
                                  {shipment.originCity || "-"}
                                </span>
                              </div>
                              <div>
                                <span className="text-zinc-500">To:</span>{" "}
                                <span className="font-medium text-zinc-200">
                                  {shipment.destinationCity || "-"}
                                </span>
                              </div>
                              {shipment.receiverName && (
                                <div>
                                  <span className="text-zinc-500">
                                    Received by:
                                  </span>{" "}
                                  <span className="font-medium text-zinc-200">
                                    {shipment.receiverName}
                                  </span>
                                </div>
                              )}
                            </div>
                            {/* Courier Journey Toggle */}
                            <div className="border-t border-zinc-800 pt-3 mt-2">
                              <button
                                className="flex items-center gap-2 text-xs font-medium text-zinc-500 uppercase tracking-wider hover:text-zinc-300 transition-colors w-full"
                                onClick={() =>
                                  setTimelineOpen((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(shipment.id)) next.delete(shipment.id);
                                    else next.add(shipment.id);
                                    return next;
                                  })
                                }
                              >
                                <Activity className="h-3.5 w-3.5" />
                                Courier Journey
                                {shipment.trackingTimeline?.length > 0 && (
                                  <span className="text-zinc-600">
                                    ({shipment.trackingTimeline.length} events)
                                  </span>
                                )}
                                {timelineOpen.has(shipment.id) ? (
                                  <ChevronDown className="h-3.5 w-3.5 ml-auto" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5 ml-auto" />
                                )}
                              </button>
                              {timelineOpen.has(shipment.id) && (
                                <TrackingTimeline
                                  events={shipment.trackingTimeline}
                                />
                              )}
                            </div>

                            {/* Products Section */}
                            <div className="border-t border-zinc-800 pt-4 mt-3">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-medium text-zinc-300">
                                  Products
                                </h4>
                                <div className="flex gap-2">
                                  {hasPending && (
                                    <Button
                                      size="sm"
                                      onClick={() =>
                                        handleSaveProducts(shipment.id)
                                      }
                                      disabled={
                                        savingProducts === shipment.id
                                      }
                                      className="h-7 text-xs"
                                    >
                                      <Save className="h-3 w-3 mr-1" />
                                      {savingProducts === shipment.id
                                        ? "Saving..."
                                        : "Save"}
                                    </Button>
                                  )}
                                  {showProductForm !== shipment.id && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 text-xs text-zinc-400 hover:text-zinc-200"
                                      onClick={() => {
                                        setShowProductForm(shipment.id);
                                        setEditingProductId(null);
                                        setProductForm(emptyForm);
                                      }}
                                    >
                                      <Plus className="h-3 w-3 mr-1" />
                                      Add Product
                                    </Button>
                                  )}
                                </div>
                              </div>

                              {/* Product List */}
                              {shipmentProducts.length > 0 && (
                                <div className="space-y-2 mb-3">
                                  {shipmentProducts.map((product) => (
                                    <div
                                      key={product.id}
                                      className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-lg p-3"
                                    >
                                      {product.imageUrl ? (
                                        <img
                                          src={product.imageUrl}
                                          alt={product.name}
                                          className="w-12 h-12 rounded object-cover flex-shrink-0"
                                        />
                                      ) : (
                                        <div className="w-12 h-12 rounded bg-zinc-800 flex items-center justify-center flex-shrink-0">
                                          <Package className="h-5 w-5 text-zinc-600" />
                                        </div>
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <a
                                          href={product.productUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-sm text-blue-400 hover:text-blue-300 truncate block"
                                        >
                                          {product.name}
                                        </a>
                                        {product.size && (
                                          <span className="text-xs text-zinc-500">
                                            Size: {product.size}
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex gap-1 flex-shrink-0">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-7 w-7 p-0 text-zinc-500 hover:text-zinc-300"
                                          onClick={() =>
                                            startEditProduct(
                                              shipment.id,
                                              product
                                            )
                                          }
                                        >
                                          <Pencil className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-7 w-7 p-0 text-red-400/70 hover:text-red-400"
                                          onClick={() =>
                                            handleRemoveProduct(
                                              shipment.id,
                                              product.id
                                            )
                                          }
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Add/Edit Product Form */}
                              {showProductForm === shipment.id && (
                                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 space-y-3">
                                  <div className="flex gap-2">
                                    <Input
                                      placeholder="Product URL (e.g. urbannaari.co.in/products/...)"
                                      value={productForm.url}
                                      onChange={(e) =>
                                        setProductForm((f) => ({
                                          ...f,
                                          url: e.target.value,
                                          error: "",
                                        }))
                                      }
                                      className="flex-1"
                                    />
                                    <Button
                                      size="sm"
                                      onClick={handleProductLookup}
                                      disabled={
                                        !productForm.url ||
                                        productForm.lookingUp
                                      }
                                      className="h-9"
                                    >
                                      <Search className="h-3 w-3 mr-1" />
                                      {productForm.lookingUp
                                        ? "Looking up..."
                                        : "Lookup"}
                                    </Button>
                                  </div>

                                  {productForm.error && (
                                    <p className="text-xs text-yellow-400">
                                      {productForm.error}
                                    </p>
                                  )}

                                  {productForm.lookupDone && (
                                    <>
                                      <div className="flex gap-3 items-start">
                                        {productForm.imageUrl ? (
                                          <img
                                            src={productForm.imageUrl}
                                            alt="Preview"
                                            className="w-12 h-12 rounded object-cover flex-shrink-0"
                                          />
                                        ) : (
                                          <div className="w-12 h-12 rounded bg-zinc-800 flex items-center justify-center flex-shrink-0">
                                            <Package className="h-5 w-5 text-zinc-600" />
                                          </div>
                                        )}
                                        <Input
                                          placeholder="Product Name *"
                                          value={productForm.name}
                                          onChange={(e) =>
                                            setProductForm((f) => ({
                                              ...f,
                                              name: e.target.value,
                                            }))
                                          }
                                          className="flex-1"
                                        />
                                      </div>
                                      <div className="flex gap-2 items-center">
                                        <Input
                                          placeholder="Size (e.g. S, M, L, XL)"
                                          value={productForm.size}
                                          onChange={(e) =>
                                            setProductForm((f) => ({
                                              ...f,
                                              size: e.target.value,
                                            }))
                                          }
                                          className="w-48"
                                        />
                                        <Button
                                          size="sm"
                                          onClick={() =>
                                            editingProductId
                                              ? handleEditProduct(shipment.id)
                                              : handleAddProduct(shipment.id)
                                          }
                                          disabled={
                                            !productForm.name ||
                                            !productForm.url
                                          }
                                          className="h-9"
                                        >
                                          {editingProductId
                                            ? "Update"
                                            : "Add"}
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={cancelProductForm}
                                          className="h-9 text-zinc-500 hover:text-zinc-300"
                                        >
                                          <X className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </>
                                  )}

                                  {/* Allow skipping lookup for manual entry */}
                                  {!productForm.lookupDone &&
                                    !productForm.lookingUp && (
                                      <button
                                        className="text-xs text-zinc-500 hover:text-zinc-400 underline"
                                        onClick={() =>
                                          setProductForm((f) => ({
                                            ...f,
                                            lookupDone: true,
                                          }))
                                        }
                                      >
                                        or enter details manually
                                      </button>
                                    )}
                                </div>
                              )}

                              {shipmentProducts.length === 0 &&
                                showProductForm !== shipment.id && (
                                  <p className="text-xs text-zinc-600">
                                    No products added yet
                                  </p>
                                )}
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
      )}
    </div>
  );
}
