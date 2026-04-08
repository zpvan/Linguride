package com.linguride.android.data.local.article

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "reader_progress")
data class ReaderProgressEntity(
  @PrimaryKey val articleId: String,
  val paragraphIndex: Int,
  val scrollOffsetPx: Int,
  val updatedAt: Long,
)
