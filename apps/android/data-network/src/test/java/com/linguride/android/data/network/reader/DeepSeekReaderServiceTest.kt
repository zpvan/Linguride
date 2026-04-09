package com.linguride.android.data.network.reader

import org.junit.Assert.assertEquals
import org.junit.Test

class DeepSeekReaderServiceTest {
  @Test
  fun parsesNumberedTranslateResponse() {
    val response = """
      1---
      第一段
      ---

      2---
      第二段
      ---
    """.trimIndent()

    assertEquals(listOf("第一段", "第二段"), DeepSeekReaderService.parseNumbered(response, 2))
  }
}
