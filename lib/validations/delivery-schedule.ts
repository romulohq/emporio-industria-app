import { z } from "zod";

export const weekdaySchema = z.enum([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);

export const scheduleEntrySchema = z.object({
  store_id: z.string().uuid(),
  weekday: weekdaySchema,
  period: z.enum(["morning", "afternoon"]),
  position: z.number().int().min(0),
});

export const scheduleSchema = z.array(scheduleEntrySchema);

export type ScheduleEntry = z.infer<typeof scheduleEntrySchema>;
