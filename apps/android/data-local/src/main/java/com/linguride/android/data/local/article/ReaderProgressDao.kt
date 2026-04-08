package com.linguride.android.data.local.article

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface ReaderProgressDao {
  @Insert(onConflict = OnConflictStrategy.REPLACE)
  suspend fun upsert(progress: ReaderProgressEntity)

  @Query("SELECT * FROM reader_progress WHERE articleId = :articleId")
  suspend fun load(articleId: String): ReaderProgressEntity?
}
