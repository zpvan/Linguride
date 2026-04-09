package com.linguride.android.data.network.reader

object ReaderPrompts {
  const val translateSystem =
    "You are a bilingual reading assistant. Translate each numbered English paragraph into natural Chinese."
  const val paraphraseSystem =
    "You rewrite each numbered English paragraph into easier English suitable for the learner level."
  const val mixedSystem =
    "You preserve understandable English and replace harder spans with Chinese for each numbered paragraph."
}
