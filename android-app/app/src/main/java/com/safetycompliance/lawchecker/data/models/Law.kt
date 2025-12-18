package com.safetycompliance.lawchecker.data.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class Law(
    val id: String,
    val title: String,
    val abbreviation: String? = null,
    val description: String? = null,
    val type: String? = null,
    val content: LawContent? = null,
    val summary: String? = null,
    val chapters: List<Chapter>? = null,
    @SerialName("whs_summary")
    val whsSummary: String? = null,
    val keywords: List<String>? = null,
    @SerialName("relatedIds")
    val relatedIds: List<String>? = null,
    val country: Country = Country.AT,
    val category: LawCategory? = null
)

@Serializable
data class LawContent(
    @SerialName("full_text")
    val fullText: String? = null,
    val available: Boolean = true,
    val format: String? = null,
    val sections: List<Section>? = null
)

@Serializable
data class Section(
    val id: String? = null,
    val title: String? = null,
    val number: String? = null,
    val text: String? = null,
    val articles: List<Article>? = null
)

@Serializable
data class Article(
    val id: String? = null,
    val number: String? = null,
    val title: String? = null,
    val text: String? = null
)

@Serializable
data class Chapter(
    val id: String? = null,
    val title: String? = null,
    val number: String? = null,
    val articles: List<Article>? = null,
    val sections: List<Section>? = null
)

@Serializable
enum class Country {
    @SerialName("AT") AT,
    @SerialName("DE") DE,
    @SerialName("NL") NL
}

enum class LawCategory(val emoji: String, val displayName: String) {
    RISK_ASSESSMENT("⚠️", "Risk Assessment"),
    WORKPLACE_SAFETY("🏭", "Workplace Safety"),
    TRAINING("📚", "Training & Education"),
    PPE("🦺", "Personal Protective Equipment"),
    FIRST_AID("🏥", "First Aid"),
    FIRE_SAFETY("🔥", "Fire Safety"),
    HAZARDOUS_MATERIALS("☢️", "Hazardous Materials"),
    ERGONOMICS("💺", "Ergonomics"),
    MACHINERY("⚙️", "Machinery Safety"),
    VEHICLE_SAFETY("🚗", "Vehicle Safety"),
    DOCUMENTATION("📋", "Documentation"),
    GENERAL("📖", "General")
}

@Serializable
data class LawDatabase(
    val laws: List<Law>,
    val metadata: DatabaseMetadata? = null
)

@Serializable
data class DatabaseMetadata(
    val version: String? = null,
    val lastUpdated: String? = null,
    val country: Country? = null
)
