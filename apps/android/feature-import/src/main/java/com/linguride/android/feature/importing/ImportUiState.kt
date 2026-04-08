package com.linguride.android.feature.importing

sealed interface ImportUiState {
  data object Idle : ImportUiState
  data object Loading : ImportUiState
  data class NeedsManualPaste(val reason: String) : ImportUiState
  data class Imported(val articleId: String) : ImportUiState
  data class Error(val message: String) : ImportUiState
}
