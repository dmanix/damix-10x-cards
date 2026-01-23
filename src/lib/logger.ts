import fs from "node:fs";
import path from "node:path";

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";
export type LogDestination = "console" | "file" | "both" | "none";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 50,
};

const normalizeLevel = (value?: string): LogLevel => {
  const lowered = value?.toLowerCase();
  if (lowered === "debug" || lowered === "info" || lowered === "warn" || lowered === "error" || lowered === "silent") {
    return lowered;
  }

  return "info";
};

const normalizeDestination = (value?: string): LogDestination => {
  const lowered = value?.toLowerCase();
  if (lowered === "console" || lowered === "file" || lowered === "both" || lowered === "none") {
    return lowered;
  }

  return "console";
};

const createFileStream = (filePath: string): fs.WriteStream => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  return fs.createWriteStream(filePath, { flags: "a", encoding: "utf8" });
};

export interface Logger {
  debug: (payload: Record<string, unknown>) => void;
  info: (payload: Record<string, unknown>) => void;
  warn: (payload: Record<string, unknown>) => void;
  error: (payload: Record<string, unknown>) => void;
}

export const createLogger = (options?: {
  level?: LogLevel;
  destination?: LogDestination;
  filePath?: string;
}): Logger => {
  const level = options?.level ?? normalizeLevel(import.meta.env.LOG_LEVEL);
  const destination = options?.destination ?? normalizeDestination(import.meta.env.LOG_OUTPUT);
  const filePath = options?.filePath ?? import.meta.env.LOG_FILE_PATH ?? "./logs/app.log";

  const threshold = LEVEL_ORDER[level];
  const canLog = (value: LogLevel): boolean => LEVEL_ORDER[value] >= threshold;

  let fileStream: fs.WriteStream | null = null;
  if (destination === "file" || destination === "both") {
    try {
      fileStream = createFileStream(filePath);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to open log file stream:", error);
      fileStream = null;
    }
  }

  const writeToFile = (payload: Record<string, unknown>) => {
    if (!fileStream) return;
    try {
      fileStream.write(JSON.stringify(payload) + "\n");
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to write log line to file:", error);
    }
  };

  const log = (
    value: LogLevel,
    payload: Record<string, unknown>,
    consoleMethod: "debug" | "info" | "warn" | "error"
  ) => {
    if (!canLog(value) || destination === "none") return;

    const entry = {
      timestamp: new Date().toISOString(),
      level: value,
      ...payload,
    };

    if (destination === "console" || destination === "both") {
      // eslint-disable-next-line no-console
      console[consoleMethod](entry);
    }

    if (destination === "file" || destination === "both") {
      writeToFile(entry);
    }
  };

  return {
    debug: (payload) => log("debug", payload, "debug"),
    info: (payload) => log("info", payload, "info"),
    warn: (payload) => log("warn", payload, "warn"),
    error: (payload) => log("error", payload, "error"),
  };
};

export const logger = createLogger();
