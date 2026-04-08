package com.linguride.android.feature.importing

sealed interface SharePayload {
  data class Url(val value: String) : SharePayload
  data class PlainText(val value: String) : SharePayload
}
