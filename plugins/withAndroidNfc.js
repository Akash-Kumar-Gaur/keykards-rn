/**
 * Expo config plugin — Android NFC only.
 *
 * Adds NFC permission + optional hardware feature so the app still installs on
 * phones without NFC. Intentionally does NOT touch iOS NFC entitlements —
 * Core NFC payment-card reader sessions need a separate Apple approval we are
 * not requesting for v1.
 */

const {
  AndroidConfig,
  withAndroidManifest,
} = require('@expo/config-plugins');

function ensureUsesFeature(androidManifest, name, required) {
  if (!androidManifest.manifest['uses-feature']) {
    androidManifest.manifest['uses-feature'] = [];
  }
  const features = androidManifest.manifest['uses-feature'];
  const exists = features.some(
    (f) => f.$ && f.$['android:name'] === name,
  );
  if (!exists) {
    features.push({
      $: {
        'android:name': name,
        'android:required': required ? 'true' : 'false',
      },
    });
  }
  return androidManifest;
}

function withAndroidNfc(config) {
  config = AndroidConfig.Permissions.withPermissions(config, [
    'android.permission.NFC',
  ]);

  return withAndroidManifest(config, (cfg) => {
    cfg.modResults = ensureUsesFeature(
      cfg.modResults,
      'android.hardware.nfc',
      false,
    );
    return cfg;
  });
}

module.exports = withAndroidNfc;
