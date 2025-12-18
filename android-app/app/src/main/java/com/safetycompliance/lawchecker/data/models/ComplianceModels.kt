package com.safetycompliance.lawchecker.data.models

import kotlinx.serialization.Serializable

@Serializable
data class CompanyProfile(
    val size: CompanySize,
    val industry: Industry,
    val country: Country
)

@Serializable
enum class CompanySize(val displayName: String, val range: String) {
    MICRO("Micro", "1-10 employees"),
    SMALL("Small", "11-50 employees"),
    MEDIUM("Medium", "51-250 employees"),
    LARGE("Large", "250+ employees")
}

@Serializable
enum class Industry(val displayName: String, val icon: String) {
    LOGISTICS("Logistics & Delivery", "🚚"),
    WAREHOUSE("Warehouse & Fulfillment", "📦"),
    MANUFACTURING("Manufacturing", "🏭"),
    CONSTRUCTION("Construction", "🏗️"),
    HEALTHCARE("Healthcare", "🏥"),
    RETAIL("Retail", "🛒"),
    OFFICE("Office & Administration", "💼"),
    TRANSPORT("Transport", "🚛"),
    OTHER("Other", "🔧")
}

@Serializable
data class ComplianceCheck(
    val topic: String,
    val company: CompanyProfile,
    val requirements: List<ComplianceRequirement>,
    val documentation: List<String>,
    val personnelRequirements: List<String>,
    val deadlines: List<Deadline>,
    val penalties: List<Penalty>,
    val implementationSteps: List<String>
)

@Serializable
data class ComplianceRequirement(
    val id: String,
    val title: String,
    val description: String,
    val legalReference: String,
    val priority: Priority,
    val isCompliant: Boolean? = null
)

@Serializable
enum class Priority(val displayName: String, val color: Long) {
    CRITICAL("Critical", 0xFFEF4444),
    HIGH("High", 0xFFF97316),
    MEDIUM("Medium", 0xFFEAB308),
    LOW("Low", 0xFF22C55E)
}

@Serializable
data class Deadline(
    val title: String,
    val frequency: String,
    val nextDue: String? = null
)

@Serializable
data class Penalty(
    val violation: String,
    val minFine: String? = null,
    val maxFine: String? = null,
    val otherConsequences: String? = null
)

@Serializable
data class RiskAssessment(
    val hazardCategory: HazardCategory,
    val likelihood: Int, // 1-5
    val consequence: Int, // 1-5
    val riskScore: Int, // calculated
    val riskLevel: RiskLevel,
    val legalReferences: List<String>,
    val mitigationMeasures: List<String>
)

@Serializable
enum class HazardCategory(val displayName: String, val icon: String) {
    MANUAL_HANDLING("Manual Handling", "💪"),
    SLIPS_TRIPS_FALLS("Slips, Trips & Falls", "⚠️"),
    VEHICLE_TRAFFIC("Vehicle & Traffic", "🚗"),
    MACHINERY("Machinery & Equipment", "⚙️"),
    HAZARDOUS_SUBSTANCES("Hazardous Substances", "☢️"),
    ERGONOMIC("Ergonomic Hazards", "💺"),
    FIRE("Fire & Explosion", "🔥"),
    ELECTRICAL("Electrical", "⚡"),
    PSYCHOLOGICAL("Psychological Stress", "🧠"),
    ENVIRONMENTAL("Environmental", "🌍")
}

@Serializable
enum class RiskLevel(val displayName: String, val color: Long) {
    LOW("Low Risk", 0xFF22C55E),
    MEDIUM("Medium Risk", 0xFFEAB308),
    HIGH("High Risk", 0xFFF97316),
    CRITICAL("Critical Risk", 0xFFEF4444)
}

fun calculateRiskLevel(likelihood: Int, consequence: Int): RiskLevel {
    val score = likelihood * consequence
    return when {
        score >= 20 -> RiskLevel.CRITICAL
        score >= 12 -> RiskLevel.HIGH
        score >= 6 -> RiskLevel.MEDIUM
        else -> RiskLevel.LOW
    }
}
