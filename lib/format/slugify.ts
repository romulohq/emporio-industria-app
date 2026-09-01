export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(new RegExp("[" + String.fromCharCode(0x300) + "-" + String.fromCharCode(0x36f) + "]", "g"), "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
