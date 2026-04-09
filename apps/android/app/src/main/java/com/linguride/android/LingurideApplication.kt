package com.linguride.android

import android.app.Application
import com.linguride.android.di.AppGraph

class LingurideApplication : Application() {
  val appGraph: AppGraph by lazy { AppGraph(this) }
}
