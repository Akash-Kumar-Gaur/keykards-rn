/**
 * TEMP — Expo config plugin: immersive fullscreen for Play Store screenshots.
 *
 * Reads SCREENSHOT_MODE from src/lib/screenshotMode.ts. When true, injects
 * WindowInsetsControllerCompat immersive mode into MainActivity and re-applies
 * it on resume / window focus so bars stay hidden during scrcpy capture.
 *
 * Requires a native rebuild after flipping the flag.
 * Delete this plugin + screenshotMode.ts when capture is done.
 */

const fs = require('fs');
const path = require('path');
const { withMainActivity } = require('@expo/config-plugins');

function readScreenshotModeFlag() {
  const file = path.join(__dirname, '../src/lib/screenshotMode.ts');
  const src = fs.readFileSync(file, 'utf8');
  const match = src.match(/export const SCREENSHOT_MODE\s*=\s*(true|false)\s*;/);
  if (!match) {
    throw new Error(
      '[withAndroidScreenshotMode] Could not parse SCREENSHOT_MODE from src/lib/screenshotMode.ts',
    );
  }
  return match[1] === 'true';
}

const SCREENSHOT_MODE = readScreenshotModeFlag();

const MARKER = 'KEYKARDS_SCREENSHOT_MODE';

const IMPORTS = [
  'import androidx.core.view.WindowCompat',
  'import androidx.core.view.WindowInsetsCompat',
  'import androidx.core.view.WindowInsetsControllerCompat',
];

const IMMERSIVE_BLOCK = `
  // BEGIN ${MARKER} — TEMP Play Store screenshots; remove with plugin
  private fun applyScreenshotImmersiveMode() {
    WindowCompat.setDecorFitsSystemWindows(window, false)
    val controller = WindowInsetsControllerCompat(window, window.decorView)
    controller.hide(
      WindowInsetsCompat.Type.statusBars() or WindowInsetsCompat.Type.navigationBars()
    )
    controller.systemBarsBehavior =
      WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
  }

  override fun onResume() {
    super.onResume()
    applyScreenshotImmersiveMode()
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) {
      applyScreenshotImmersiveMode()
    }
  }
  // END ${MARKER}
`;

function ensureImports(contents) {
  const missing = IMPORTS.filter((line) => !contents.includes(line));
  if (missing.length === 0) return contents;
  return contents.replace(/(^package .*$)/m, `$1\n\n${missing.join('\n')}`);
}

function injectOnCreateCall(contents) {
  if (contents.includes(`// ${MARKER} onCreate`)) return contents;

  return contents.replace(
    /(super\.onCreate\([^\)]*\)\s*\n)/,
    `$1    // ${MARKER} onCreate\n    applyScreenshotImmersiveMode()\n`,
  );
}

function injectMethods(contents) {
  if (contents.includes(`BEGIN ${MARKER}`)) return contents;

  const lastBrace = contents.lastIndexOf('}');
  if (lastBrace === -1) return contents;
  return (
    contents.slice(0, lastBrace) + IMMERSIVE_BLOCK + '\n' + contents.slice(lastBrace)
  );
}

function addScreenshotImmersiveKotlin(src) {
  let contents = ensureImports(src);
  contents = injectMethods(contents);
  contents = injectOnCreateCall(contents);
  return contents;
}

module.exports = function withAndroidScreenshotMode(config) {
  if (!SCREENSHOT_MODE) return config;

  return withMainActivity(config, (cfg) => {
    if (cfg.modResults.language !== 'kt') {
      console.warn(
        '[withAndroidScreenshotMode] MainActivity is not Kotlin; screenshot immersive mode skipped.',
      );
      return cfg;
    }
    cfg.modResults.contents = addScreenshotImmersiveKotlin(cfg.modResults.contents);
    return cfg;
  });
};
