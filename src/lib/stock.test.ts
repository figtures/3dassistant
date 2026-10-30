import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  collectLowStockItems,
  consumptionByColorFromJobs,
  DEFAULT_LOW_STOCK_GRAMS,
  estimateDaysLeft,
  isLowStock,
  lowStockThreshold,
} from "@/lib/stock";
import type { Material } from "@/types/database";

describe("stock", () => {
  it("lowStockThreshold uses default when null", () => {
    assert.equal(lowStockThreshold(null), DEFAULT_LOW_STOCK_GRAMS);
    assert.equal(lowStockThreshold(undefined), DEFAULT_LOW_STOCK_GRAMS);
    assert.equal(lowStockThreshold(200), 200);
  });

  it("isLowStock compares stock to threshold", () => {
    assert.equal(isLowStock(499, 500), true);
    assert.equal(isLowStock(500, 500), false);
    assert.equal(isLowStock(null, 500), true);
  });

  it("estimateDaysLeft from 30d consumption", () => {
    assert.equal(estimateDaysLeft(0, 1000), null);
    assert.equal(estimateDaysLeft(300, 0), 0);
    assert.equal(estimateDaysLeft(300, 600), 60);
  });

  it("consumptionByColorFromJobs sums recent grams", () => {
    const now = new Date("2026-10-30T12:00:00Z");
    const map = consumptionByColorFromJobs(
      [
        {
          material_color_id: "c1",
          grams_used: 100,
          job_date: "2026-10-25",
        },
        {
          material_color_id: "c1",
          grams_used: 50,
          job_date: "2026-09-01",
        },
        {
          material_color_id: "c2",
          grams_used: 200,
          job_date: "2026-10-20",
        },
      ],
      30,
      now
    );
    assert.equal(map.get("c1"), 100);
    assert.equal(map.get("c2"), 200);
  });

  it("collectLowStockItems lists critical colors", () => {
    const materials: Material[] = [
      {
        id: "m1",
        name: "PLA",
        user_id: "u",
        brand: null,
        color: null,
        price_per_kg: 0,
        stock_grams: 100,
        created_at: "",
        updated_at: "",
        material_colors: [
          {
            id: "c1",
            material_id: "m1",
            user_id: "u",
            color_name: "Siyah",
            hex_code: null,
            stock_grams: 400,
            sort_order: 0,
            low_stock_grams: 500,
            created_at: "",
            updated_at: "",
          },
        ],
      },
    ];
    const items = collectLowStockItems(materials);
    assert.equal(items.length, 1);
    assert.equal(items[0]?.colorName, "Siyah");
    assert.equal(items[0]?.thresholdGrams, 500);
  });
});
