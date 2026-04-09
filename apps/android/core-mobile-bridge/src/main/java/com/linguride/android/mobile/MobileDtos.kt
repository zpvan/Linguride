package com.linguride.android.mobile

data class MobileReaderAnalysis(
  val captureId: String,
  val difficultyScore: Int,
  val excerpt: String,
  val blocks: List<MobileReaderBlock>,
)

data class MobileReaderBlock(
  val id: String,
  val originalText: String,
  val renderedText: String,
)
