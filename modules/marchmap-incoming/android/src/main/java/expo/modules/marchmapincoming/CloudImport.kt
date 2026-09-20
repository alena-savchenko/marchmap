package expo.modules.marchmapincoming

import android.app.Activity
import android.app.AlertDialog
import android.net.Uri
import android.webkit.URLUtil
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import java.util.concurrent.CompletableFuture
import java.util.concurrent.TimeUnit

internal data class CloudDownload(val uri: Uri, val name: String, val mime: String?, val userAgent: String)

internal fun isOneDrivePage(uri: Uri): Boolean =
  uri.scheme == "https" && uri.host?.lowercase() in setOf("1drv.ms", "onedrive.live.com")

/** Use the public sharing UI instead of scraping private OneDrive APIs or reusing browser credentials. */
internal fun selectCloudDownload(activity: Activity, uri: Uri, labels: Map<String, String>): CloudDownload? {
  val result = CompletableFuture<CloudDownload?>()
  var dialog: AlertDialog? = null
  activity.runOnUiThread {
    if (activity.isFinishing || activity.isDestroyed) {
      result.complete(null)
      return@runOnUiThread
    }
    val web = WebView(activity)
    web.settings.apply {
      javaScriptEnabled = true
      domStorageEnabled = true
      allowFileAccess = false
      allowContentAccess = false
      mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
      useWideViewPort = true
      loadWithOverviewMode = true
    }
    web.webViewClient = object : WebViewClient() {
      override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
        request.url.scheme != "https"
    }
    web.setDownloadListener { url, userAgent, disposition, mime, _ ->
      val download = Uri.parse(url)
      if (download.scheme == "https" && !result.isDone) {
        result.complete(CloudDownload(download, URLUtil.guessFileName(url, disposition, mime), mime, userAgent))
        dialog?.dismiss()
      } else if (!result.isDone) {
        result.completeExceptionally(IllegalArgumentException("Не удалось прочитать файл."))
        dialog?.dismiss()
      }
    }
    // A WebView in an AlertDialog otherwise measures to almost zero for pages using height:100%.
    val container = FrameLayout(activity).apply {
      minimumHeight = (activity.resources.displayMetrics.heightPixels * 0.72).toInt()
      addView(web, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
    }
    dialog = AlertDialog.Builder(activity)
      .setTitle(labels["title"])
      .setView(container)
      .setNegativeButton(labels["cancel"]) { _, _ -> result.complete(null) }
      .create().also { popup ->
        popup.setOnDismissListener {
          result.complete(null)
          web.stopLoading()
          web.destroy()
        }
        popup.show()
        popup.window?.setLayout(android.view.ViewGroup.LayoutParams.MATCH_PARENT, android.view.ViewGroup.LayoutParams.MATCH_PARENT)
        web.loadUrl(uri.toString())
      }
  }
  try { return result.get(5, TimeUnit.MINUTES) }
  finally { activity.runOnUiThread { dialog?.dismiss() } }
}
