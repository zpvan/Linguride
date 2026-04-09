package com.linguride.android.feature.reader

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable

@Composable
fun ReaderScreen(state: ReaderUiState.Ready, onModeSelected: (ReaderMode) -> Unit) {
  Column {
    Text(state.title)
    Row {
      ReaderMode.entries.forEach { mode ->
        Button(onClick = { onModeSelected(mode) }) {
          Text(mode.name)
        }
      }
    }
    LazyColumn {
      items(state.paragraphs) { paragraph ->
        Text(paragraph.originalText)
        paragraph.renderedText?.let { Text(it) }
      }
    }
  }
}
