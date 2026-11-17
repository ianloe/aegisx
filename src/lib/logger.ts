type LogLevel = "info" | "warn" | "error";

export function log(level: LogLevel, msg: string, meta?: Record<string, unknown>) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...(meta ?? {}),
  };
  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
  } else {
    console.log(line);
  }
}
