"use strict";
/**
 * 文本处理工具函数
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanText = cleanText;
exports.analyzeTextStats = analyzeTextStats;
exports.estimateReadingTime = estimateReadingTime;
exports.extractSnippet = extractSnippet;
exports.detectLanguage = detectLanguage;
exports.isPrimarilyEnglish = isPrimarilyEnglish;
exports.splitLongText = splitLongText;
exports.calculateTextComplexity = calculateTextComplexity;
exports.generateSummary = generateSummary;
/**
 * 清理和标准化文本
 */
function cleanText(text) {
    if (!text) {
        return '';
    }
    return text
        .replace(/\r\n/g, '\n') // 统一换行符
        .replace(/\t/g, '    ') // 制表符转空格
        .replace(/[ \u00A0]+/g, ' ') // 统一空格
        .replace(/^\s+|\s+$/g, '') // 去除首尾空格
        .replace(/\n{3,}/g, '\n\n'); // 限制连续空行
}
/**
 * 统计文本基本信息
 */
function analyzeTextStats(text) {
    const cleanedText = cleanText(text);
    // 字符数（包括空格）
    const charCount = cleanedText.length;
    // 词数（按空格分割）
    const words = cleanedText.split(/\s+/).filter(word => word.length > 0);
    const wordCount = words.length;
    // 句子数（按句号、问号、感叹号分割）
    const sentences = cleanedText.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const sentenceCount = sentences.length;
    // 段落数（按空行分割）
    const paragraphs = cleanedText.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    const paragraphCount = paragraphs.length;
    // 平均词长
    const avgWordLength = wordCount > 0
        ? words.reduce((sum, word) => sum + word.length, 0) / wordCount
        : 0;
    // 平均句长（词数）
    const avgSentenceLength = sentenceCount > 0
        ? wordCount / sentenceCount
        : 0;
    return {
        charCount,
        wordCount,
        sentenceCount,
        paragraphCount,
        avgWordLength,
        avgSentenceLength
    };
}
/**
 * 估算阅读时间（基于平均阅读速度）
 */
function estimateReadingTime(text, wordsPerMinute = 200) {
    const stats = analyzeTextStats(text);
    const minutes = stats.wordCount / wordsPerMinute;
    return Math.max(0.1, Math.ceil(minutes * 10) / 10); // 保留一位小数，最小0.1分钟
}
/**
 * 提取文本片段（用于预览）
 */
function extractSnippet(text, maxLength = 100) {
    const cleaned = cleanText(text);
    if (cleaned.length <= maxLength) {
        return cleaned;
    }
    // 尝试在句子边界截断
    const sentences = cleaned.split(/[.!?]+/);
    let snippet = '';
    for (const sentence of sentences) {
        const trimmed = sentence.trim();
        if (trimmed && (snippet + ' ' + trimmed).length <= maxLength) {
            snippet += (snippet ? ' ' : '') + trimmed;
        }
        else {
            break;
        }
    }
    // 如果没有完整的句子，则简单截断
    if (!snippet) {
        snippet = cleaned.substring(0, maxLength).trim();
        // 确保不在单词中间截断
        const lastSpace = snippet.lastIndexOf(' ');
        if (lastSpace > maxLength * 0.8) {
            snippet = snippet.substring(0, lastSpace);
        }
    }
    return snippet + (cleaned.length > maxLength ? '...' : '');
}
/**
 * 检测文本语言（简单实现，主要检测英文）
 */
function detectLanguage(text) {
    if (!text || text.length < 10) {
        return 'en'; // 默认英文
    }
    // 简单检测：统计常见英文单词
    const englishWords = ['the', 'and', 'you', 'that', 'have', 'for', 'not', 'with', 'this', 'but'];
    const words = text.toLowerCase().split(/\s+/);
    const englishCount = words.filter(word => englishWords.includes(word)).length;
    // 如果英文单词比例较高，认为是英文
    if (englishCount > words.length * 0.05) { // 5%的单词是常见英文单词
        return 'en';
    }
    return 'unknown';
}
/**
 * 检查文本是否主要为英文
 */
function isPrimarilyEnglish(text) {
    const language = detectLanguage(text);
    return language === 'en';
}
/**
 * 分割长文本（避免超过token限制）
 */
function splitLongText(text, maxLength = 4000) {
    if (text.length <= maxLength) {
        return [text];
    }
    const chunks = [];
    let currentChunk = '';
    const paragraphs = text.split(/\n\s*\n/);
    for (const paragraph of paragraphs) {
        if ((currentChunk + '\n\n' + paragraph).length <= maxLength) {
            currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
        }
        else {
            if (currentChunk) {
                chunks.push(currentChunk);
            }
            // 如果单个段落就超过最大长度，需要进一步分割
            if (paragraph.length > maxLength) {
                const subChunks = splitBySentences(paragraph, maxLength);
                chunks.push(...subChunks);
                currentChunk = '';
            }
            else {
                currentChunk = paragraph;
            }
        }
    }
    if (currentChunk) {
        chunks.push(currentChunk);
    }
    return chunks;
}
/**
 * 按句子分割文本
 */
function splitBySentences(text, maxLength) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const chunks = [];
    let currentChunk = '';
    for (const sentence of sentences) {
        const trimmed = sentence.trim();
        if ((currentChunk + ' ' + trimmed).length <= maxLength) {
            currentChunk += (currentChunk ? ' ' : '') + trimmed;
        }
        else {
            if (currentChunk) {
                chunks.push(currentChunk);
            }
            currentChunk = trimmed;
        }
    }
    if (currentChunk) {
        chunks.push(currentChunk);
    }
    return chunks;
}
/**
 * 计算文本复杂度分数（简单启发式算法）
 */
function calculateTextComplexity(text) {
    const stats = analyzeTextStats(text);
    let score = 0;
    // 基于平均词长（0-30分）
    score += Math.min(30, stats.avgWordLength * 10);
    // 基于平均句长（0-30分）
    score += Math.min(30, stats.avgSentenceLength / 2);
    // 基于文本长度（0-20分）
    score += Math.min(20, stats.charCount / 500);
    // 基于段落数（0-20分）
    score += Math.min(20, stats.paragraphCount * 2);
    return Math.min(100, Math.round(score));
}
/**
 * 生成文本摘要
 */
function generateSummary(text, maxSentences = 3) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length <= maxSentences) {
        return text;
    }
    // 简单算法：取开头、中间和结尾的句子
    const selectedSentences = [];
    // 第一句
    if (sentences.length > 0) {
        selectedSentences.push(sentences[0].trim());
    }
    // 中间一句
    if (sentences.length > 2) {
        const middleIndex = Math.floor(sentences.length / 2);
        selectedSentences.push(sentences[middleIndex].trim());
    }
    // 最后一句
    if (sentences.length > 1) {
        selectedSentences.push(sentences[sentences.length - 1].trim());
    }
    // 确保不超过最大句子数
    const finalSentences = selectedSentences.slice(0, maxSentences);
    return finalSentences.join('. ') + '.';
}
//# sourceMappingURL=textUtils.js.map