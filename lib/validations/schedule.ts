import { z } from "zod";

const weekStart = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const setCellSchema = z.object({
  week_start: weekStart,
  item_id: z.string().uuid(),
  weekday: z.number().int().min(1).max(5),
  label: z.string().trim().max(60),
});

export const toggleHolidaySchema = z.object({
  week_start: weekStart,
  weekday: z.number().int().min(1).max(5),
});

export const saveNotesSchema = z.object({
  week_start: weekStart,
  notes: z.string().max(2000),
});

export const copyWeekSchema = z.object({ week_start: weekStart });

export const addItemSchema = z.object({
  section: z.enum(["salgados", "folheados", "paes", "cozinha"]),
  name: z.string().trim().min(2, "Informe o nome").max(80),
});

export const renameItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2, "Informe o nome").max(80),
});

export const itemIdSchema = z.object({ id: z.string().uuid() });

export const moveItemSchema = z.object({
  id: z.string().uuid(),
  direction: z.enum(["up", "down"]),
});
