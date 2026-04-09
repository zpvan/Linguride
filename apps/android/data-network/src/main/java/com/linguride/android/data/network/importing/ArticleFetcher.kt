package com.linguride.android.data.network.importing

import org.jsoup.Jsoup

open class ArticleFetcher {
  open fun fetch(url: String): String =
    Jsoup.connect(url)
      .userAgent("LingurideAndroid/0.1")
      .timeout(15_000)
      .get()
      .outerHtml()
}
