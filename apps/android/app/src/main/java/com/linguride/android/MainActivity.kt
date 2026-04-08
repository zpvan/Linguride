package com.linguride.android

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.linguride.android.navigation.LingurideNavHost

class MainActivity : ComponentActivity() {
  private var incomingIntent: Intent? by mutableStateOf(null)

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    incomingIntent = intent
    setContent {
      LingurideNavHost(
        appGraph = (application as LingurideApplication).appGraph,
        incomingIntent = incomingIntent,
      )
    }
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    incomingIntent = intent
  }
}
