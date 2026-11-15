import { describe, expect, it } from "vitest";
import { matchCatalogue, type ScanExtract } from "./scan.functions";
const ex = (o: Partial<ScanExtract>): ScanExtract => ({ readable: true, service_name: null, plan_name: null, price: null, currency: "INR", billing: "month", renewal_date: null, category_guess: null, notes: null, ...o });
describe("scan matching", () => {
  it("exact name and plan", () => { const m = matchCatalogue(ex({ service_name: "Netflix", plan_name: "Standard", price: 499 }))[0]!; expect([m.name, m.planName, m.exact]).toEqual(["Netflix", "Standard", true]); });
  it("near name is an estimate, not exact", () => { const m = matchCatalogue(ex({ service_name: "Spotfy Premium" }))[0]!; expect(m.name).toBe("Spotify"); expect(m.exact).toBe(false); });
  it("unknown service gives no match", () => expect(matchCatalogue(ex({ service_name: "Zqxv Gym" }))).toHaveLength(0));
});
