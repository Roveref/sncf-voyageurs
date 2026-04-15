/**
 * Lightweight logger that is silenced in production.
 * In development, delegates to console.
 */
declare const process: { env: { NODE_ENV?: string } };
const isDev = process.env.NODE_ENV !== "production";

export const logger = {
  warn: (...args: unknown[]): void => {
    isDev && console.warn(...args);
  }, // eslint-disable-line no-console
  error: (...args: unknown[]): void => {
    isDev && console.error(...args);
  }, // eslint-disable-line no-console
  info: (...args: unknown[]): void => {
    isDev && console.log(...args);
  }, // eslint-disable-line no-console
};
