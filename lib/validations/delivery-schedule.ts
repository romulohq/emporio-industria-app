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

export const deadlineEntrySchema = z.object({
  weekday: weekdaySchema,
  send_weekday: weekdaySchema,
  deadline_time: z.string().regex(/^\d{2}:\d{2}$/, "Horário inválido"),
  is_custom: z.boolean(),
});

export const deadlineScheduleSchema = z.object({
  store_id: z.string().uuid(),
  entries: z.array(deadlineEntrySchema),
});

export type DeadlineEntry = z.infer<typeof deadlineEntrySchema>;

export const routeImpactGroupSchema = z.object({
  sector_id: z.string().uuid(),
  delivery_date: z.string().min(1),
});

export type RouteImpactGroup = z.infer<typeof routeImpactGroupSchema>;

export const applyRouteImpactSchema = z.object({
  unit_id: z.string().uuid(),
  sector_ids: z.array(z.string().uuid()).min(1),
  delivery_dates: z.array(z.string().min(1)).min(1),
});
