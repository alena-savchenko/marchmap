<p align="center">
  <img src="assets/brand-symbol.png" alt="MarchMap logo" width="96" />
</p>

# MarchMap

**Your route, map, and elevation profile on one screen.**

MarchMap is an Android app for exploring GPX routes and preparing offline maps for hikes. Browse points on the map and elevation profile, locate yourself along the route, and see how much distance and elevation remain before the summit of a significant climb.

The interface supports **English, German, and Russian**, with light, dark, and system themes. GPX files are processed on your device. No account or MarchMap backend is required.

## Features

- **Connected map and elevation profile:** tap the route or scrub the profile to select a point and update its details.
- **Local route library:** import, switch between, and delete routes. The last active route is restored when the app starts.
- **Offline maps:** download the route area in advance, with preparation status, progress, size, and retry controls.
- **Route position:** view distance from the start and to the finish. Your GPS position stays independent of the point selected for browsing.
- **Summit progress:** see remaining distance and elevation gain on significant climbs, with adjustable detection sensitivity.
- **Android file integration:** import GPX files through Open with and Share.
- **Map and cache cleanup** without deleting saved GPX routes.
- **Compass:** reset the map to north-up.

## Getting started

1. Tap **+** in the top-right corner and choose a GPX file. Try the [sample Berlin route](samples/berlin.gpx).
2. In offline or hybrid mode, wait until map preparation is **Ready**. Keep the app open while downloading.
3. Tap the location icon to get your GPS position. Location permission is requested when you use this feature.
4. Tap the map or scrub the elevation profile. The orange point is your selection; the blue point is your GPS position.
5. Open your route library using the folder icon. Map mode, language, theme, and climb sensitivity are available in settings.

GPS updates **when you tap the location button**. Continuous or background tracking, track recording, and turn-by-turn navigation are not currently supported.

### Map modes

| Mode | Preparation on import | While browsing |
| --- | --- | --- |
| Offline only | Downloads the route area | Basemap network access is disabled after preparation finishes or fails. Areas outside the downloaded region may be blank. |
| **Offline + online fallback** — default | Downloads the route area | The saved region remains available offline; other areas load when an internet connection is available. |
| Online only | No advance download | Map data loads as you browse. Existing cached data is not automatically deleted. |

Your choice persists between launches and does not remove the route. Downloads cover the route's bounding box with a 0.01° margin at zoom levels 0–14. The displayed size describes the package resources, not the entire map database.

Clearing all downloaded maps and cache keeps your GPX library intact. To prepare maps again, retry the download or import a new route. Browsing in hybrid or online mode will populate the normal cache again.

### Significant climbs

Climbs are calculated from **the original GPX elevations**, not GPS altitude. Analysis runs when the route model is built; GPS updates and point selection do not repeat it.

Choose high, medium (default), low, or custom sensitivity. In custom mode, a reference grade and distance define a difficulty threshold: steeper climbs can be shorter, while gentler climbs need to be longer. For example, 6% over 800 m gives a threshold of `0.8 × 6² = 28.8`.

The summit card appears when your GPS position is on the current climb and more than 100 m of distance and 10 m of elevation gain remain. Selecting a point on the profile does not affect it. Parameters live in [src/config/climbs.ts](src/config/climbs.ts); the implementation is in [src/services/climbs.ts](src/services/climbs.ts).

## Supported files and limitations

- GPX files up to **25 MiB**, using `trk / trkseg / trkpt`, including multiple tracks, segments, and XML namespaces. GPX routes (`rte`) and standalone waypoints are not currently imported.
- Gaps between segments are not connected. Missing elevations are not replaced with GPS altitude and split climb analysis into separate sections.
- Invalid formats or malformed data produce an error and leave the previous route intact.
- GPS snaps to the route within 30 m. At self-intersections, an equally close section may be selected because movement history is not tracked.
- Offline map preparation does not support regions beyond ±85° latitude or routes crossing the antimeridian.
- **OneDrive support is experimental:** a shared link opens a page inside the app; tap Download on the OneDrive page to import the file. The complete Android WebView flow has not yet been confirmed on a physical phone. As a workaround, download the GPX first and import it using **+**.
- Development and testing target Android. iOS and web support are not currently claimed.

## Development

Built with **Expo SDK 57 · React Native 0.86 · React 19 · TypeScript 6 · MapLibre Native · Turf · SVG**.

