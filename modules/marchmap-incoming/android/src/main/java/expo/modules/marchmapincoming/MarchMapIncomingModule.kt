package expo.modules.marchmapincoming

import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.util.UUID
import java.net.HttpURLConnection
import java.net.URL

class MarchMapIncomingModule : Module() {
  private data class Incoming(val uri: Uri, val mime: String?)
  private val pending = java.util.concurrent.ConcurrentLinkedQueue<Incoming>()
  @Synchronized
  private fun receive(intent: Intent?) {
    if (intent == null || intent.getBooleanExtra("marchmapConsumed", false)) return
    val clipUri = intent.clipData?.takeIf { it.itemCount > 0 }?.getItemAt(0)?.uri
    @Suppress("DEPRECATION")
    val streamUri = intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)
    val sharedLink = intent.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString()?.trim()?.let { text ->
      Regex("https://(?:1drv\\.ms|onedrive\\.live\\.com)/[^\\s<>]+", RegexOption.IGNORE_CASE).find(text)?.value?.let(Uri::parse)
    }
    val candidates = when (intent.action) {
      Intent.ACTION_VIEW -> listOfNotNull(intent.data, streamUri, clipUri)
      Intent.ACTION_SEND -> listOfNotNull(streamUri, clipUri, intent.data, sharedLink, Uri.parse("unsupported:shared-text"))
      else -> emptyList()
    }
    // Prefer an already granted file over a cloud preview URL accompanying it.
    val uri = candidates.firstOrNull { it.scheme in listOf("content", "file") } ?: candidates.firstOrNull()
    if (uri == null) return
    intent.putExtra("marchmapConsumed", true)
    pending.add(Incoming(uri, intent.type))
  }
  override fun definition() = ModuleDefinition {
    Name("MarchMapIncoming")
    OnNewIntent { intent -> receive(intent) }
    AsyncFunction("takeFile") { labels: Map<String, String> ->
      receive(appContext.currentActivity?.intent)
      val incoming = pending.poll() ?: return@AsyncFunction null
      val uri = incoming.uri
      val context = appContext.reactContext ?: throw IllegalStateException("Приложение недоступно.")
      if (isOneDrivePage(uri)) {
        val activity = appContext.currentActivity ?: throw IllegalStateException("Приложение недоступно.")
        val selected = selectCloudDownload(activity, uri, labels) ?: return@AsyncFunction null
        return@AsyncFunction download(selected.uri, selected.mime, context.cacheDir, true, selected.userAgent) + ("name" to selected.name)
      }
      if (uri.scheme in listOf("http", "https")) return@AsyncFunction download(uri, incoming.mime, context.cacheDir)
      if (uri.scheme !in listOf("content", "file")) throw IllegalArgumentException("Не удалось прочитать файл.")
      val resolver = context.contentResolver
      var name: String? = null
      if (uri.scheme == "content") {
        // Cloud providers may permit the stream while omitting or rejecting metadata queries.
        runCatching {
          resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
            val column = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (column >= 0 && cursor.moveToFirst()) name = cursor.getString(column)
          }
        }
      } else { name = uri.lastPathSegment }
      val mime = incoming.mime ?: runCatching { resolver.getType(uri) }.getOrNull()
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
        mapOf("uri" to Uri.fromFile(target).toString(), "name" to name, "mime" to mime)
      } catch (error: Exception) { target.delete(); throw error }
    }
  }

  /** Some cloud apps hand VIEW a temporary HTTPS download URL instead of a content URI. */
  private fun download(uri: Uri, intentMime: String?, cache: File, webCookies: Boolean = false, userAgent: String? = null): Map<String, String?> {
    var url = URL(uri.toString())
    val deadline = android.os.SystemClock.elapsedRealtime() + 60_000
    repeat(6) {
      val connection = (url.openConnection() as HttpURLConnection).apply {
        connectTimeout = 15_000
        readTimeout = 15_000
        instanceFollowRedirects = false
        userAgent?.let { setRequestProperty("User-Agent", it) }
        if (webCookies) android.webkit.CookieManager.getInstance().getCookie(url.toString())?.let { setRequestProperty("Cookie", it) }
      }
      try {
        val status = connection.responseCode
        if (status in listOf(301, 302, 303, 307, 308)) {
          val location = connection.getHeaderField("Location") ?: throw IllegalArgumentException("Не удалось прочитать файл.")
          val next = URL(url, location)
          if (next.protocol !in listOf("http", "https") || (url.protocol == "https" && next.protocol != "https")) throw IllegalArgumentException("Не удалось прочитать файл.")
          url = next
        } else {
          if (status !in 200..299) throw IllegalArgumentException("Не удалось прочитать файл.")
          if (connection.contentLengthLong > 25 * 1024 * 1024) throw IllegalArgumentException("Выберите GPX размером до 25 МБ.")
          val target = File(cache, "incoming-${UUID.randomUUID()}.gpx")
          try {
            connection.inputStream.use { input ->
              target.outputStream().use { output ->
                val buffer = ByteArray(65536)
                var total = 0L
                while (true) {
                  if (android.os.SystemClock.elapsedRealtime() > deadline) throw IllegalArgumentException("Не удалось прочитать файл.")
                  val count = input.read(buffer)
                  if (count < 0) break
                  total += count
                  if (total > 25 * 1024 * 1024) throw IllegalArgumentException("Выберите GPX размером до 25 МБ.")
                  output.write(buffer, 0, count)
                }
              }
            }
            val name = Uri.parse(url.toString()).lastPathSegment?.takeIf { it.endsWith(".gpx", true) }
            return mapOf("uri" to Uri.fromFile(target).toString(), "name" to name, "mime" to (connection.contentType ?: intentMime))
          } catch (error: Exception) { target.delete(); throw error }
        }
      } finally { connection.disconnect() }
      if (android.os.SystemClock.elapsedRealtime() > deadline) throw IllegalArgumentException("Не удалось прочитать файл.")
    }
    throw IllegalArgumentException("Не удалось прочитать файл.")
  }
}
