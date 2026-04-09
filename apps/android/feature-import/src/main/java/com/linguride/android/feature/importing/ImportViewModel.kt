package com.linguride.android.feature.importing

import com.linguride.android.data.network.importing.ArticleExtractor
import com.linguride.android.data.network.importing.ArticleFetcher
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

class ImportViewModel(
  private val parser: ShareInputParser,
  private val fetcher: ArticleFetcher,
  private val extractor: ArticleExtractor,
) {
  private val mutableState = MutableStateFlow<ImportUiState>(ImportUiState.Idle)
  val state: StateFlow<ImportUiState> = mutableState

  fun importSharedText(sharedText: String) {
    mutableState.value = ImportUiState.Loading
    runCatching {
      val html = fetcher.fetch(sharedText)
      extractor.extract(sharedText, html)
    }.onSuccess {
      mutableState.value = ImportUiState.Imported(articleId = it.title)
    }.onFailure {
      mutableState.value = ImportUiState.NeedsManualPaste(
        it.message ?: "Unable to import article"
      )
    }
  }

  fun parser(): ShareInputParser = parser
}
