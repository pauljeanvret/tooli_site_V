export function isValidSupabaseProjectUrl(value: string | undefined) {
  const raw = (value || "").trim();

  if (!raw) return false;
  if (raw.includes("supabase.com/dashboard")) return false;
  if (raw.includes("/project/")) return false;

  try {
    const url = new URL(raw);
    return url.protocol === "https:" && url.hostname.endsWith(".supabase.co");
  } catch {
    return false;
  }
}

export function getSupabaseHost(value: string | undefined) {
  const raw = (value || '').trim()

  try {
    return new URL(raw).hostname
  } catch {
    return ''
  }
}