You will need Node.js 22.13+ (tested with 24.14), npm, JDK 21, the Android SDK, and an emulator or Android device with USB debugging enabled. Install the Android toolchain through Android Studio and configure `JAVA_HOME` and `ANDROID_HOME` for your environment.

```sh
git clone https://github.com/alena-savchenko/marchmap.git
cd marchmap
npm ci
npm run android
```

For a physical device, use `npm run android:device`. To start Metro separately, run `npm start`.

**Expo Go is not supported:** the app uses MapLibre and a custom native import module. Debug builds require Metro; standalone release APKs include the JavaScript bundle and run without Metro.

### Build a standalone APK for testing

Example for Windows PowerShell after installing dependencies:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
npm run prebuild
$env:NODE_ENV = 'production'
Set-Location android
.\gradlew.bat :app:assembleRelease '-PreactNativeArchitectures=arm64-v8a,x86_64' '-Dorg.gradle.jvmargs=-Xmx3072m -XX:MaxMetaspaceSize=1536m -Dfile.encoding=UTF-8' --console=plain --max-workers=2
```

Output: `android/app/build/outputs/apk/release/app-release.apk`. This builds for ARM64 phones and x86_64 emulators. APKs and build directories are not committed to Git.

The current version is **1.3.1**, with Android package `com.marchmap.standalone`. Test release builds use the default Expo template signing key. Google Play publication requires a dedicated signing setup and production build; the app has not yet been published to the store.

[eas.json](eas.json) also includes a `preview` profile for standalone APKs (`developmentClient: false`). Configure your own EAS project and credentials before using it.

The `android/` and `ios/` directories are generated and excluded from Git. Put lasting native changes in config plugins or local modules so they survive prebuild.

### Validation

Run from the project root:

```sh
npm run typecheck
npm run lint
npm test
node scripts/climb-report.cjs
```

Tests cover GPX validation, route geometry and segment gaps, GPS snapping, climbs, the route library, settings, translations, and offline map management. The climb report uses sample GPX files and a synthetic route with 10,001 points; timings are measured in Node.js, not on a phone.

Version 1.3.1 passed typecheck, lint, **132 unit tests**, and the Android release build. Android VIEW/SEND, ClipData, invalid files, and cloud import cancellation were checked on an API 35 emulator. The OneDrive verification limitation is described above.

A separate [Android test provider](tests/android-incoming/README.md) is available for file handoff checks. Test standalone APKs without Metro, verify route restoration after restarting, and check downloaded maps with Wi-Fi and mobile data disabled.

### Project structure

| Path | Purpose |
| --- | --- |
| [src/screens](src/screens) | Main screen and feature integration |
| [src/components](src/components) | Map, profile, library, settings, and cards |
| [src/models/route.ts](src/models/route.ts) | Route model |
| [src/services](src/services) | GPX, geometry, climbs, storage, GPS, and offline maps |
| [src/i18n](src/i18n) | English, German, and Russian translations and formatting |
| [src/theme](src/theme) | Interface themes and map styling |
| [modules/marchmap-incoming](modules/marchmap-incoming) | Android file import and OneDrive WebView |
| [plugins/withIncomingIntent.js](plugins/withIncomingIntent.js) | Incoming Android Intent handling |
| [samples](samples) | Sample GPX files |

The original logo is [assets/logo.png](assets/logo.png). Regenerate derived icons and symbols with `python scripts/prepare_brand.py` after installing Pillow.

Implementation details and earlier verification records are preserved in the [development notes archive](docs/development-notes.md), currently in Russian. Those notes describe individual historical versions; this README describes current capabilities and limitations.

## Data and licenses

GPX files and settings are stored in the app's private local storage. GPS position is kept in memory only; no background location history is recorded. Map downloads contact the map provider, and opening cloud links contacts the corresponding service.

Maps use OpenFreeMap Liberty and OpenStreetMap / OpenMapTiles data. Attribution is available on the map. Original style and resource licenses are preserved in [licenses/OpenFreeMap.md](licenses/OpenFreeMap.md) and [licenses/OSM-Liberty.md](licenses/OSM-Liberty.md). The dark palette has been modified for MarchMap.

The repository retains the [MIT license from the original Expo template](LICENSE). Third-party map data, styles, and dependencies have their own licensing terms.
