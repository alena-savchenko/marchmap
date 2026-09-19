# MarchMap

Android-first GPX viewer: React Native 0.86, TypeScript, Expo SDK 57, MapLibre Native 11, Turf, SVG. GPX разбирается локально; сервера приложения, аккаунтов, записи трека и фонового слежения нет.

## Установка

Нужны Node.js 22.13+ (проверено на 24.14), Android Studio, Android SDK и JDK 21 (можно bundled `jbr` Android Studio). Expo Go **не поддерживается**: MapLibre требует development build, см. [документацию MapLibre](https://maplibre.org/maplibre-react-native/docs/setup/expo/).

```powershell
cd C:\work\MarchMap
npm ci
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator;$env:Path"
```

SDK/NDK/Build Tools версии выбирает Expo/Gradle. На первом запуске нужны интернет и принятые Android SDK licenses. `package-lock.json` фиксирует зависимости. Нативный каталог `android/` генерируется из `app.json` и не должен редактироваться вручную.

## Standalone release APK — без Metro

Автономный APK: `artifacts/MarchMap-Standalone-1.0.1.apk`. Устанавливается отдельным приложением **MarchMap Standalone** (`com.marchmap.standalone`), рядом со старой MarchMap. Пакеты `expo-dev-client`, `expo-dev-launcher`, `expo-dev-menu` удалены из зависимостей. JS/Hermes bundle и ресурсы включены в APK. После установки приложение запускается с иконки без компьютера, Expo Go и Metro. Интернет нужен только для подложки карты.

Предыдущие APK 1.0.0 заменены этой версией. Открывайте именно иконку **MarchMap Standalone**; старое приложение MarchMap можно удалить вручную, когда оно больше не нужно.

Версия 1.0.1 проверена чистой установкой на Android Emulator API 35: при отключённых Wi-Fi, mobile data и `adb reverse` сразу отображаются название приложения, версия и кнопка «Открыть GPX». Скриншот: `artifacts/standalone101-offline.png`. В DEX отсутствуют классы пакетов `expo.modules.devlauncher`, `expo.modules.devmenu`, `expo.modules.devclient`; `assets/index.android.bundle` встроен; `apksigner verify` успешен. TypeScript, lint и 18 unit-тестов прошли.

Размер APK: 71 188 950 байт. SHA-256: `8512996751C806996FC046AB38940B7BA2E5B1CBEF7478C55DFB826691E32C54`.

Повторная локальная сборка после настройки окружения выше:

```powershell
npm ci
npm run prebuild
$env:NODE_ENV = 'production'
cd android
.\gradlew.bat :app:assembleRelease '-PreactNativeArchitectures=arm64-v8a,x86_64' '-Dorg.gradle.jvmargs=-Xmx3072m -XX:MaxMetaspaceSize=1536m -Dfile.encoding=UTF-8' --console=plain --max-workers=2
cd ..
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

APK содержит ARM64 для современных телефонов и x86_64 для эмулятора. Локальный release подписан стандартным debug-ключом Expo-шаблона для установки и тестирования; для публикации потребуется собственный release/upload key. Release-режим и встроенный bundle от этого не меняются.

Альтернатива через EAS с управляемой подписью (нужен аккаунт разработчика):

```powershell
npx eas-cli@latest build --platform android --profile preview
```

## Development build и Android Emulator

Создайте AVD в Android Studio → Device Manager (Google APIs, API 36 или новее), запустите его, затем:

```powershell
npm run prebuild
npm run android
```

Команда собирает и устанавливает development APK и запускает Metro. Для повторной разработки с установленным APK:

```powershell
npm start
```

Debug APK открывайте обычной иконкой приложения. После изменения native-зависимостей или plugins повторите `npm run android`.

Для сборки APK без запуска устройства:

```powershell
npm run prebuild
cd android
$env:NODE_ENV = 'development'
.\gradlew.bat assembleDebug '-PreactNativeArchitectures=x86_64,arm64-v8a' --console=plain
cd ..
```

APK: `android/app/build/outputs/apk/debug/app-debug.apk`. Это нативная debug-сборка: для экрана приложения требуется работающий Metro. Для использования без Metro устанавливайте standalone release APK выше.

## Физическое Android-устройство

Включите Developer options → USB debugging, подключите USB и подтвердите RSA-ключ:

```powershell
adb devices
npm run android:device
```

Выберите телефон. Если Metro недоступен по Wi-Fi:

```powershell
adb reverse tcp:8081 tcp:8081
$env:NODE_OPTIONS = '--dns-result-order=ipv4first'
npm start -- --localhost
```

Облачный профиль `preview` создаёт standalone release APK; профили с Expo dev launcher удалены.

## Проверки

```powershell
npm run typecheck
npm run lint
npm test
npx expo export --platform android
```

Unit-тесты проверяют геодезические расстояния, cumulative/total/remaining distance, GPX namespaces и несколько треков/сегментов, отсутствие моста через разрыв, snap/interpolation, включённую границу configurable threshold, отсутствующие высоты, неверный XML/координаты, дубли и 6000 точек на маршруте >100 км.

Проверено 19 сентября 2026 на Windows / Node 24.14 / JDK 21:

- `npm run typecheck` и `npm run lint`: без ошибок.
- `npm test`: 18 тестов прошли.
- `npx expo export --platform android`: Android Hermes bundle собран.
- Gradle `assembleDebug` для `arm64-v8a,x86_64`: BUILD SUCCESSFUL; APK установлен и запущен на Android Emulator API 35.
- На эмуляторе проверены системный file picker, импорт `samples/berlin.gpx`, разрыв линии/профиля, тап с привязкой, отдельные current/selected точки и маркеры, foreground permission, GPS внутри и вне порога. Вне порога current progress и его маркер исчезли, выбранная точка сохранилась. Ошибок ReactNativeJS/AndroidRuntime не обнаружено.
- Скриншоты проверки находятся локально в `artifacts/on-route.png`, `artifacts/profile.png`, `artifacts/off-route.png` (каталог исключён из Git).

Физический телефон не подключался; сценарии отказа в разрешении, выключенного GPS и повреждённого файла перечислены ниже для дополнительной ручной проверки. Первоначальная нативная сборка заняла около 28 минут из-за установки отсутствовавших NDK 27.1, SDK Platform 36, Build Tools и CMake; последующие сборки используют кэш.

## Проверка вручную

```powershell
adb push samples/berlin.gpx /sdcard/Download/berlin.gpx
```

1. Нажмите «Открыть GPX», выберите файл из Downloads. Проверьте два раздельных участка, старт, финиш и профиль.
2. Тапните рядом с линией: оранжевая точка и маркер профиля должны соответствовать snap-позиции; блок показывает пройденное/оставшееся расстояние и высоту GPX.
3. В Emulator Extended Controls → Location задайте latitude `52.5145`, longitude `13.3525`; нажмите «Получить текущее положение». Выдайте foreground permission. Появится текущая точка; выбранная останется отдельно.
4. Задайте `52.52, 13.40`, обновите GPS: фактическая точка остаётся, текущий progress/маркер исчезает; выбранная точка сохраняется.
5. Отклоните location permission / выключите GPS: отображается понятная ошибка. Проверьте отмену выбора файла и импорт повреждённого XML; существующий маршрут сохраняется.

## Модель и ограничения MVP

- `src/services/gpx.ts` преобразует XML в модель `Route`; UI XML не использует. Поддержаны `trk/trkseg/trkpt`, несколько треков; `rte`/waypoints не импортируются.
- `src/services/route.ts` считает без округлений. Каждый сегмент имеет собственный GeoJSON LineString; точки всех сегментов объединены в `points`, cumulative distance продолжается без расстояния через разрыв. Одиночные точки сегментов участвуют в snap как точки.
- Turf `nearestPointOnLine` вызывается для каждого реального сегмента. Берётся ближайший результат, к расстоянию внутри сегмента добавляется его cumulative offset. Порог `ROUTE_THRESHOLD_METERS = 30` меняется в `route.ts`. На пересечении/возвращении по тому же пути выбирается первое равноудалённое в порядке GPX место: определить направление движения без истории нельзя.
- Высота на линии интерполируется между соседними GPX-отметками; если одна отсутствует, результат `null`. GPS altitude не подменяет GPX elevation. Нули и отрицательные отметки допустимы.
- Тап по любому месту карты привязывается к ближайшей точке линии. GPS progress и выбранная позиция независимы; GPS обновляется только по кнопке, время и точность последнего измерения видны на экране.
- Профиль — memoized SVG path со всеми отсчётами; разрывы и отсутствующие elevation не соединяются. Изменение маркеров не пересоздаёт геометрию профиля.
- GPX и последняя GPS-точка находятся только в памяти. После перезапуска файл надо открыть снова. Временная копия импорта удаляется; исходный GPX не меняется. Лимит файла 25 МБ.
- Обработка GPX, snap и профиль работают без сети. **Картографическая подложка требует интернет**: используется [OpenFreeMap Liberty](https://openfreemap.org/quick_start/) на данных OpenStreetMap, без API key. Атрибуция доступна через кнопку `i` карты. Офлайн-карты не настроены. GPX не отправляется провайдеру, но он получает запросы видимых тайлов.
- Разрешения: coarse/fine foreground location; background location и foreground location service отключены. История, watchPosition и background tasks отсутствуют.
