import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MAX_CAMERA_FRAME_BYTES, parseBridgeCameraUpload } from "./camera";

const tinyJpegB64 = Buffer.from([0xff, 0xd8, 0xff, 0xd9, ...Array(64).fill(0)]).toString("base64");

describe("bridge camera upload", () => {
  it("parses valid payload", () => {
    const p = parseBridgeCameraUpload({
      machineId: "550e8400-e29b-41d4-a716-446655440000",
      imageBase64: tinyJpegB64,
      contentType: "image/jpeg",
    });
    assert.ok(p);
    assert.equal(p!.contentType, "image/jpeg");
  });

  it("rejects missing machineId", () => {
    assert.equal(parseBridgeCameraUpload({ imageBase64: tinyJpegB64 }), null);
  });

  it("rejects oversize base64", () => {
    const big = Buffer.alloc(MAX_CAMERA_FRAME_BYTES + 1, 1).toString("base64");
    assert.equal(
      parseBridgeCameraUpload({
        machineId: "550e8400-e29b-41d4-a716-446655440000",
        imageBase64: big,
      }),
      null
    );
  });

  it("strips data-uri prefix", () => {
    const p = parseBridgeCameraUpload({
      machineId: "550e8400-e29b-41d4-a716-446655440000",
      imageBase64: `data:image/jpeg;base64,${tinyJpegB64}`,
    });
    assert.ok(p);
    assert.equal(p!.imageBase64, tinyJpegB64);
  });
});
