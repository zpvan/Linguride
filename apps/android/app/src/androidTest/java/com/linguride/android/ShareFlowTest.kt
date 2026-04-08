package com.linguride.android

import android.content.Intent
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ShareFlowTest {
  @get:Rule
  val composeRule = createAndroidComposeRule<MainActivity>()

  @Test
  fun sharedUrlOpensImportFlow() {
    val shareIntent =
      Intent(composeRule.activity, MainActivity::class.java).apply {
        action = Intent.ACTION_SEND
        type = "text/plain"
        putExtra(Intent.EXTRA_TEXT, "https://example.com/story")
      }

    composeRule.activity.runOnUiThread {
      composeRule.activity.intent = shareIntent
    }
    composeRule.activityRule.scenario.recreate()

    composeRule.onNodeWithText("Importing article").assertExists()
  }
}
