package com.linguride.android.data.local.settings

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.settingsDataStore by preferencesDataStore(name = "linguride_settings")

class SettingsStore(private val context: Context) {
  private val deepSeekKey = stringPreferencesKey("deepseek_api_key")
  private val cefrLevel = stringPreferencesKey("user_cefr_level")

  fun observeSettings(): Flow<Pair<String, String>> =
    context.settingsDataStore.data.map { prefs ->
      (prefs[deepSeekKey] ?: "") to (prefs[cefrLevel] ?: "A2")
    }

  suspend fun save(apiKey: String, level: String) {
    context.settingsDataStore.edit { prefs ->
      prefs[deepSeekKey] = apiKey
      prefs[cefrLevel] = level
    }
  }
}
