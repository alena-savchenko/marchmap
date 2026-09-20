# Android incoming-file regression fixture

This tiny APK sends real Android intents and grants private content URI access to MarchMap. It is a test fixture, never part of the shipped app. No third-party libraries or cloud credentials are needed.

Run `./tests/android-incoming/Build-Fixture.ps1` after Expo prebuild, then install `artifacts/intent-fixture/fixture.apk` on a test emulator using adb.

For each scenario, launch:

```powershell
adb shell am start -n com.marchmap.intentfixture/.Sender --es scenario clip
```

Scenarios:

- `normal`: VIEW with data URI and a GPX filename.
- `clip`: VIEW with **only ClipData**, no data URI. MarchMap 1.3.0 silently ignored this input.
- `mixed`: a preview URL in data plus a granted GPX in ClipData; the actual file takes precedence.
- `send`: SEND with EXTRA_STREAM and ClipData.
- `opaque`: valid GPX with an extensionless cloud object name.
- `queryerror`: metadata query throws, but reading the GPX stream is permitted.
- `invalid`: HTML instead of GPX; must show an error and preserve the active route.

Expected successful route title: `Incoming-<scenario>`. Test both after `adb shell am force-stop com.marchmap.standalone` and while MarchMap is running. Verify the route persists after another force-stop and ordinary launcher start. No Metro should be running.

These synthetic provider tests cover Android transport, not OneDrive's authenticated UI or its current server responses.
