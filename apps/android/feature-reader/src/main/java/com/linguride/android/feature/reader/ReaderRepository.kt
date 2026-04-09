package com.linguride.android.feature.reader

import com.linguride.android.mobile.MobileCoreBridge

class ReaderRepository(
  private val mobileCoreBridge: MobileCoreBridge,
) : ReaderRepositoryContract {
  fun analyze(title: String, originUrl: String?, body: String): ReaderUiState.Ready {
    val analysis = mobileCoreBridge.analyze(title, originUrl, body)
    return ReaderUiState.Ready(
      articleId = analysis.captureId,
      title = title,
      mode = ReaderMode.Translate,
      difficultyScore = analysis.difficultyScore,
      paragraphs = analysis.blocks.map { ReaderParagraph(it.id, it.originalText, null) },
    )
  }

  override fun loadInitial(): ReaderUiState.Ready =
    analyze(
      title = "Imported article",
      originUrl = null,
      body = "Imported article preview.",
    )
}
