const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const defaults = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(defaults) ? defaults : defaults ? [defaults] : []),
  /[/\\]\.npm-cache[/\\].*/,
  /[/\\]\.gradle[/\\].*/,
  /[/\\]artifacts[/\\].*/,
];

module.exports = config;
