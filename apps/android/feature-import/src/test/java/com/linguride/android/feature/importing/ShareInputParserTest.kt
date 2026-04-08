package com.linguride.android.feature.importing

import org.junit.Assert.assertEquals
import org.junit.Test

class ShareInputParserTest {
  private val parser = ShareInputParser()

  @Test
  fun parsesHttpsShareTextAsUrlPayload() {
    assertEquals(
      SharePayload.Url("https://example.com/story"),
      parser.parseSharedText("https://example.com/story"),
    )
  }

  @Test
  fun parsesPlainTextAsPlainTextPayload() {
    assertEquals(
      SharePayload.PlainText("Copied article body"),
      parser.parseSharedText("Copied article body"),
    )
  }
}
