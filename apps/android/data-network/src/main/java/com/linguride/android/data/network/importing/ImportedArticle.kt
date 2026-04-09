package com.linguride.android.data.network.importing

data class ImportedArticle(
  val title: String,
  val sourceUrl: String?,
  val body: String,
  val paragraphs: List<String>,
)
