package com.safetycompliance.lawchecker.data.local

import android.content.Context
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.safetycompliance.lawchecker.data.models.Country
import com.safetycompliance.lawchecker.data.models.Law
import com.safetycompliance.lawchecker.data.models.LawCategory
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class LawDatabaseLoader @Inject constructor(
    @ApplicationContext private val context: Context,
    private val gson: Gson
) {
    private var lawsCache: Map<Country, List<Law>> = emptyMap()
    private var isInitialized = false

    suspend fun initialize() = withContext(Dispatchers.IO) {
        if (isInitialized) return@withContext

        val atLaws = loadLawsFromAssets("laws/at_database.json", Country.AT)
        val deLaws = loadLawsFromAssets("laws/de_database.json", Country.DE)
        val nlLaws = loadLawsFromAssets("laws/nl_database.json", Country.NL)

        lawsCache = mapOf(
            Country.AT to atLaws,
            Country.DE to deLaws,
            Country.NL to nlLaws
        )

        isInitialized = true
    }

    private fun loadLawsFromAssets(path: String, country: Country): List<Law> {
        return try {
            val jsonString = context.assets.open(path).bufferedReader().use { it.readText() }
            val type = object : TypeToken<LawDatabaseJson>() {}.type
            val database: LawDatabaseJson = gson.fromJson(jsonString, type)

            database.laws.map { lawJson ->
                lawJson.toLaw(country)
            }
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    fun getAllLaws(country: Country? = null): List<Law> {
        return if (country != null) {
            lawsCache[country] ?: emptyList()
        } else {
            lawsCache.values.flatten()
        }
    }

    fun searchLaws(query: String, countries: List<Country>? = null): List<Law> {
        val searchTerms = query.lowercase().split(" ").filter { it.length > 2 }
        if (searchTerms.isEmpty()) return emptyList()

        val targetLaws = if (countries.isNullOrEmpty()) {
            getAllLaws()
        } else {
            countries.flatMap { lawsCache[it] ?: emptyList() }
        }

        return targetLaws.filter { law ->
            val searchableText = buildSearchableText(law).lowercase()
            searchTerms.all { term -> searchableText.contains(term) }
        }.sortedByDescending { law ->
            // Rank by relevance
            val searchableText = buildSearchableText(law).lowercase()
            searchTerms.count { term ->
                law.title.lowercase().contains(term)
            } * 10 + searchTerms.count { term ->
                searchableText.contains(term)
            }
        }.take(50)
    }

    private fun buildSearchableText(law: Law): String {
        return buildString {
            append(law.title)
            append(" ")
            append(law.abbreviation ?: "")
            append(" ")
            append(law.description ?: "")
            append(" ")
            append(law.summary ?: "")
            append(" ")
            append(law.whsSummary ?: "")
            append(" ")
            append(law.keywords?.joinToString(" ") ?: "")
            append(" ")
            law.content?.fullText?.let { append(it.take(5000)) }
        }
    }

    fun getLawById(id: String, country: Country? = null): Law? {
        val targetLaws = if (country != null) {
            lawsCache[country] ?: emptyList()
        } else {
            getAllLaws()
        }
        return targetLaws.find { it.id == id }
    }

    fun getLawsByCategory(category: LawCategory, country: Country? = null): List<Law> {
        return getAllLaws(country).filter { it.category == category }
    }

    fun getRelatedLaws(law: Law): List<Law> {
        val relatedIds = law.relatedIds ?: return emptyList()
        return getAllLaws(law.country).filter { it.id in relatedIds }
    }

    fun getLawCount(country: Country? = null): Int {
        return getAllLaws(country).size
    }
}

// JSON models for parsing
data class LawDatabaseJson(
    val laws: List<LawJson> = emptyList()
)

data class LawJson(
    val id: String? = null,
    val title: String = "",
    val abbreviation: String? = null,
    val description: String? = null,
    val type: String? = null,
    val content: LawContentJson? = null,
    val summary: String? = null,
    val chapters: List<Any>? = null,
    val whs_summary: String? = null,
    val keywords: List<String>? = null,
    val relatedIds: List<String>? = null
) {
    fun toLaw(country: Country): Law {
        return Law(
            id = id ?: java.util.UUID.randomUUID().toString(),
            title = title,
            abbreviation = abbreviation,
            description = description,
            type = type,
            content = content?.toLawContent(),
            summary = summary,
            whsSummary = whs_summary,
            keywords = keywords,
            relatedIds = relatedIds,
            country = country,
            category = categorizeByKeywords(keywords, title, description)
        )
    }
}

data class LawContentJson(
    val full_text: String? = null,
    val available: Boolean = true,
    val format: String? = null
) {
    fun toLawContent() = com.safetycompliance.lawchecker.data.models.LawContent(
        fullText = full_text,
        available = available,
        format = format
    )
}

private fun categorizeByKeywords(
    keywords: List<String>?,
    title: String,
    description: String?
): LawCategory {
    val searchText = (keywords?.joinToString(" ") ?: "") + " " + title + " " + (description ?: "")
    val lowerText = searchText.lowercase()

    return when {
        lowerText.containsAny("risk", "gefährdung", "risico", "assessment", "beurteilung") ->
            LawCategory.RISK_ASSESSMENT
        lowerText.containsAny("ppe", "schutzausrüstung", "protective", "beschermingsmiddel") ->
            LawCategory.PPE
        lowerText.containsAny("training", "schulung", "instruction", "opleiding", "unterweisung") ->
            LawCategory.TRAINING
        lowerText.containsAny("first aid", "erste hilfe", "ehbo", "notfall") ->
            LawCategory.FIRST_AID
        lowerText.containsAny("fire", "brand", "feuer", "emergency") ->
            LawCategory.FIRE_SAFETY
        lowerText.containsAny("hazardous", "gefährlich", "chemical", "chemisch", "toxic") ->
            LawCategory.HAZARDOUS_MATERIALS
        lowerText.containsAny("ergonomic", "workplace design", "arbeitsplatz", "werkplek") ->
            LawCategory.ERGONOMICS
        lowerText.containsAny("machine", "maschine", "equipment", "gerät") ->
            LawCategory.MACHINERY
        lowerText.containsAny("vehicle", "fahrzeug", "transport", "forklift", "stapler") ->
            LawCategory.VEHICLE_SAFETY
        lowerText.containsAny("document", "record", "aufzeichnung", "registratie") ->
            LawCategory.DOCUMENTATION
        lowerText.containsAny("workplace", "arbeitsstätte", "werkplek", "safety") ->
            LawCategory.WORKPLACE_SAFETY
        else -> LawCategory.GENERAL
    }
}

private fun String.containsAny(vararg terms: String): Boolean {
    return terms.any { this.contains(it, ignoreCase = true) }
}
