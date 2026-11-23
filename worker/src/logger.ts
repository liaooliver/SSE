/**
 * R28: the only module allowed to call `console`. Each call writes one JSON line.
 */
type Fields = Readonly<Record<string, string | number | boolean | null>>;

function line(level: string, message: string, fields?: Fields): string {
  return JSON.stringify({ level, message, ...fields });
}

/** R28: debug-level log line. */
export function debug(message: string, fields?: Fields): void {
  console.debug(line("debug", message, fields));
}

/** R28: info-level log line. */
export function info(message: string, fields?: Fields): void {
  console.info(line("info", message, fields));
}

/** R28: warning-level log line. */
export function warn(message: string, fields?: Fields): void {
  console.warn(line("warn", message, fields));
}

/** R28: error-level log line. */
export function error(message: string, fields?: Fields): void {
  console.error(line("error", message, fields));
}
