package com.safetycompliance.lawchecker.data.repository

import com.safetycompliance.lawchecker.data.local.LawDatabaseLoader
import com.safetycompliance.lawchecker.data.models.*
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class LawRepository @Inject constructor(
    private val databaseLoader: LawDatabaseLoader
) {
    suspend fun initialize() {
        databaseLoader.initialize()
    }

    fun getAllLaws(country: Country? = null): List<Law> {
        return databaseLoader.getAllLaws(country)
    }

    fun searchLaws(query: String, countries: List<Country>? = null): Flow<SearchResult> = flow {
        val results = databaseLoader.searchLaws(query, countries)
        emit(
            SearchResult(
                laws = results,
                query = query,
                totalResults = results.size,
                countries = countries ?: Country.values().toList()
            )
        )
    }

    fun getLawById(id: String, country: Country? = null): Law? {
        return databaseLoader.getLawById(id, country)
    }

    fun getLawsByCategory(category: LawCategory, country: Country? = null): List<Law> {
        return databaseLoader.getLawsByCategory(category, country)
    }

    fun getRelatedLaws(law: Law): List<Law> {
        return databaseLoader.getRelatedLaws(law)
    }

    fun getCountryStats(): Map<Country, Int> {
        return Country.values().associateWith { databaseLoader.getLawCount(it) }
    }

    fun getCategoryStats(country: Country? = null): Map<LawCategory, Int> {
        val laws = getAllLaws(country)
        return LawCategory.values().associateWith { category ->
            laws.count { it.category == category }
        }
    }

    fun getRecentlyViewed(): List<Law> {
        // This would be stored in DataStore in a real implementation
        return emptyList()
    }
}
