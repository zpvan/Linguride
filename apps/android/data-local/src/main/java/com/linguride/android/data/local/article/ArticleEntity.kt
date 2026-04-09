package com.linguride.android.data.local.article

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "articles")
data class ArticleEntity(
  @PrimaryKey val articleId: String,
  val title: String,
  val sourceUrl: String?,
  val body: String,
  val difficultyJson: String,
  val importedAt: Long,
  val updatedAt: Long,
)
