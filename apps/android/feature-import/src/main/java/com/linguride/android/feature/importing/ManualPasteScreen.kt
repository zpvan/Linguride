package com.linguride.android.feature.importing

import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable

@Composable
fun ManualPasteScreen(
  title: String,
  body: String,
  onTitleChange: (String) -> Unit,
  onBodyChange: (String) -> Unit,
  onContinue: () -> Unit,
) {
  Column {
    OutlinedTextField(
      value = title,
      onValueChange = onTitleChange,
      label = { Text("Title") },
    )
    OutlinedTextField(
      value = body,
      onValueChange = onBodyChange,
      label = { Text("Article body") },
    )
    Button(onClick = onContinue) { Text("Continue") }
  }
}
