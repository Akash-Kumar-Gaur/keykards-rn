/**
 * Expo config plugin: apply FLAG_SECURE to the Android MainActivity.
 *
 * FLAG_SECURE (a) blocks screenshots and screen recording and (b) hides the
 * app's content in the recent-apps (task) switcher. We set it globally at
 * activity creation so protection is always on — not bolted on per-screen.
 *
 * iOS has no equivalent public API to block screenshots; that path is handled
 * at runtime via a screenshot listener + a background blur overlay (see
 * components/security).
 *
 * TEMP: set ENABLED to true before shipping. Requires a native rebuild to take effect.
 */

const { withMainActivity } = require('@expo/config-plugins');

/** Flip to true before release. */
const ENABLED = true;

const IMPORT_LINE = 'import android.view.WindowManager';
const FLAG_SECURE_SNIPPET =
  '    window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)';

function addFlagSecureKotlin(src) {
  let contents = src;

  // 1) Ensure the WindowManager import exists.
  if (!contents.includes(IMPORT_LINE)) {
    contents = contents.replace(
      /(^package .*$)/m,
      `$1\n\n${IMPORT_LINE}`,
    );
  }

  // 2) Inject the FLAG_SECURE call right after super.onCreate(...) inside onCreate.
  if (!contents.includes('FLAG_SECURE')) {
    contents = contents.replace(
      /(super\.onCreate\([^\)]*\)\s*\n)/,
      `$1${FLAG_SECURE_SNIPPET}\n`,
    );
  }

  return contents;
}

module.exports = function withAndroidFlagSecure(config) {
  if (!ENABLED) return config;

  return withMainActivity(config, (cfg) => {
    if (cfg.modResults.language === 'kt') {
      cfg.modResults.contents = addFlagSecureKotlin(cfg.modResults.contents);
    } else {
      // Java fallback (older templates).
      let contents = cfg.modResults.contents;
      if (!contents.includes('import android.view.WindowManager;')) {
        contents = contents.replace(
          /(^package .*;$)/m,
          '$1\n\nimport android.view.WindowManager;',
        );
      }
      if (!contents.includes('FLAG_SECURE')) {
        contents = contents.replace(
          /(super\.onCreate\([^\)]*\);\s*\n)/,
          '$1    getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);\n',
        );
      }
      cfg.modResults.contents = contents;
    }
    return cfg;
  });
};
