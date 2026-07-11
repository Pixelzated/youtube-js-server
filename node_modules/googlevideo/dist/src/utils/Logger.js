export const LogLevel = {
    NONE: 0, 0: "NONE",
    ERROR: 1, 1: "ERROR",
    WARN: 2, 2: "WARN",
    INFO: 3, 3: "INFO",
    DEBUG: 4, 4: "DEBUG",
    ALL: 99, 99: "ALL"
};
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
export class Logger {
    constructor() {
        this.currentLogLevels = new Set([LogLevel.INFO, LogLevel.ERROR]);
    }
    static getInstance() {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }
    /**
     * Sets the active log levels.
     * Call with LogLevel.NONE or no arguments to turn off all logging.
     * Otherwise, specify one or more log levels to be active.
     * Use LogLevel.ALL to enable all log levels.
     */
    setLogLevels(...levels) {
        if (levels.length === 0 || levels.includes(LogLevel.NONE)) {
            this.currentLogLevels = new Set(); // Turn off logging
        }
        else if (levels.includes(LogLevel.ALL)) {
            this.currentLogLevels = new Set([
                LogLevel.ERROR,
                LogLevel.WARN,
                LogLevel.INFO,
                LogLevel.DEBUG
            ]);
        }
        else {
            this.currentLogLevels = new Set(levels.filter((level) => level !== LogLevel.NONE && level !== LogLevel.ALL));
        }
    }
    /**
     * Gets the current set of active log levels.
     * @returns A new Set containing the active LogLevel enums.
     */
    getLogLevels() {
        return new Set(this.currentLogLevels);
    }
    log(level, tag, ...messages) {
        if (level !== LogLevel.NONE && this.currentLogLevels.has(level)) {
            const prefix = `[${LogLevel[level]}] [${tag}]`;
            switch (level) {
                case LogLevel.ERROR:
                    console.error(prefix, ...messages);
                    break;
                case LogLevel.WARN:
                    console.warn(prefix, ...messages);
                    break;
                case LogLevel.INFO:
                    console.info(prefix, ...messages);
                    break;
                case LogLevel.DEBUG:
                    console.debug(prefix, ...messages);
                    break;
            }
        }
    }
    error(tag, ...messages) {
        this.log(LogLevel.ERROR, tag, ...messages);
    }
    warn(tag, ...messages) {
        this.log(LogLevel.WARN, tag, ...messages);
    }
    info(tag, ...messages) {
        this.log(LogLevel.INFO, tag, ...messages);
    }
    debug(tag, ...messages) {
        this.log(LogLevel.DEBUG, tag, ...messages);
    }
}
//# sourceMappingURL=Logger.js.map