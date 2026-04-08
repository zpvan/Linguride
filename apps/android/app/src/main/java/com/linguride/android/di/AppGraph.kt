package com.linguride.android.di

import android.content.Context
import androidx.room.Room
import com.linguride.android.data.local.AppDatabase
import com.linguride.android.data.local.settings.SettingsStore
import com.linguride.android.data.network.importing.ArticleExtractor
import com.linguride.android.data.network.importing.ArticleFetcher
import com.linguride.android.data.network.reader.DeepSeekReaderService
import com.linguride.android.mobile.MobileCoreBridge

class AppGraph(context: Context) {
  private val appContext = context.applicationContext

  val settingsStore = SettingsStore(appContext)
  val database =
    Room.databaseBuilder(appContext, AppDatabase::class.java, "linguride.db").build()
  val mobileCoreBridge = MobileCoreBridge()
  val articleFetcher = ArticleFetcher()
  val articleExtractor = ArticleExtractor()

  fun deepSeekReaderService(apiKey: String): DeepSeekReaderService =
    DeepSeekReaderService { apiKey }
}
