import { isCloudMockEnabled, mockFetchTelemetry, mockListDevices } from "../mock";
import { prusaFetchTelemetry, prusaListDevices } from "../prusa-client";
import type { CloudDevice, NormalizedTelemetry, VendorAdapter, VendorCredentials } from "../types";

export const prusaAdapter: VendorAdapter = {
  vendor: "prusa",

  async listDevices(credentials: VendorCredentials): Promise<CloudDevice[]> {
    if (isCloudMockEnabled() && credentials.apiKey === "mock") {
      return mockListDevices("prusa");
    }
    return prusaListDevices(credentials);
  },

  async fetchTelemetry(
    credentials: VendorCredentials,
    deviceId: string
  ): Promise<NormalizedTelemetry> {
    if (isCloudMockEnabled() && credentials.apiKey === "mock") {
      return mockFetchTelemetry(deviceId);
    }
    return prusaFetchTelemetry(credentials, deviceId);
  },
};
