export declare enum LogLevel {
    NONE = 0,
    ERROR = 1,
    WARN = 2,
    INFO = 3,
    DEBUG = 4,
    ALL = 99
}
/**
 * Singleton logger utility.
 *
 * Allows enabling or disabling specific log levels (`ERROR`, `WARN`, `INFO`, `DEBUG`)
 * at runtime. Supports logging with tags and message arguments.
 *
 * Usage:
 * ```ts
 * const logger = Logger.getInstance();
 * logger.setLogLevels(LogLevel.ERROR, LogLevel.INFO);
 * logger.error('MyTag', 'An error occurred');
 * ```
 */
export declare class Logger {
    private static instance;
    private currentLogLevels;
    static getInstance(): Logger;
    /**
     * Sets the active log levels.
     * Call with LogLevel.NONE or no arguments to turn off all logging.
     * Otherwise, specify one or more log levels to be active.
     * Use LogLevel.ALL to enable all log levels.
     */
    setLogLevels(...levels: LogLevel[]): void;
    /**
     * Gets the current set of active log levels.
     * @returns A new Set containing the active LogLevel enums.
     */
    getLogLevels(): Set<LogLevel>;
    private log;
    error(tag: string, ...messages: any[]): void;
    warn(tag: string, ...messages: any[]): void;
    info(tag: string, ...messages: any[]): void;
    debug(tag: string, ...messages: any[]): void;
}
