const { withMainActivity } = require('expo/config-plugins');

// Expo/RN can receive a second VIEW while the React runtime is still starting.
// Preserve it on the Activity so takeFile can recover it even before OnNewIntent subscribes.
module.exports = function withIncomingIntent(config) {
  return withMainActivity(config, config => {
    const marker = '// MarchMap incoming intent recovery';
    if (!config.modResults.contents.includes(marker)) {
      config.modResults.contents = config.modResults.contents.replace(
        'class MainActivity : ReactActivity() {',
        `class MainActivity : ReactActivity() {
  ${marker}
  override fun onNewIntent(intent: android.content.Intent) {
    setIntent(intent)
    super.onNewIntent(intent)
  }
`);
      if (!config.modResults.contents.includes(marker)) throw new Error('Cannot install MarchMap incoming intent recovery');
    }
    return config;
  });
};
