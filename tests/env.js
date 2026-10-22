/* Shared test settings. Override with env vars: CHROME_PATH=/path/to/chrome node tests/t5_ui.js */
const path = require('path');
const { pathToFileURL } = require('url');
module.exports = {
  CHROME: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  URL: pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href,
};
