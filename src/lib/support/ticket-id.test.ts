import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateTicketId, isValidTicketId } from "./ticket-id";

describe("ticket id", () => {
  it("generates PF- prefix with 6 chars", () => {
    const id = generateTicketId();
    assert.ok(isValidTicketId(id));
  });
});
