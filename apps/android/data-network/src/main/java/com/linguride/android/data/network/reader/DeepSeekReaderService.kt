package com.linguride.android.data.network.reader

import java.net.HttpURLConnection
import java.net.URL

class DeepSeekReaderService(
  private val apiKeyProvider: () -> String,
) {
  fun render(mode: String, paragraphs: List<String>): List<String> {
    val systemPrompt = when (mode) {
      "translate" -> ReaderPrompts.translateSystem
      "paraphrase" -> ReaderPrompts.paraphraseSystem
      else -> ReaderPrompts.mixedSystem
    }

    val body = """
      {"model":"deepseek-chat","messages":[
        {"role":"system","content":${json(systemPrompt)}},
        {"role":"user","content":${json(numberedParagraphs(paragraphs))}}
      ],"temperature":0.3}
    """.trimIndent()

    val connection =
      URL("https://api.deepseek.com/v1/chat/completions").openConnection() as HttpURLConnection
    connection.requestMethod = "POST"
    connection.setRequestProperty("Content-Type", "application/json")
    connection.setRequestProperty("Authorization", "Bearer ${apiKeyProvider()}")
    connection.doOutput = true
    connection.outputStream.use { it.write(body.toByteArray()) }

    val responseText = connection.inputStream.bufferedReader().readText()
    val content = org.json.JSONObject(responseText)
      .getJSONArray("choices")
      .getJSONObject(0)
      .getJSONObject("message")
      .getString("content")

    return parseNumbered(content, paragraphs.size)
  }

  private fun numberedParagraphs(paragraphs: List<String>): String =
    paragraphs.mapIndexed { index, paragraph ->
      "${index + 1}---\n$paragraph\n---"
    }.joinToString("\n\n")

  private fun json(value: String): String = org.json.JSONObject.quote(value)

  companion object {
    fun parseNumbered(response: String, expectedCount: Int): List<String> {
      val regex = Regex("""(\d+)---\s*([\s\S]*?)\s*---""")
      val results = MutableList(expectedCount) { "" }
      regex.findAll(response).forEach { match ->
        val index = match.groupValues[1].toInt() - 1
        results[index] = match.groupValues[2].trim()
      }
      return results
    }
  }
}
