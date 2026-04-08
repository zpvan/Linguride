package com.linguride.android.data.network.importing

import org.jsoup.Jsoup
import org.jsoup.nodes.Element

class ArticleExtractor {
  fun extract(url: String, html: String): ImportedArticle {
    val document = Jsoup.parse(html, url)
    val articleRoot = document.selectFirst("article, main")
      ?: document.body()
        .allElements
        .filter { it.tagName() == "div" || it.tagName() == "section" }
        .maxByOrNull { score(it) }
      ?: throw IllegalStateException("No readable body found")

    val title = articleRoot.selectFirst("h1")?.text()?.takeIf { it.isNotBlank() }
      ?: document.title().ifBlank { "Imported article" }

    val paragraphs = articleRoot.select("p")
      .map { it.text().trim() }
      .filter { it.length >= 30 }

    if (paragraphs.isEmpty()) {
      throw IllegalStateException("No readable paragraphs found")
    }

    return ImportedArticle(
      title = title,
      sourceUrl = url,
      body = paragraphs.joinToString("\n\n"),
      paragraphs = paragraphs,
    )
  }

  private fun score(element: Element): Int =
    element.select("p").sumOf { paragraph -> paragraph.text().length }
}
