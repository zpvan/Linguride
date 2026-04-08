package com.linguride.android.mobile

import org.json.JSONArray
import org.json.JSONObject

interface NativeMobileCore {
  fun analyzeImportedArticle(inputJson: String): String
}

class MobileCoreBridge(
  private val native: NativeMobileCore = object : NativeMobileCore {
    override fun analyzeImportedArticle(inputJson: String): String =
      MobileCoreBindings.analyzeImportedArticle(inputJson)
  }
) {
  fun analyze(title: String, originUrl: String?, text: String): MobileReaderAnalysis {
    val payload = JSONObject()
      .put("title", title)
      .put("originUrl", originUrl)
      .put("text", text)

    val root = JSONObject(native.analyzeImportedArticle(payload.toString()))
    val capture = root.getJSONObject("capture")
    val reader = root.getJSONObject("reader")
    val summary = reader.getJSONObject("summary")
    val difficulty = reader.getJSONObject("difficulty")
    val blocks = reader.getJSONObject("document").getJSONArray("blocks").toBlocks()

    return MobileReaderAnalysis(
      captureId = capture.getString("id"),
      difficultyScore = difficulty.getInt("score"),
      excerpt = summary.getString("excerpt"),
      blocks = blocks
    )
  }

  private fun JSONArray.toBlocks(): List<MobileReaderBlock> =
    List(length()) { index ->
      val item = getJSONObject(index)
      MobileReaderBlock(
        id = item.getString("id"),
        originalText = item.getString("originalText"),
        renderedText = item.getString("renderedText")
      )
    }
}
