package com.linguride.android.data.local.article

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction

@Dao
interface ArticleDao {
  @Insert(onConflict = OnConflictStrategy.REPLACE)
  suspend fun upsertArticle(article: ArticleEntity)

  @Query("DELETE FROM paragraphs WHERE articleId = :articleId")
  suspend fun clearParagraphs(articleId: String)

  @Insert(onConflict = OnConflictStrategy.REPLACE)
  suspend fun insertParagraphs(paragraphs: List<ParagraphEntity>)

  @Transaction
  suspend fun replaceParagraphs(articleId: String, paragraphs: List<ParagraphEntity>) {
    clearParagraphs(articleId)
    insertParagraphs(paragraphs)
  }

  @Query("SELECT * FROM paragraphs WHERE articleId = :articleId ORDER BY paragraphIndex ASC")
  suspend fun loadParagraphs(articleId: String): List<ParagraphEntity>
}
