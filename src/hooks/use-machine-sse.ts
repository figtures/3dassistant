"use client";

import { useEffect, useState } from "react";
import type { Machine } from "@/types/database";

type LiveMachine = Pick<
  Machine,
  | "id"
  | "name"
  | "printer_state"
  | "connection_status"
  | "progress_percent"
  | "job_name"
  | "print_time_seconds"
  | "error_message"
  | "bed_temp_c"
  | "nozzle_temp_c"
  | "chamber_temp_c"
  | "camera_stream_url"
  | "telemetry_updated_at"
  | "last_seen_at"
>;

export function useMachineLiveSse(machineId: string | undefined) {
  const [live, setLive] = useState<LiveMachine | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!machineId) return;
    const es = new EventSource(`/api/machines/${machineId}/live`);
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "snapshot" && msg.machine) {
          setLive(msg.machine as LiveMachine);
        }
      } catch {
        /* ignore */
      }
    };
    return () => es.close();
  }, [machineId]);

  return { live, sseConnected: connected };
}

type FleetListener = (machines: LiveMachine[]) => void;

/** Tek EventSource — dashboard/sidebar'daki çoklu hook çağrıları aynı SSE'yi paylaşır. */
let fleetEs: EventSource | null = null;
let fleetSnapshot: LiveMachine[] = [];
let fleetSubscribers = 0;
const fleetListeners = new Set<FleetListener>();

function notifyFleetListeners() {
  for (const listener of fleetListeners) {
    listener(fleetSnapshot);
  }
}

function openFleetEs() {
  if (fleetEs) return;
  fleetEs = new EventSource("/api/machines/live");
  fleetEs.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.type === "fleet" && Array.isArray(msg.machines)) {
        fleetSnapshot = msg.machines as LiveMachine[];
        notifyFleetListeners();
      }
    } catch {
      /* ignore */
    }
  };
  fleetEs.onerror = () => {
    /* EventSource varsayılan yeniden bağlanmayı kullanır */
  };
}

function closeFleetEsIfIdle() {
  if (fleetSubscribers === 0 && fleetEs) {
    fleetEs.close();
    fleetEs = null;
  }
}

function subscribeFleet(listener: FleetListener): () => void {
  fleetSubscribers += 1;
  fleetListeners.add(listener);
  openFleetEs();
  listener(fleetSnapshot);
  return () => {
    fleetListeners.delete(listener);
    fleetSubscribers = Math.max(0, fleetSubscribers - 1);
    closeFleetEsIfIdle();
  };
}

export function useFleetLiveSse(enabled = true) {
  const [machines, setMachines] = useState<LiveMachine[]>(fleetSnapshot);

  useEffect(() => {
    if (!enabled) return;
    return subscribeFleet(setMachines);
  }, [enabled]);

  return machines;
}
