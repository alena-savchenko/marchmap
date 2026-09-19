package expo.modules.marchmapincoming

import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.util.UUID

class MarchMapIncomingModule : Module() {
  private val pending = java.util.concurrent.ConcurrentLinkedQueue<Uri>()
  @Synchronized
  private fun receive(intent: Intent?) {
    if (intent == null || intent.getBooleanExtra("marchmapConsumed", false)) return
    val uri: Uri? = when (intent.action) {
      Intent.ACTION_VIEW -> intent.data
      Intent.ACTION_SEND -> @Suppress("DEPRECATION") (intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM) ?: intent.clipData?.getItemAt(0)?.uri)
      else -> null
    }
    if (uri == null || uri.scheme !in listOf("content", "file")) return
    intent.putExtra("marchmapConsumed", true)
    pending.add(uri)
  }
  override fun definition() = ModuleDefinition {
    Name("MarchMapIncoming")
    OnNewIntent { intent -> receive(intent) }
    AsyncFunction("takeFile") {
      receive(appContext.currentActivity?.intent)
      val uri = pending.poll() ?: return@AsyncFunction null
      val context = appContext.reactContext ?: throw IllegalStateException("Приложение недоступно.")
      val resolver = context.contentResolver
      var name: String? = null
      if (uri.scheme == "content") {
        resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
          if (cursor.moveToFirst()) name = cursor.getString(0)
        }
      } else { name = uri.lastPathSegment }
      // Some providers expose opaque names. MIME is a fallback only; XML is always validated by JS.
      val mime = resolver.getType(uri)
      val filename = name ?: if (mime == "application/gpx+xml") "Маршрут.gpx" else "Файл"
      if (!filename.endsWith(".gpx", true)) throw IllegalArgumentException("Выберите файл с расширением .gpx.")
      val target = File(context.cacheDir, "incoming-${UUID.randomUUID()}.gpx")
      try {
        var total = 0L
        resolver.openInputStream(uri)?.use { input ->
          target.outputStream().use { output ->
            val buffer = ByteArray(65536)
            while (true) {
              val count = input.read(buffer)
              if (count < 0) break
              total += count
              if (total > 25 * 1024 * 1024) throw IllegalArgumentException("Выберите GPX размером до 25 МБ.")
              output.write(buffer, 0, count)
            }
          }
        } ?: throw IllegalArgumentException("Не удалось прочитать файл.")
        mapOf("uri" to Uri.fromFile(target).toString(), "name" to filename)
      } catch (error: Exception) { target.delete(); throw error }
    }
  }
}
