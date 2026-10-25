import { crealityFetchTelemetry, crealityListDevices } from "../creality-client";
import { isCloudMockEnabled, mockFetchTelemetry, mockListDevices } from "../mock";
import type { CloudDevice, NormalizedTelemetry, VendorAdapter, VendorCredentials } from "../types";

export const crealityAdapter: VendorAdapter = {
  vendor: "creality",

  async listDevices(credentials: VendorCredentials): Promise<CloudDevice[]> {
    if (isCloudMockEnabled() && credentials.accessToken === "mock") {
      return mockListDevices("creality");
    }
    return crealityListDevices(credentials);
  },

  async fetchTelemetry(
    credentials: VendorCredentials,
    deviceId: string
  ): Promise<NormalizedTelemetry> {
    if (isCloudMockEnabled() && credentials.accessToken === "mock") {
      return mockFetchTelemetry(deviceId);
    }
    return crealityFetchTelemetry(credentials, deviceId);
  },
};
