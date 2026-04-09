package com.linguride.android.data.local.article

import androidx.room.Entity

@Entity(tableName = "mode_renders", primaryKeys = ["articleId", "paragraphIndex", "mode"])
data class ModeRenderEntity(
  val articleId: String,
  val paragraphIndex: Int,
  val mode: String,
  val paragraphHash: String,
  val renderedText: String,
  val updatedAt: Long,
)
