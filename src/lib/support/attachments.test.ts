import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateAttachmentMeta } from "./attachments";

describe("validateAttachmentMeta", () => {
  const userId = "11111111-1111-1111-1111-111111111111";
  const folderId = "22222222-2222-2222-2222-222222222222";

  it("accepts valid paths", () => {
    const r = validateAttachmentMeta(
      [
        {
          path: `${userId}/${folderId}/a.png`,
          name: "a.png",
          contentType: "image/png",
          sizeBytes: 1000,
        },
      ],
      userId,
      folderId
    );
    assert.equal(r.ok, true);
  });

  it("rejects wrong prefix", () => {
    const r = validateAttachmentMeta(
      [
        {
          path: `other/${folderId}/a.png`,
          name: "a.png",
          contentType: "image/png",
          sizeBytes: 1000,
        },
      ],
      userId,
      folderId
    );
    assert.equal(r.ok, false);
  });

  it("rejects oversized files", () => {
    const r = validateAttachmentMeta(
      [
        {
          path: `${userId}/${folderId}/a.png`,
          name: "a.png",
          contentType: "image/png",
          sizeBytes: 6 * 1024 * 1024,
        },
      ],
      userId,
      folderId
    );
    assert.equal(r.ok, false);
  });
});
