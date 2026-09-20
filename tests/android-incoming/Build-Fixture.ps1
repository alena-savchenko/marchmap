param(
  [string]$Sdk = "$env:LOCALAPPDATA/Android/Sdk",
  [string]$Jdk = 'C:/Program Files/Android/Android Studio/jbr'
)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path "$PSScriptRoot/../..").Path
$out = "$root/artifacts/intent-fixture"
$buildTools = "$Sdk/build-tools/36.0.0"
$androidJar = "$Sdk/platforms/android-36/android.jar"
New-Item -ItemType Directory -Force "$out/classes", "$out/dex" | Out-Null
& "$Jdk/bin/javac.exe" -source 8 -target 8 -classpath $androidJar -d "$out/classes" "$PSScriptRoot/Sender.java" "$PSScriptRoot/Provider.java"
if ($LASTEXITCODE) { throw 'javac failed' }
& "$Jdk/bin/jar.exe" cf "$out/classes.jar" -C "$out/classes" .
$env:JAVA_HOME = $Jdk
& "$buildTools/d8.bat" --lib $androidJar --output "$out/dex" "$out/classes.jar"
if ($LASTEXITCODE) { throw 'd8 failed' }
& "$buildTools/aapt.exe" package -f -M "$PSScriptRoot/AndroidManifest.xml" -I $androidJar -F "$out/unsigned.apk"
if ($LASTEXITCODE) { throw 'aapt failed' }
Push-Location "$out/dex"
try { & "$buildTools/aapt.exe" add "$out/unsigned.apk" classes.dex } finally { Pop-Location }
if ($LASTEXITCODE) { throw 'aapt add failed' }
& "$buildTools/zipalign.exe" -f 4 "$out/unsigned.apk" "$out/aligned.apk"
if ($LASTEXITCODE) { throw 'zipalign failed' }
& "$buildTools/apksigner.bat" sign --ks "$root/android/app/debug.keystore" --ks-pass pass:android --key-pass pass:android --out "$out/fixture.apk" "$out/aligned.apk"
if ($LASTEXITCODE) { throw 'apksigner failed' }
Write-Output "$out/fixture.apk"
