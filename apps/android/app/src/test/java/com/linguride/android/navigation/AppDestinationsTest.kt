package com.linguride.android.navigation

import org.junit.Assert.assertEquals
import org.junit.Test

class AppDestinationsTest {
  @Test
  fun `start destination is import`() {
    assertEquals("import", AppDestinations.start)
  }
}
