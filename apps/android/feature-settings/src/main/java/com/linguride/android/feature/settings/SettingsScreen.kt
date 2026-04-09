package com.linguride.android.feature.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun SettingsScreen(
  state: SettingsUiState,
  onApiKeyChange: (String) -> Unit,
  onLevelChange: (String) -> Unit,
  onSave: () -> Unit,
) {
  Column(
    verticalArrangement = Arrangement.spacedBy(12.dp),
  ) {
    OutlinedTextField(
      modifier = Modifier.fillMaxWidth(),
      value = state.apiKey,
      onValueChange = onApiKeyChange,
      label = { Text("DeepSeek API Key") },
    )
    OutlinedTextField(
      modifier = Modifier.fillMaxWidth(),
      value = state.cefrLevel,
      onValueChange = onLevelChange,
      label = { Text("CEFR Level") },
    )
    Button(onClick = onSave) {
      Text("Save")
    }
    state.statusMessage?.let { Text(it) }
  }
}
