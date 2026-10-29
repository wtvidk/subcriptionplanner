import { describe, expect, it } from "vitest";
import { addMonths, buildReminders, equivalents, rollForward, searchCatalogue, sortSubs, validateSub, type SubView } from "./planner-core";
import { SERVICES } from "./catalogue";

const sub = (o: Partial<SubView>): SubView => ({ id: "x", service_id: null, service_name: "A", category: "AI", plan_name: "P", price: 100, billing_interval: "month", interval_months: 1,
  start_date: "2026-01-01", next_renewal: "2026-02-01", autopay: false, notes: null, is_custom: false, status: "active", cancelled_at: null, created_at: "", monthly: 100, yearly: 1200, days_remaining: 5, ...o });

describe("planner rules", () => {
  it("yearly ₹1,200 = ₹100/month", () => expect(equivalents(1200, 12)).toEqual({ monthly: 100, yearly: 1200 }));
  it("monthly ₹149 = ₹1,788/year", () => expect(equivalents(149, 1).yearly).toBe(1788));
  it("31 Jan + 1 month in leap year = 29 Feb", () => expect(addMonths("2028-01-31", 1)).toBe("2028-02-29"));
  it("past renewal rolls forward", () => expect(rollForward("2026-01-15", 1, "2026-03-20")).toBe("2026-04-15"));
  it("default sort is lowest price first", () => expect(sortSubs([sub({ id: "a", price: 500 }), sub({ id: "b", price: 79 })]).map((s) => s.id)).toEqual(["b", "a"]));
  it("search is case-insensitive and partial", () => expect(searchCatalogue("NETF").map((s) => s.name)).toContain("Netflix"));
  it("search by plan name", () => expect(searchCatalogue("mega fan").map((s) => s.name)).toContain("Crunchyroll"));
  it("Canva in AI and Design", () => expect(SERVICES.find((s) => s.name === "Canva")!.categoryIds).toEqual(["ai", "design"]));
  it("reminder uses tightest interval", () => expect(buildReminders([sub({ days_remaining: 2 })], [7, 3, 1, 0], new Set())[0]!.interval).toBe(3));
  it("no reminder beyond 7 days", () => expect(buildReminders([sub({ days_remaining: 8 })], [7, 3, 1, 0], new Set())).toHaveLength(0));
  it("negative price rejected", () => expect(validateSub({ service_name: "a", category: "b", plan_name: "c", price: -1, billing_interval: "month", start_date: "2026-01-01", next_renewal: "2026-02-01", autopay: false })).not.toBeNull());
});
