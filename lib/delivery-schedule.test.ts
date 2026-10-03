import { describe, expect, it } from "vitest";
import {
  computeCurrentCycle,
  deliveryDatesInProduction,
  deliveryDatesProducedOn,
  nextDeliveryDate,
  productionDateForDelivery,
  productionWeekdayForDelivery,
  sendDeadlineDateForDelivery,
  sendDeadlineForDelivery,
  sendWeekdayForDelivery,
} from "@/lib/delivery-schedule";
import { weekdayOfISODate } from "@/lib/dates";
import type { Weekday } from "@/lib/types/database.types";

// 2026-10-05 is a Monday; the week below runs Mon 05 … Sun 11, then Mon 12.
const DAY = {
  mon: "2026-10-05",
  tue: "2026-10-06",
  wed: "2026-10-07",
  thu: "2026-10-08",
  fri: "2026-10-09",
  sat: "2026-10-10",
  sun: "2026-10-11",
  nextMon: "2026-10-12",
};

// delivery date -> [stock deadline date (23:59), production/order date]
const RULE: [string, string, string, string][] = [
  ["Monday (exception)", DAY.nextMon, DAY.fri, DAY.sat],
  ["Tuesday", DAY.tue, "2026-10-04", DAY.mon],
  ["Wednesday", DAY.wed, DAY.mon, DAY.tue],
  ["Thursday", DAY.thu, DAY.tue, DAY.wed],
  ["Friday", DAY.fri, DAY.wed, DAY.thu],
  ["Saturday", DAY.sat, DAY.thu, DAY.fri],
  ["Sunday", DAY.sun, DAY.fri, DAY.sat],
];

describe("delivery date -> stock deadline -> production day", () => {
  it.each(RULE)("%s", (_label, delivery, sendDate, productionDate) => {
    expect(sendDeadlineDateForDelivery(delivery)).toBe(sendDate);
    expect(productionDateForDelivery(delivery)).toBe(productionDate);
  });

  it("never schedules production on a Sunday", () => {
    for (let i = 0; i < 28; i++) {
      const delivery = new Date(Date.UTC(2026, 9, 5 + i, 12)).toISOString().slice(0, 10);
      expect(weekdayOfISODate(productionDateForDelivery(delivery))).not.toBe("sunday");
    }
  });

  it("Monday delivery: stock due Friday 23:59, produced Saturday morning", () => {
    expect(weekdayOfISODate(sendDeadlineDateForDelivery(DAY.nextMon))).toBe("friday");
    expect(weekdayOfISODate(productionDateForDelivery(DAY.nextMon))).toBe("saturday");
  });

  it("Wednesday delivery: stock due Monday 23:59, produced Tuesday", () => {
    expect(weekdayOfISODate(sendDeadlineDateForDelivery(DAY.wed))).toBe("monday");
    expect(weekdayOfISODate(productionDateForDelivery(DAY.wed))).toBe("tuesday");
  });
});

describe("weekday-level rule", () => {
  const expected: Record<Weekday, [Weekday, Weekday]> = {
    monday: ["friday", "saturday"],
    tuesday: ["sunday", "monday"],
    wednesday: ["monday", "tuesday"],
    thursday: ["tuesday", "wednesday"],
    friday: ["wednesday", "thursday"],
    saturday: ["thursday", "friday"],
    sunday: ["friday", "saturday"],
  };

  it.each(Object.entries(expected) as [Weekday, [Weekday, Weekday]][])("%s", (weekday, [send, production]) => {
    expect(sendWeekdayForDelivery(weekday)).toBe(send);
    expect(productionWeekdayForDelivery(weekday)).toBe(production);
  });
});

describe("deadline instant is 23:59 America/Fortaleza, not UTC", () => {
  it("Wednesday delivery: Monday 23:59 local = Tuesday 02:59 UTC", () => {
    expect(sendDeadlineForDelivery(DAY.wed).toISOString()).toBe("2026-10-06T02:59:00.000Z");
  });

  it("Monday delivery: Friday 23:59 local = Saturday 02:59 UTC", () => {
    expect(sendDeadlineForDelivery(DAY.nextMon).toISOString()).toBe("2026-10-10T02:59:00.000Z");
  });
});

