package com.linguride.android.mobile

import org.junit.Assert.assertEquals
import org.junit.Test

class MobileCoreBridgeTest {
  @Test
  fun `bridge maps rust reader output into article analysis`() {
    val native = object : NativeMobileCore {
      override fun analyzeImportedArticle(inputJson: String): String = """
        {"capture":{"id":"capture-1"},"reader":{"document":{"blocks":[{"id":"p1","originalText":"Text","renderedText":"Text"}]},"difficulty":{"score":42},"summary":{"excerpt":"Text"}}}
      """.trimIndent()
    }

    val bridge = MobileCoreBridge(native)
    val result = bridge.analyze(
      title = "Sample",
      originUrl = "https://example.com",
      text = "Text"
    )

    assertEquals("capture-1", result.captureId)
    assertEquals(42, result.difficultyScore)
  }
}
