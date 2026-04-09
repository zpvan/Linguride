package com.linguride.android.feature.reader

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

class ReaderViewModel(private val repository: ReaderRepositoryContract) {
  private val mutableState = MutableStateFlow(repository.loadInitial())

  val state: StateFlow<ReaderUiState.Ready> = mutableState

  fun selectMode(mode: ReaderMode) {
    mutableState.value = mutableState.value.copy(mode = mode)
  }
}

interface ReaderRepositoryContract {
  fun loadInitial(): ReaderUiState.Ready
}
