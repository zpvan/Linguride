package com.linguride.android.feature.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.linguride.android.data.local.settings.SettingsStore
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class SettingsUiState(
  val apiKey: String = "",
  val cefrLevel: String = "A2",
  val statusMessage: String? = null,
)

class SettingsViewModel(
  private val settingsStore: SettingsStore,
) : ViewModel() {
  private val mutableState = MutableStateFlow(SettingsUiState())
  val state: StateFlow<SettingsUiState> = mutableState.asStateFlow()

  init {
    viewModelScope.launch {
      settingsStore.observeSettings().collect { (apiKey, level) ->
        mutableState.update { current ->
          current.copy(
            apiKey = apiKey,
            cefrLevel = level,
          )
        }
      }
    }
  }

  fun onApiKeyChange(value: String) {
    mutableState.update { it.copy(apiKey = value, statusMessage = null) }
  }

  fun onLevelChange(value: String) {
    mutableState.update { it.copy(cefrLevel = value, statusMessage = null) }
  }

  fun onSave() {
    val snapshot = mutableState.value
    viewModelScope.launch {
      settingsStore.save(snapshot.apiKey.trim(), snapshot.cefrLevel.trim())
      mutableState.update { it.copy(statusMessage = "Saved locally") }
    }
  }

  companion object {
    fun factory(settingsStore: SettingsStore): ViewModelProvider.Factory =
      viewModelFactory {
        initializer {
          SettingsViewModel(settingsStore)
        }
      }
  }
}
