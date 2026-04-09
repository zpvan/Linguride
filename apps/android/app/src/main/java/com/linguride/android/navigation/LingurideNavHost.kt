package com.linguride.android.navigation

import android.content.Intent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.linguride.android.di.AppGraph
import com.linguride.android.feature.importing.ImportScreen
import com.linguride.android.feature.importing.ImportUiState
import com.linguride.android.feature.importing.ImportViewModel
import com.linguride.android.feature.importing.ManualPasteScreen
import com.linguride.android.feature.importing.ShareInputParser
import com.linguride.android.feature.importing.SharePayload
import com.linguride.android.feature.reader.ReaderRepository
import com.linguride.android.feature.reader.ReaderScreen
import com.linguride.android.feature.reader.ReaderUiState
import com.linguride.android.feature.settings.SettingsScreen
import com.linguride.android.feature.settings.SettingsViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

@Composable
fun LingurideNavHost(
  appGraph: AppGraph,
  incomingIntent: Intent?,
) {
  val navController = rememberNavController()
  val shareInputParser = remember { ShareInputParser() }
  val importViewModel = remember(appGraph) {
    ImportViewModel(
      parser = shareInputParser,
      fetcher = appGraph.articleFetcher,
      extractor = appGraph.articleExtractor,
    )
  }
  val importState by importViewModel.state.collectAsState()
  val settingsViewModel: SettingsViewModel = viewModel(
    factory = SettingsViewModel.factory(appGraph.settingsStore)
  )
  val settingsState by settingsViewModel.state.collectAsState()
  val readerRepository = remember(appGraph.mobileCoreBridge) {
    ReaderRepository(appGraph.mobileCoreBridge)
  }
  var readerState by remember { mutableStateOf<ReaderUiState.Ready?>(null) }
  var manualTitle by rememberSaveable { mutableStateOf("Imported article") }
  var manualBody by rememberSaveable { mutableStateOf("") }
  var lastHandledShareKey by rememberSaveable { mutableStateOf<String?>(null) }
  var shareImportPending by rememberSaveable { mutableStateOf(false) }

  LaunchedEffect(incomingIntent) {
    val payload = shareInputParser.parseShareIntent(incomingIntent)
    val shareKey = payload?.stableKey()
    if (shareKey == null || shareKey == lastHandledShareKey) return@LaunchedEffect

    lastHandledShareKey = shareKey
    when (payload) {
      is SharePayload.Url -> {
        shareImportPending = true
        navController.navigate(AppDestinations.import) {
          popUpTo(AppDestinations.start)
          launchSingleTop = true
        }
        withContext(Dispatchers.IO) {
          importViewModel.importSharedText(payload.value)
        }
      }

      is SharePayload.PlainText -> {
        manualTitle = "Shared article"
        manualBody = payload.value
        navController.navigate(AppDestinations.manualPaste) {
          popUpTo(AppDestinations.start)
          launchSingleTop = true
        }
      }
    }
  }

  LaunchedEffect(importState) {
    when (importState) {
      ImportUiState.Loading -> Unit
      ImportUiState.Idle -> Unit
      is ImportUiState.NeedsManualPaste -> {
        shareImportPending = false
        navController.navigate(AppDestinations.manualPaste) {
          launchSingleTop = true
        }
      }

      is ImportUiState.Imported,
      is ImportUiState.Error -> {
        shareImportPending = false
      }
    }
  }

  NavHost(
    navController = navController,
    startDestination = AppDestinations.start,
  ) {
    composable(AppDestinations.import) {
      ScreenChrome(
        title = "Import Article",
        onManualPaste = {
          navController.navigate(AppDestinations.manualPaste) {
            launchSingleTop = true
          }
        },
        onSettings = {
          navController.navigate(AppDestinations.settings) {
            launchSingleTop = true
          }
        },
      ) {
        ImportScreen(
          state = importState.asVisibleState(shareImportPending),
        )
      }
    }

    composable(AppDestinations.manualPaste) {
      ScreenChrome(
        title = "Manual Paste",
        onImport = {
          navController.navigate(AppDestinations.import) {
            launchSingleTop = true
          }
        },
        onSettings = {
          navController.navigate(AppDestinations.settings) {
            launchSingleTop = true
          }
        },
      ) {
        ManualPasteScreen(
          title = manualTitle,
          body = manualBody,
          onTitleChange = { manualTitle = it },
          onBodyChange = { manualBody = it },
          onContinue = {
            readerState = readerRepository.analyze(
              title = manualTitle.ifBlank { "Imported article" },
              originUrl = null,
              body = manualBody.ifBlank { "No article body provided." },
            )
            navController.navigate(AppDestinations.reader) {
              launchSingleTop = true
            }
          },
        )
      }
    }

    composable(AppDestinations.reader) {
      ScreenChrome(
        title = "Reader",
        onImport = {
          navController.navigate(AppDestinations.import) {
            launchSingleTop = true
          }
        },
        onSettings = {
          navController.navigate(AppDestinations.settings) {
            launchSingleTop = true
          }
        },
      ) {
        val currentState = readerState ?: readerRepository.loadInitial()
        ReaderScreen(
          state = currentState,
          onModeSelected = { mode ->
            readerState = currentState.copy(mode = mode)
          },
        )
      }
    }

    composable(AppDestinations.settings) {
      ScreenChrome(
        title = "Settings",
        onImport = {
          navController.navigate(AppDestinations.import) {
            launchSingleTop = true
          }
        },
        onManualPaste = {
          navController.navigate(AppDestinations.manualPaste) {
            launchSingleTop = true
          }
        },
      ) {
        SettingsScreen(
          state = settingsState,
          onApiKeyChange = settingsViewModel::onApiKeyChange,
          onLevelChange = settingsViewModel::onLevelChange,
          onSave = settingsViewModel::onSave,
        )
      }
    }
  }
}

@Composable
private fun ScreenChrome(
  title: String,
  onImport: (() -> Unit)? = null,
  onManualPaste: (() -> Unit)? = null,
  onSettings: (() -> Unit)? = null,
  content: @Composable () -> Unit,
) {
  Column(
    modifier = Modifier
      .fillMaxSize()
      .padding(16.dp),
    verticalArrangement = Arrangement.spacedBy(16.dp),
  ) {
    Text(
      text = title,
      style = MaterialTheme.typography.headlineSmall,
    )
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
      onImport?.let { Button(onClick = it) { Text("Import") } }
      onManualPaste?.let { Button(onClick = it) { Text("Paste") } }
      onSettings?.let { Button(onClick = it) { Text("Settings") } }
    }
    content()
  }
}

private fun ShareInputParser.parseShareIntent(intent: Intent?): SharePayload? {
  if (intent?.action != Intent.ACTION_SEND || intent.type != "text/plain") {
    return null
  }
  return parse(intent)
}

private fun SharePayload.stableKey(): String =
  when (this) {
    is SharePayload.PlainText -> "text:$value"
    is SharePayload.Url -> "url:$value"
  }

private fun ImportUiState.asVisibleState(shareImportPending: Boolean): ImportUiState =
  if (shareImportPending && this == ImportUiState.Idle) {
    ImportUiState.Loading
  } else {
    this
  }
