package com.linguride.android.feature.importing

import android.content.Intent
import java.net.URI

class ShareInputParser {
  fun parse(intent: Intent): SharePayload? {
    val text = intent.getStringExtra(Intent.EXTRA_TEXT)
    return parseSharedText(text)
  }

  fun parseSharedText(sharedText: String?): SharePayload? {
    val text = sharedText?.trim().orEmpty()
    if (text.isBlank()) return null

    return if (text.isHttpUrl()) {
      SharePayload.Url(text)
    } else {
      SharePayload.PlainText(text)
    }
  }
}

private fun String.isHttpUrl(): Boolean =
  runCatching {
    val uri = URI(this)
    (uri.scheme == "http" || uri.scheme == "https") && !uri.host.isNullOrBlank()
  }.getOrDefault(false)
