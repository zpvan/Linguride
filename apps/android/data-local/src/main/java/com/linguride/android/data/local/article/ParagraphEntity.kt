package com.linguride.android.data.local.article

import androidx.room.Entity

@Entity(tableName = "paragraphs", primaryKeys = ["articleId", "paragraphIndex"])
data class ParagraphEntity(
  val articleId: String,
  val paragraphIndex: Int,
  val originalText: String,
  val paragraphHash: String,
)
