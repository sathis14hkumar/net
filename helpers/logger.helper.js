const winston = require('winston');

require('winston-daily-rotate-file');

const logFile = 'backend';
const dateFormat = () => new Date(Date.now()).toUTCString();

const logger = winston.createLogger({
  transports: [
    new winston.transports.Console(),
    new winston.transports.DailyRotateFile({
      filename: `./logs/${logFile}-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
    }),
  ],
  format: winston.format.combine(
    winston.format.printf((info) => {
      let message = `${dateFormat()} | ${info.level.toUpperCase()} | ${logFile}.log | ${
        info.message
      } | `;

      message = info.obj
        ? `${message}data:${JSON.stringify(info.obj)} | `
        : message;
      return message;
    }),
    winston.format.colorize(),
  ),
});
const errorLogger = winston.createLogger({
  transports: [
    new winston.transports.Console(),
    new winston.transports.DailyRotateFile({
      filename: `./logs/${logFile}_Error-%DATE%.log`,
      datePattern: 'YYYY-MM-DD-HH',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
    }),
  ],
  format: winston.format.combine(
    winston.format.printf((info) => {
      let message = `${dateFormat()} | ${info.level.toUpperCase()} | ${logFile}.log | ${
        info.message
      } | `;

      message = info.obj
        ? `${message}data:${JSON.stringify(info.obj)} | `
        : message;
      return message;
    }),
    winston.format.colorize(),
  ),
});

const logError = (message, obj) => {
  errorLogger.log('error', message, { obj });
};

const logInfo = (message, obj) => {
  logger.log('info', message, { obj });
};
const logDebug = (message, obj) => {
  logger.log('debug', message, { obj });
};

module.exports = {
  logError,
  logInfo,
  logDebug,
};
