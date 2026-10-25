import { bambuFetchTelemetry, bambuListDevices } from "../bambu-client";
import { isCloudMockEnabled, mockFetchTelemetry, mockListDevices } from "../mock";
import type { CloudDevice, NormalizedTelemetry, VendorAdapter, VendorCredentials } from "../types";

export const bambuAdapter: VendorAdapter = {
  vendor: "bambu",

  async listDevices(credentials: VendorCredentials): Promise<CloudDevice[]> {
    if (isCloudMockEnabled() && credentials.accessToken === "mock") {
      return mockListDevices("bambu");
    }
    return bambuListDevices(credentials);
  },

  async fetchTelemetry(
    credentials: VendorCredentials,
    deviceId: string
  ): Promise<NormalizedTelemetry> {
    if (isCloudMockEnabled() && credentials.accessToken === "mock") {
      return mockFetchTelemetry(deviceId);
    }
    return bambuFetchTelemetry(credentials, deviceId);
  },
};
