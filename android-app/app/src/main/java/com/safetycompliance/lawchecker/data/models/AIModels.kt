package com.safetycompliance.lawchecker.data.models

import kotlinx.serialization.Serializable

@Serializable
data class AIExplanation(
    val summary: String,
    val keyPoints: List<String>,
    val employerDuties: List<String>,
    val employeeRights: List<String>,
    val practicalTips: List<String>,
    val relatedLaws: List<String>? = null
)

@Serializable
data class SimplifiedExplanation(
    val managerVersion: ManagerExplanation,
    val associateVersion: AssociateExplanation
)

@Serializable
data class ManagerExplanation(
    val overview: String,
    val keyRequirements: List<String>,
    val complianceRelevance: String,
    val documentationNeeded: List<String>,
    val actionItems: List<String>
)

@Serializable
data class AssociateExplanation(
    val simpleExplanation: String,
    val bulletPoints: List<BulletPoint>,
    val whatItMeansForYou: String
)

@Serializable
data class BulletPoint(
    val emoji: String,
    val text: String
)

@Serializable
data class GeminiRequest(
    val contents: List<GeminiContent>,
    val generationConfig: GenerationConfig? = null
)

@Serializable
data class GeminiContent(
    val parts: List<GeminiPart>
)

@Serializable
data class GeminiPart(
    val text: String
)

@Serializable
data class GenerationConfig(
    val temperature: Float = 0.2f,
    val maxOutputTokens: Int = 8192,
    val topP: Float = 0.8f,
    val topK: Int = 40
)

@Serializable
data class GeminiResponse(
    val candidates: List<GeminiCandidate>?
)

@Serializable
data class GeminiCandidate(
    val content: GeminiContent?
)

sealed class AIResult<out T> {
    data class Success<T>(val data: T) : AIResult<T>()
    data class Error(val message: String) : AIResult<Nothing>()
    data object Loading : AIResult<Nothing>()
}

@Serializable
data class SearchResult(
    val laws: List<Law>,
    val query: String,
    val totalResults: Int,
    val countries: List<Country>
)

@Serializable
data class Bookmark(
    val lawId: String,
    val title: String,
    val country: Country,
    val addedAt: Long = System.currentTimeMillis(),
    val notes: String? = null
)
