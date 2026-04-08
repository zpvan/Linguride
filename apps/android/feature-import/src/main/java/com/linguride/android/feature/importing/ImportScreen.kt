package com.linguride.android.feature.importing

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable

@Composable
fun ImportScreen(state: ImportUiState) {
  when (state) {
    ImportUiState.Idle -> Text("Ready to import article")
    ImportUiState.Loading -> Text("Importing article")
    is ImportUiState.NeedsManualPaste -> Text("Paste article text to continue")
    is ImportUiState.Imported -> Text("Imported ${state.articleId}")
    is ImportUiState.Error -> Text(state.message)
  }
}
