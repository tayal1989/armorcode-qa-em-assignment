import log4js from 'log4js';
import path from 'path';

// Load log4js configuration from root log4js.json
const configPath = path.resolve(__dirname, '../log4js.json');
log4js.configure(configPath);

// Export active logger instance
export const logger = log4js.getLogger('TestSuite');
export default logger;
