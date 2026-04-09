package com.linguride.android.feature.reader

import org.junit.Assert.assertEquals
import org.junit.Test

class ReaderViewModelTest {
  @Test
  fun loadsReaderDifficultyAndDefaultsToTranslateMode() {
    val repository = FakeReaderRepository(
      ReaderUiState.Ready(
        articleId = "article-1",
        title = "Story",
        mode = ReaderMode.Translate,
        difficultyScore = 42,
        paragraphs = listOf(ReaderParagraph("p1", "Original", null)),
      )
    )

    val viewModel = ReaderViewModel(repository)
    assertEquals(ReaderMode.Translate, viewModel.state.value.mode)
    assertEquals(42, viewModel.state.value.difficultyScore)
  }

  private class FakeReaderRepository(
    private val initialState: ReaderUiState.Ready
  ) : ReaderRepositoryContract {
    override fun loadInitial(): ReaderUiState.Ready = initialState
  }
}
