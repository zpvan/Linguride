package com.linguride.android.data.local.article

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface ModeRenderDao {
  @Insert(onConflict = OnConflictStrategy.REPLACE)
  suspend fun upsertModeRenders(renders: List<ModeRenderEntity>)

  @Query(
    "SELECT * FROM mode_renders WHERE articleId = :articleId AND mode = :mode ORDER BY paragraphIndex ASC"
  )
  suspend fun loadMode(articleId: String, mode: String): List<ModeRenderEntity>
}
