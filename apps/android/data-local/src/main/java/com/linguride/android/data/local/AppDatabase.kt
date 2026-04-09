package com.linguride.android.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import com.linguride.android.data.local.article.ArticleDao
import com.linguride.android.data.local.article.ArticleEntity
import com.linguride.android.data.local.article.ModeRenderDao
import com.linguride.android.data.local.article.ModeRenderEntity
import com.linguride.android.data.local.article.ParagraphEntity
import com.linguride.android.data.local.article.ReaderProgressDao
import com.linguride.android.data.local.article.ReaderProgressEntity

@Database(
  entities = [
    ArticleEntity::class,
    ParagraphEntity::class,
    ModeRenderEntity::class,
    ReaderProgressEntity::class,
  ],
  version = 1,
  exportSchema = false,
)
abstract class AppDatabase : RoomDatabase() {
  abstract fun articleDao(): ArticleDao
  abstract fun modeRenderDao(): ModeRenderDao
  abstract fun readerProgressDao(): ReaderProgressDao
}