describe("which deliveries are produced when", () => {
  it("produces tomorrow's delivery Mon–Fri", () => {
    expect(deliveryDatesProducedOn(DAY.mon)).toEqual([DAY.tue]);
    expect(deliveryDatesProducedOn(DAY.tue)).toEqual([DAY.wed]);
    expect(deliveryDatesProducedOn(DAY.wed)).toEqual([DAY.thu]);
    expect(deliveryDatesProducedOn(DAY.thu)).toEqual([DAY.fri]);
    expect(deliveryDatesProducedOn(DAY.fri)).toEqual([DAY.sat]);
  });

  it("Saturday produces Sunday's and Monday's deliveries", () => {
    expect(deliveryDatesProducedOn(DAY.sat)).toEqual([DAY.sun, DAY.nextMon]);
  });

  it("Sunday produces nothing", () => {
    expect(deliveryDatesProducedOn(DAY.sun)).toEqual([]);
  });

  it("Monday's delivery stays 'in production' through Sunday", () => {
    expect(deliveryDatesInProduction(DAY.sat)).toEqual([DAY.sun, DAY.nextMon]);
    expect(deliveryDatesInProduction(DAY.sun)).toEqual([DAY.nextMon]);
    expect(deliveryDatesInProduction(DAY.mon)).toEqual([DAY.tue]);
  });
});

describe("nextDeliveryDate", () => {
  it("is always strictly after today", () => {
    expect(nextDeliveryDate(DAY.mon, "monday")).toBe(DAY.nextMon);
    expect(nextDeliveryDate(DAY.mon, "tuesday")).toBe(DAY.tue);
    expect(nextDeliveryDate(DAY.sun, "monday")).toBe(DAY.nextMon);
  });
});

describe("computeCurrentCycle (store form)", () => {
  // 12:00 Fortaleza = 15:00 UTC
  const at = (date: string, hour = 15) => new Date(`${date}T${String(hour).padStart(2, "0")}:00:00Z`);

  it("Monday-route store, on Thursday: stock due this Friday 23:59, for Monday", () => {
    const cycle = computeCurrentCycle(["monday"], at(DAY.thu))!;
    expect(cycle.deliveryDate).toBe(DAY.nextMon);
    expect(cycle.sendDate).toBe(DAY.fri);
    expect(cycle.sendWeekday).toBe("friday");
    expect(cycle.productionDate).toBe(DAY.sat);
    expect(cycle.deadlineTime).toBe("23:59");
    expect(cycle.deadline.toISOString()).toBe("2026-10-10T02:59:00.000Z");
  });

  it("Monday-route store submitting Sunday is still attributed to Monday's cycle (late)", () => {
    const cycle = computeCurrentCycle(["monday"], at(DAY.sun))!;
    expect(cycle.deliveryDate).toBe(DAY.nextMon);
    expect(at(DAY.sun).getTime()).toBeGreaterThan(cycle.deadline.getTime());
  });

  it("uses Fortaleza's calendar day, not UTC's (late-night local submission)", () => {
    // 22:30 Friday in Fortaleza is already Saturday 01:30 UTC
    const cycle = computeCurrentCycle(["wednesday"], new Date("2026-10-10T01:30:00Z"))!;
    expect(cycle.deliveryDate).toBe("2026-10-14"); // next Wednesday after Friday 10-09
  });

  it("store with Wednesday and Saturday routes: picks the soonest delivery", () => {
    const cycle = computeCurrentCycle(["saturday", "wednesday"], at(DAY.mon))!;
    expect(cycle.deliveryDate).toBe(DAY.wed);
    expect(cycle.sendDate).toBe(DAY.mon);
  });

  it("returns null with no delivery days", () => {
    expect(computeCurrentCycle([], at(DAY.mon))).toBeNull();
  });
});
