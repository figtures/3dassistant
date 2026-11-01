import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDayColumns,
  buildGanttColumns,
  jobIntersectsTimeline,
  jobTimeRange,
  layoutBarOnTimeline,
  resolveJobDurationMinutes,
  todayMarkerPercent,
} from "@/features/planning/gantt-layout";

describe("gantt-layout", () => {
  it("defaults missing duration to one day", () => {
    assert.equal(resolveJobDurationMinutes(null), 24 * 60);
    assert.equal(resolveJobDurationMinutes(0), 24 * 60);
    assert.equal(resolveJobDurationMinutes(90), 90);
  });

  it("computes job end from duration minutes", () => {
    const { startMs, endMs } = jobTimeRange("2026-03-10", 90);
    assert.equal(endMs - startMs, 90 * 60_000);
  });

  it("layouts bar width within timeline", () => {
    const start = Date.parse("2026-03-10T00:00:00");
    const end = Date.parse("2026-03-13T00:00:00");
    const layout = layoutBarOnTimeline(
      { startMs: start, endMs: start + 2 * 86_400_000 },
      start,
      end
    );
    assert.ok(layout);
    assert.equal(layout!.leftPercent, 0);
    assert.ok(layout!.widthPercent > 0 && layout!.widthPercent <= 100);
  });

  it("clips bars outside timeline", () => {
    const timelineStart = Date.parse("2026-03-10T00:00:00");
    const timelineEnd = Date.parse("2026-03-15T00:00:00");
    assert.equal(
      layoutBarOnTimeline(
        { startMs: timelineStart - 86_400_000, endMs: timelineStart + 86_400_000 },
        timelineStart,
        timelineEnd
      )!.leftPercent,
      0
    );
    assert.equal(
      layoutBarOnTimeline(
        {
          startMs: timelineEnd,
          endMs: timelineEnd + 86_400_000,
        },
        timelineStart,
        timelineEnd
      ),
      null
    );
  });

  it("marks today within day columns", () => {
    const cols = buildDayColumns(
      ["2026-03-09", "2026-03-10", "2026-03-11"],
      "2026-03-10"
    );
    assert.equal(cols[1]?.isToday, true);
    const bounds = {
      startMs: cols[0]!.startMs,
      endMs: cols[cols.length - 1]!.endMs,
    };
    const marker = todayMarkerPercent(
      "2026-03-10",
      bounds.startMs,
      bounds.endMs
    );
    assert.ok(marker != null && marker > 20 && marker < 80);
  });

  it("detects job intersection with timeline", () => {
    const start = Date.parse("2026-03-10T00:00:00");
    const end = Date.parse("2026-03-20T00:00:00");
    assert.equal(
      jobIntersectsTimeline("2026-03-15", 120, start, end),
      true
    );
    assert.equal(
      jobIntersectsTimeline("2026-03-25", 60, start, end),
      false
    );
  });

  it("builds week columns from date span", () => {
    const cols = buildGanttColumns(
      "week",
      ["2026-03-09", "2026-03-10", "2026-03-16"],
      "2026-03-10"
    );
    assert.ok(cols.length >= 2);
  });
});
