// Only missing schema resources permit compatibility reads. Permission errors never do.
export function missingSchema(error: { code?: string } | null | undefined) {
  return Boolean(error && ["PGRST202", "PGRST204", "PGRST205", "42883", "42703", "42P01"].includes(error.code ?? ""));
}
