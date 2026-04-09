package com.linguride.android.feature.reader

import org.junit.Assert.assertEquals
import org.junit.Test

class ReaderModeRendererTest {
  @Test
  fun returnsCachedModeResultsBeforeCallingNetwork() {
    val renderer = ReaderModeRenderer(
      cache = FakeModeCache(mutableMapOf("article-1|translate|h1" to "第一段")),
      service = FakeReaderService(listOf("network"))
    )

    val result = renderer.render(
      articleId = "article-1",
      mode = ReaderMode.Translate,
      paragraphs = listOf(RenderTarget(0, "First.", "h1"))
    )

    assertEquals(listOf("第一段"), result)
  }

  private class FakeModeCache(
    private val backing: MutableMap<String, String>
  ) : ReaderModeCache {
    override fun load(articleId: String, mode: String, paragraphHash: String): String? =
      backing["$articleId|$mode|$paragraphHash"]

    override fun save(articleId: String, mode: String, paragraphHash: String, renderedText: String) {
      backing["$articleId|$mode|$paragraphHash"] = renderedText
    }
  }

  private class FakeReaderService(
    private val rendered: List<String>
  ) : ReaderModeService {
    override fun render(mode: String, paragraphs: List<String>): List<String> = rendered
  }
}
