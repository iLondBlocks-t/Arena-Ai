# Median/GoNative Android overlay — source-only patch

## What was actually in this repository

The repository contains **only `app-release.apk`** (about 6.4 MB); it has no Gradle project, Android source, website source, or backend/API client source. APK inspection shows a Median/GoNative wrapper (`assets/GoNativeJSBridgeLibrary.js`) configured to open `https://arena.ai/`. The Median-provided `customCSS.css` and `customJS.js` slots are empty. The Android splash is enabled. The web application and AI service are remote, so their model, streaming, authentication, and conversation implementations cannot safely be rewritten or tested from this checkout.

That means a genuine native chat rewrite, reliable backend-preserving API integration, device profiling, and an installable replacement APK are **not possible from the available materials**. Replacing the site with a fabricated native chat would discard the real product/backend, so this patch deliberately does not do that. The supplied APK's signing key is also absent; a rebuilt APK signed with a different key would not update an existing installation and may require uninstalling it (potentially losing local app data).

## Implemented here

- `customCSS.css` and `customJS.js`: restrained WebView-level Android touch feedback, reduced-motion support, viewport/keyboard awareness, and conditional editor visibility. They do not replace app layout, intercept/delay clicks, issue network requests, or alter chat behavior.
- `patch_apk.py`: safely creates a **new, unsigned** patched APK, turns off the Median wrapper's Android splash and sidebar branding, preserves the configured Arena URL and all other config, replaces only the two custom injection assets, and removes stale v1 signature files. The original APK is never overwritten.
- `test_patch_apk.py`: regression tests for launch/config preservation, overlay inclusion, signature removal, and non-destructive behavior.

These are WebView enhancements, **not native Android UI components**. The change cannot control or guarantee Arena's web DOM behavior; it should be validated against the live web app on target devices before release.

## Verify the source patch

From the repository root:

```sh
python3 -m unittest discover -s android-overlay -p 'test_*.py' -v
```

To produce a patched unsigned archive (this is not installable as-is):

```sh
python3 android-overlay/patch_apk.py app-release.apk /tmp/arena-patched-unsigned.apk
```

## Signing/build requirements for a real release

Use the original Android project / Median build pipeline and the **original release signing key** to produce a compatible upgrade. The original source project and signing key are not in this repository. If only an APK is available, platform tools can align and sign a package, but signing with a newly generated key creates a different signer and will not be an in-place update. Example commands for an owner who has the matching key and Android Build Tools installed:

```sh
zipalign -f -v 4 /tmp/arena-patched-unsigned.apk /tmp/arena-patched-aligned.apk
apksigner sign --ks /secure/path/original-release.jks \
  --out /tmp/arena-patched-release.apk /tmp/arena-patched-aligned.apk
apksigner verify --verbose /tmp/arena-patched-release.apk
```

This checkout's environment does not contain Java, Android SDK/Build Tools, Gradle, an emulator, or a device bridge. Accordingly, no APK was rebuilt, signed, installed, or runtime-tested here. Do not treat the unsigned output as a deliverable APK.
