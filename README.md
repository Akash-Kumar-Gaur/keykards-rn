# InWallet

Card-intelligence app for India. Know which card to swipe next.

This repository currently contains **Phase 1**: Expo + TypeScript foundation,
design system, Supabase email auth, on-device encryption core, biometric gate,
screenshot/background protection, and the animated Home dashboard shell.

Card storage / Vault UI, real recommendation logic, and live totals arrive in
later phases. Everything on Home today is placeholder / mock data.

## Stack

- Expo (managed, EAS Build ready) + TypeScript + expo-router
- Supabase (auth + Postgres) — session tokens in `expo-secure-store`
- AES-256-GCM client-side encryption (`lib/crypto`) via WebCrypto /
  `react-native-quick-crypto`, with the data key only in SecureStore
- `expo-local-authentication` biometric / passcode gate
- `react-native-reanimated` for all animation
- Zustand (client) + TanStack Query (server)

## Getting started

```bash
cd keykards-rn
npm install
cp .env.example .env
# Fill EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY
```

### Development build (required)

InWallet needs a **custom dev client** — Expo Go is not enough (FLAG_SECURE,
`react-native-quick-crypto`, SecureStore-backed crypto).

1. Build the Android APK on EAS (you're on Windows; iOS needs a Mac or EAS iOS):

```bash
npm run build:dev:android
# or: eas build --profile development --platform android
```

2. Install the APK on your device/emulator from the Expo dashboard link.

3. Start Metro pointed at the dev client:

```bash
npm start
# = expo start --dev-client
```

4. Open the InWallet app on the device — it will connect to Metro.

Local native alternative (needs Android Studio / Xcode):

```bash
npx expo run:android   # or npx expo run:ios on macOS
```

### Auth / database

1. Create a Supabase project (or use the one already linked via the MCP).
2. Apply the migration in `supabase/migrations/0001_init_profiles.sql`
   (SQL editor, or `supabase db push`, or the MCP `apply_migration` tool).
   RLS is enabled on `profiles` in that same migration.
3. Put the project URL + **anon** key in `.env`. Never put the service-role
   key in the client.

### Native modules that need a dev build

These do **not** work in Expo Go — you need an EAS development build
(`eas build --profile development`) to exercise them on a device:

- Android `FLAG_SECURE` (config plugin `plugins/withAndroidFlagSecure.js`)
- `react-native-quick-crypto` (used by `encryptField` / `decryptField`)
- Full SecureStore / biometric behavior is available in Expo Go on device,
  but the crypto polyfill is not

You can still run the animated Home dashboard, auth UI, and biometric gate in
Expo Go; encryption APIs are unit-tested under Node and are not called from
any UI yet.

```bash
npm test          # crypto + redaction unit tests (Node WebCrypto)
npm run typecheck # tsc --noEmit
```

## Project layout

```
src/
  app/                  # expo-router screens (tabs + sign-in modal)
  components/
    home/               # Hero, SmartSwipeCard, StatTile, Milestone, CTA
    security/           # SecurityLayer, AppLockGate
    ui/                 # GlassCard, PillButton, Toggle, ProgressBar, …
  lib/
    crypto/             # AES-256-GCM core (unit-tested) + device wrapper
    redaction.ts        # Scrubs PAN / CVV / token shapes before any log
    supabase.ts         # Client with SecureStore session adapter
    biometrics.ts
    secureStore.ts
  stores/               # auth, appLock, sensitive (ephemeral, auto-clears)
  theme/                # Design tokens — NO hardcoded hex in components
plugins/
  withAndroidFlagSecure.js
supabase/migrations/
  0001_init_profiles.sql
```

## Security notes (Phase 1)

- Per-user AES data key lives **only** in SecureStore — never Supabase, never
  a persisted Zustand store.
- `decryptField` requires a fresh biometric check every call.
- Decrypted plaintext is held only in `useSensitiveStore`, which auto-clears
  after ~10s and on every app background.
- All logging goes through `lib/logger` → `lib/redaction`.
- Android: `FLAG_SECURE` applied globally via config plugin.
- iOS: screenshot listener shows a notice; full-screen blur overlay on
  background. (iOS has no public API to block screenshots.)

## What's intentionally NOT built yet

- Card storage / Vault UI / card-detail reveal
- Real Smart Swipe recommendation logic
- Live points / fees / milestone / warranties / subscriptions data
