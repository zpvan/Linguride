package com.linguride.android.feature.reader

data class RenderTarget(val paragraphIndex: Int, val text: String, val paragraphHash: String)

class ReaderModeRenderer(
  private val cache: ReaderModeCache,
  private val service: ReaderModeService,
) {
  fun render(articleId: String, mode: ReaderMode, paragraphs: List<RenderTarget>): List<String> {
    val cacheHits = paragraphs.mapNotNull { target ->
      cache.load(articleId, mode.name.lowercase(), target.paragraphHash)
    }
    if (cacheHits.size == paragraphs.size) return cacheHits

    val rendered = service.render(mode.name.lowercase(), paragraphs.map { it.text })
    paragraphs.zip(rendered).forEach { (target, text) ->
      cache.save(articleId, mode.name.lowercase(), target.paragraphHash, text)
    }
    return rendered
  }
}

interface ReaderModeCache {
  fun load(articleId: String, mode: String, paragraphHash: String): String?
  fun save(articleId: String, mode: String, paragraphHash: String, renderedText: String)
}

interface ReaderModeService {
  fun render(mode: String, paragraphs: List<String>): List<String>
}
