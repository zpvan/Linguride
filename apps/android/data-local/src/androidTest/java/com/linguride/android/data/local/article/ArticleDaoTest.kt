package com.linguride.android.data.local.article

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.linguride.android.data.local.AppDatabase
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ArticleDaoTest {
  private lateinit var database: AppDatabase

  @Before
  fun setUp() {
    database = Room.inMemoryDatabaseBuilder(
      ApplicationProvider.getApplicationContext(),
      AppDatabase::class.java
    ).allowMainThreadQueries().build()
  }

  @After
  fun tearDown() {
    database.close()
  }

  @Test
  fun storesArticleParagraphsAndCachedModeRenders() = runBlocking {
    database.articleDao().upsertArticle(
      ArticleEntity(
        articleId = "article-1",
        title = "Sample",
        sourceUrl = "https://example.com",
        body = "First.\n\nSecond.",
        difficultyJson = """{"score":42}""",
        importedAt = 1L,
        updatedAt = 1L,
      )
    )

    database.articleDao().replaceParagraphs(
      "article-1",
      listOf(
        ParagraphEntity("article-1", 0, "First.", "h1"),
        ParagraphEntity("article-1", 1, "Second.", "h2"),
      )
    )

    database.modeRenderDao().upsertModeRenders(
      listOf(ModeRenderEntity("article-1", 0, "translate", "h1", "第一句", 1L))
    )

    assertEquals(2, database.articleDao().loadParagraphs("article-1").size)
    assertEquals(1, database.modeRenderDao().loadMode("article-1", "translate").size)
  }
}
