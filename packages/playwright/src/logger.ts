import winston from "winston";

export type LogLevel = "debug" | "info" | "warn" | "error";

let currentLogger: winston.Logger | null = null;

export interface CreateLoggerOptions {
  level: LogLevel;
}

export function createLogger(options: CreateLoggerOptions): winston.Logger {
  const logger = winston.createLogger({
    level: options.level,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        ),
      }),
    ],
  });

  currentLogger = logger;
  return logger;
}

export function getLogger(): winston.Logger {
  if (!currentLogger) {
    // Default to info level if not initialized
    currentLogger = createLogger({ level: "info" });
  }
  return currentLogger;
}

export function setLogger(logger: winston.Logger): void {
  currentLogger = logger;
}
