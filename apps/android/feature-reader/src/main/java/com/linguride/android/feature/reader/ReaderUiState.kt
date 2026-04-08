package com.linguride.android.feature.reader

data class ReaderParagraph(
  val id: String,
  val originalText: String,
  val renderedText: String?,
)

sealed interface ReaderUiState {
  data object Loading : ReaderUiState

  data class Ready(
    val articleId: String,
    val title: String,
    val mode: ReaderMode,
    val difficultyScore: Int,
    val paragraphs: List<ReaderParagraph>,
  ) : ReaderUiState
}
