export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";
export type LogDestination = "console" | "file" | "both" | "none";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 50,
};

/**
 * Normalizes a string value to a LogLevel.
 * @param value The string value to normalize.
 * @returns A LogLevel based on the input, or "info" if the input is invalid.
 */
const normalizeLevel = (value?: string): LogLevel => {
  const lowered = value?.toLowerCase();
  if (lowered === "debug" || lowered === "info" || lowered === "warn" || lowered === "error" || lowered === "silent") {
    return lowered;
  }

  return "info";
};

/**
 * Normalizes a string value to a LogDestination.
 * @param value The string value to normalize.
 * @returns A LogDestination based on the input, or "console" if the input is invalid.
 */
const normalizeDestination = (value?: string): LogDestination => {
  const lowered = value?.toLowerCase();
  if (lowered === "console" || lowered === "file" || lowered === "both" || lowered === "none") {
    return lowered;
  }

  return "console";
};

const isNodeRuntime = typeof process !== "undefined" && Boolean(process.versions?.node);
const isCloudflareRuntime =
  typeof navigator !== "undefined" &&
  typeof navigator.userAgent === "string" &&
  navigator.userAgent.includes("Cloudflare-Workers");

/**
 * Opens a file stream for writing logs. Only available in Node.js runtime.
 * @param filePath The path to the log file.
 * @returns A promise that resolves to a file stream, or null if the stream cannot be opened.
 */
const openFileStream = async (filePath: string) => {
  if (!isNodeRuntime || isCloudflareRuntime) return null;
  try {
    const [fsModule, pathModule] = await Promise.all([import("node:fs"), import("node:path")]);
    fsModule.mkdirSync(pathModule.dirname(filePath), { recursive: true });
    return fsModule.createWriteStream(filePath, { flags: "a", encoding: "utf8" });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "EPERM") {
      return null;
    }
    // eslint-disable-next-line no-console
    console.error("Failed to open log file stream:", error);
    return null;
  }
};

export interface Logger {
  debug: (payload: Record<string, unknown>) => void;
  info: (payload: Record<string, unknown>) => void;
  warn: (payload: Record<string, unknown>) => void;
  error: (payload: Record<string, unknown>) => void;
}

/**
 * Reads an environment variable from `import.meta.env` (if available) or `process.env`.
 * @param key The name of the environment variable to read.
 * @returns The value of the environment variable, or undefined if it is not set.
 */
const readEnv = (key: string): string | undefined => {
  // In Astro/Vite runtime we have import.meta.env; in Node scripts (e.g. Playwright teardown) we don't.
  const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  if (metaEnv && key in metaEnv) return metaEnv[key];
  return typeof process !== "undefined" ? process.env[key] : undefined;
};

/**
 * Creates a logger instance with the specified options.
 * @param options The logger options.
 * @returns A logger instance.
 */
export const createLogger = (options?: {
  level?: LogLevel;
  destination?: LogDestination;
  filePath?: string;
}): Logger => {
  const level = options?.level ?? normalizeLevel(readEnv("LOG_LEVEL"));
  const requestedDestination = options?.destination ?? normalizeDestination(readEnv("LOG_OUTPUT"));
  const filePath = options?.filePath ?? readEnv("LOG_FILE_PATH") ?? "./logs/app.log";
  const destination =
    (!isNodeRuntime || isCloudflareRuntime) && (requestedDestination === "file" || requestedDestination === "both")
      ? "console"
      : requestedDestination;

  const threshold = LEVEL_ORDER[level];
  const canLog = (value: LogLevel): boolean => LEVEL_ORDER[value] >= threshold;

  let fileStreamPromise: ReturnType<typeof openFileStream> | null = null;

  /**
   * Writes a log payload to the log file.
   * @param payload The log payload to write.
   */
  const writeToFile = (payload: Record<string, unknown>) => {
    if (destination !== "file" && destination !== "both") return;
    if (!fileStreamPromise) {
      fileStreamPromise = openFileStream(filePath);
    }
    void fileStreamPromise.then((fileStream) => {
      if (!fileStream) return;
      try {
        fileStream.write(JSON.stringify(payload) + "\n");
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to write log line to file:", error);
      }
    });
  };

  /**
   * Logs a message to the console and/or a file.
   * @param value The log level.
   * @param payload The log payload.
   * @param consoleMethod The console method to use.
   */
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