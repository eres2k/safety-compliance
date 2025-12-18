package com.safetycompliance.lawchecker.network

import com.safetycompliance.lawchecker.BuildConfig
import com.safetycompliance.lawchecker.data.models.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AIService @Inject constructor(
    private val geminiApi: GeminiApiService
) {
    private val apiKey = BuildConfig.GEMINI_API_KEY

    suspend fun explainLaw(law: Law, complexity: ExplanationComplexity = ExplanationComplexity.MANAGER): AIResult<AIExplanation> =
        withContext(Dispatchers.IO) {
            try {
                val prompt = buildExplanationPrompt(law, complexity)
                val response = callGemini(prompt)
                AIResult.Success(parseExplanation(response))
            } catch (e: Exception) {
                AIResult.Error(e.message ?: "Failed to explain law")
            }
        }

    suspend fun checkCompliance(
        topic: String,
        company: CompanyProfile
    ): AIResult<ComplianceCheck> = withContext(Dispatchers.IO) {
        try {
            val prompt = buildCompliancePrompt(topic, company)
            val response = callGemini(prompt)
            AIResult.Success(parseComplianceCheck(response, topic, company))
        } catch (e: Exception) {
            AIResult.Error(e.message ?: "Failed to check compliance")
        }
    }

    suspend fun simplifyForBothLevels(law: Law): AIResult<SimplifiedExplanation> =
        withContext(Dispatchers.IO) {
            try {
                val prompt = buildSimplifyPrompt(law)
                val response = callGemini(prompt)
                AIResult.Success(parseSimplifiedExplanation(response))
            } catch (e: Exception) {
                AIResult.Error(e.message ?: "Failed to simplify")
            }
        }

    private suspend fun callGemini(prompt: String): String {
        val request = GeminiRequest(
            contents = listOf(
                GeminiContent(
                    parts = listOf(GeminiPart(text = prompt))
                )
            ),
            generationConfig = GenerationConfig(
                temperature = 0.2f,
                maxOutputTokens = 4096
            )
        )

        val response = geminiApi.generateContent(apiKey, request)
        return response.candidates?.firstOrNull()?.content?.parts?.firstOrNull()?.text
            ?: throw Exception("Empty response from AI")
    }

    private fun buildExplanationPrompt(law: Law, complexity: ExplanationComplexity): String {
        val levelDescription = when (complexity) {
            ExplanationComplexity.MANAGER -> "for a workplace manager who needs to ensure compliance"
            ExplanationComplexity.ASSOCIATE -> "in very simple terms for an entry-level employee, like explaining to a 5-year-old"
        }

        return """
            You are an expert in European workplace health and safety law.

            Please explain the following law $levelDescription:

            Title: ${law.title}
            ${law.abbreviation?.let { "Abbreviation: $it" } ?: ""}
            ${law.description?.let { "Description: $it" } ?: ""}
            ${law.summary?.let { "Summary: $it" } ?: ""}
            ${law.content?.fullText?.take(3000)?.let { "Content excerpt: $it..." } ?: ""}

            Provide your response in this exact JSON format:
            {
                "summary": "A clear 2-3 sentence summary",
                "keyPoints": ["point 1", "point 2", "point 3"],
                "employerDuties": ["duty 1", "duty 2"],
                "employeeRights": ["right 1", "right 2"],
                "practicalTips": ["tip 1", "tip 2", "tip 3"]
            }

            Only return valid JSON, no additional text.
        """.trimIndent()
    }

    private fun buildCompliancePrompt(topic: String, company: CompanyProfile): String {
        val countryName = when (company.country) {
            Country.AT -> "Austria (ASchG)"
            Country.DE -> "Germany (ArbSchG/DGUV)"
            Country.NL -> "Netherlands (Arbowet)"
        }

        return """
            You are an expert in European workplace health and safety compliance.

            A ${company.size.displayName} company (${company.size.range}) in the ${company.industry.displayName} industry
            in $countryName needs compliance guidance for: "$topic"

            Provide your response in this exact JSON format:
            {
                "requirements": [
                    {"title": "requirement name", "description": "what's required", "legalReference": "§ section", "priority": "CRITICAL|HIGH|MEDIUM|LOW"}
                ],
                "documentation": ["document 1", "document 2"],
                "personnelRequirements": ["requirement 1", "requirement 2"],
                "deadlines": [{"title": "deadline name", "frequency": "how often"}],
                "penalties": [{"violation": "type", "maxFine": "amount", "otherConsequences": "other"}],
                "implementationSteps": ["step 1", "step 2", "step 3"]
            }

            Be specific to ${company.country.name} law. Only return valid JSON, no additional text.
        """.trimIndent()
    }

    private fun buildSimplifyPrompt(law: Law): String {
        return """
            You are an expert at explaining complex legal text in simple terms.

            Please explain this workplace safety law in TWO versions:

            Title: ${law.title}
            ${law.content?.fullText?.take(2000) ?: law.summary ?: law.description ?: ""}

            Provide your response in this exact JSON format:
            {
                "managerVersion": {
                    "overview": "Brief overview",
                    "keyRequirements": ["requirement 1", "requirement 2"],
                    "complianceRelevance": "Why this matters for compliance",
                    "documentationNeeded": ["doc 1", "doc 2"],
                    "actionItems": ["action 1", "action 2"]
                },
                "associateVersion": {
                    "simpleExplanation": "Explain like I'm 5",
                    "bulletPoints": [
                        {"emoji": "🦺", "text": "simple point 1"},
                        {"emoji": "✅", "text": "simple point 2"}
                    ],
                    "whatItMeansForYou": "How this affects the average worker"
                }
            }

            Only return valid JSON, no additional text.
        """.trimIndent()
    }

    private fun parseExplanation(response: String): AIExplanation {
        // Clean the response and parse JSON
        val cleaned = response.trim()
            .removePrefix("```json")
            .removePrefix("```")
            .removeSuffix("```")
            .trim()

        // Simple parsing - in production use proper JSON parsing
        return try {
            val gson = com.google.gson.Gson()
            gson.fromJson(cleaned, AIExplanation::class.java)
        } catch (e: Exception) {
            AIExplanation(
                summary = cleaned.take(500),
                keyPoints = listOf("Unable to parse structured response"),
                employerDuties = emptyList(),
                employeeRights = emptyList(),
                practicalTips = emptyList()
            )
        }
    }

    private fun parseComplianceCheck(response: String, topic: String, company: CompanyProfile): ComplianceCheck {
        val cleaned = response.trim()
            .removePrefix("```json")
            .removePrefix("```")
            .removeSuffix("```")
            .trim()

        return try {
            val gson = com.google.gson.Gson()
            val parsed = gson.fromJson(cleaned, ComplianceCheckJson::class.java)

            ComplianceCheck(
                topic = topic,
                company = company,
                requirements = parsed.requirements?.map {
                    ComplianceRequirement(
                        id = java.util.UUID.randomUUID().toString(),
                        title = it.title ?: "",
                        description = it.description ?: "",
                        legalReference = it.legalReference ?: "",
                        priority = try {
                            Priority.valueOf(it.priority ?: "MEDIUM")
                        } catch (e: Exception) {
                            Priority.MEDIUM
                        }
                    )
                } ?: emptyList(),
                documentation = parsed.documentation ?: emptyList(),
                personnelRequirements = parsed.personnelRequirements ?: emptyList(),
                deadlines = parsed.deadlines?.map {
                    Deadline(title = it.title ?: "", frequency = it.frequency ?: "")
                } ?: emptyList(),
                penalties = parsed.penalties?.map {
                    Penalty(
                        violation = it.violation ?: "",
                        maxFine = it.maxFine,
                        otherConsequences = it.otherConsequences
                    )
                } ?: emptyList(),
                implementationSteps = parsed.implementationSteps ?: emptyList()
            )
        } catch (e: Exception) {
            ComplianceCheck(
                topic = topic,
                company = company,
                requirements = emptyList(),
                documentation = emptyList(),
                personnelRequirements = emptyList(),
                deadlines = emptyList(),
                penalties = emptyList(),
                implementationSteps = listOf("Error parsing response: ${e.message}")
            )
        }
    }

    private fun parseSimplifiedExplanation(response: String): SimplifiedExplanation {
        val cleaned = response.trim()
            .removePrefix("```json")
            .removePrefix("```")
            .removeSuffix("```")
            .trim()

        return try {
            val gson = com.google.gson.Gson()
            gson.fromJson(cleaned, SimplifiedExplanation::class.java)
        } catch (e: Exception) {
            SimplifiedExplanation(
                managerVersion = ManagerExplanation(
                    overview = "Unable to parse response",
                    keyRequirements = emptyList(),
                    complianceRelevance = "",
                    documentationNeeded = emptyList(),
                    actionItems = emptyList()
                ),
                associateVersion = AssociateExplanation(
                    simpleExplanation = "Unable to parse response",
                    bulletPoints = emptyList(),
                    whatItMeansForYou = ""
                )
            )
        }
    }
}

enum class ExplanationComplexity {
    MANAGER, ASSOCIATE
}

// JSON parsing helper classes
data class ComplianceCheckJson(
    val requirements: List<RequirementJson>?,
    val documentation: List<String>?,
    val personnelRequirements: List<String>?,
    val deadlines: List<DeadlineJson>?,
    val penalties: List<PenaltyJson>?,
    val implementationSteps: List<String>?
)

data class RequirementJson(
    val title: String?,
    val description: String?,
    val legalReference: String?,
    val priority: String?
)

data class DeadlineJson(
    val title: String?,
    val frequency: String?
)

data class PenaltyJson(
    val violation: String?,
    val maxFine: String?,
    val otherConsequences: String?
)
