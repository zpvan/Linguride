package com.linguride.android.mobile

internal object MobileCoreBindings {
  init {
    System.loadLibrary("mobile_core")
  }

  external fun analyzeImportedArticle(inputJson: String): String
}
