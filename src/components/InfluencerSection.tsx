"use client";

import { useState, useEffect, useCallback } from "react";
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
import { InfluencerShipment } from "@/lib/data/types";
import { StatusBadge } from "./StatusBadge";
import { TrackingTimeline } from "./TrackingTimeline";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";

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

  const fetchShipments = useCallback(async () => {
    try {
      const res = await fetch("/api/influencer");
      const data = await res.json();
      if (data.success) {
        setShipments(data.shipments);
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

  if (loading) {
    return (
      <div className="text-center py-12 text-gray-500">
        Loading influencer shipments...
      </div>
    );
  }

  return (
    <div>
      {/* Actions */}
      <div className="flex gap-3 mb-4">
        <Button
          size="sm"
          onClick={() => setShowAdd(!showAdd)}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Shipment
        </Button>
        <Button
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          {refreshing ? "Refreshing..." : "Refresh All"}
        </Button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="flex gap-2 mb-4 items-center p-3 bg-gray-900 rounded-md border border-gray-700">
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
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowAdd(false)}
          >
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
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">No influencer shipments</p>
          <p className="text-sm mt-1">Click &quot;Add Shipment&quot; to track a package</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]"></TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">
                  Destination
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shipments.map((shipment) => {
                const isExpanded = expandedId === shipment.id;
                return (
                  <>
                    <TableRow key={shipment.id}>
                      <TableCell className="px-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() =>
                            setExpandedId(isExpanded ? null : shipment.id)
                          }
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium">
                        {shipment.label}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={shipment.deliveryStatus} />
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {shipment.destinationCity || "-"}
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow key={`${shipment.id}-details`}>
                        <TableCell colSpan={4} className="bg-gray-50 p-0">
                          <div className="px-6 py-4">
                            <div className="flex gap-8 text-sm mb-3">
                              <div>
                                <span className="text-gray-500">From:</span>{" "}
                                <span className="font-medium">
                                  {shipment.originCity || "-"}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-500">To:</span>{" "}
                                <span className="font-medium">
                                  {shipment.destinationCity || "-"}
                                </span>
                              </div>
                              {shipment.receiverName && (
                                <div>
                                  <span className="text-gray-500">
                                    Received by:
                                  </span>{" "}
                                  <span className="font-medium">
                                    {shipment.receiverName}
                                  </span>
                                </div>
                              )}
                            </div>
                            <TrackingTimeline
                              events={shipment.trackingTimeline}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
