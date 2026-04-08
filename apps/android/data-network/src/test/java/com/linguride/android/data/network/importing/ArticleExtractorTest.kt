package com.linguride.android.data.network.importing

import org.junit.Assert.assertEquals
import org.junit.Test

class ArticleExtractorTest {
  @Test
  fun prefersArticleContentOverChromeNoise() {
    val html = """
      <html><body>
        <header>Site header</header>
        <article>
          <h1>Story</h1>
          <p>First paragraph with enough words to survive the readability filter.</p>
          <p>Second paragraph with enough words to remain in the extracted article.</p>
        </article>
      </body></html>
    """.trimIndent()

    val extracted = ArticleExtractor().extract("https://example.com/story", html)
    assertEquals("Story", extracted.title)
    assertEquals(
      listOf(
        "First paragraph with enough words to survive the readability filter.",
        "Second paragraph with enough words to remain in the extracted article.",
      ),
      extracted.paragraphs,
    )
  }
}
