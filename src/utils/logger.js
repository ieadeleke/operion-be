const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const colors = {
  error: '\x1b[31m', // Red
  warn: '\x1b[33m',  // Yellow
  info: '\x1b[36m',  // Cyan
  debug: '\x1b[35m', // Magenta
  reset: '\x1b[0m',
};

const currentLevel = process.env.LOG_LEVEL || 'debug';

const log = (level, message, ...args) => {
  if (levels[level] <= levels[currentLevel]) {
    const timestamp = new Date().toISOString();
    const color = colors[level];
    const reset = colors.reset;
    const formattedMessage = `${color}[${timestamp}] [${level.toUpperCase()}]${reset} ${message}`;

    if (level === 'error') {
      console.error(formattedMessage, ...args);
    } else {
      console.log(formattedMessage, ...args);
    }
  }
};

module.exports = {
  error: (message, ...args) => log('error', message, ...args),
  warn: (message, ...args) => log('warn', message, ...args),
  info: (message, ...args) => log('info', message, ...args),
  debug: (message, ...args) => log('debug', message, ...args),
};
