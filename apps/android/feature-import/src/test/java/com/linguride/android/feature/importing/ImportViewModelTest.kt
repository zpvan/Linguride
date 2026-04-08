package com.linguride.android.feature.importing

import com.linguride.android.data.network.importing.ArticleExtractor
import com.linguride.android.data.network.importing.ArticleFetcher
import org.junit.Assert.assertEquals
import org.junit.Test

class ImportViewModelTest {
  @Test
  fun fallsBackToManualPasteWhenFetchFails() {
    val viewModel = ImportViewModel(
      parser = ShareInputParser(),
      fetcher = object : ArticleFetcher() {
        override fun fetch(url: String): String {
          error("network unavailable")
        }
      },
      extractor = ArticleExtractor(),
    )

    viewModel.importSharedText("https://example.com/story")

    assertEquals(
      ImportUiState.NeedsManualPaste("network unavailable"),
      viewModel.state.value,
    )
  }
}
