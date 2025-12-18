package com.safetycompliance.lawchecker.ui.screens.search

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.safetycompliance.lawchecker.data.models.Country
import com.safetycompliance.lawchecker.data.models.Law
import com.safetycompliance.lawchecker.data.repository.LawRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SearchViewModel @Inject constructor(
    private val lawRepository: LawRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(SearchUiState())
    val uiState: StateFlow<SearchUiState> = _uiState.asStateFlow()

    private var searchJob: Job? = null

    init {
        viewModelScope.launch {
            lawRepository.initialize()
        }
    }

    fun updateQuery(query: String) {
        _uiState.update { it.copy(query = query) }

        // Debounced search
        searchJob?.cancel()
        searchJob = viewModelScope.launch {
            delay(300) // Debounce
            if (query.length >= 2) {
                search()
            }
        }
    }

    fun search() {
        val state = _uiState.value
        if (state.query.isBlank()) return

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, hasSearched = true) }

            try {
                val countries = state.selectedCountries.ifEmpty { null }?.toList()
                lawRepository.searchLaws(state.query, countries).collect { result ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            results = result.laws
                        )
                    }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        error = e.message
                    )
                }
            }
        }
    }

    fun toggleCountry(country: Country) {
        _uiState.update { state ->
            val newCountries = state.selectedCountries.toMutableSet()
            if (country in newCountries) {
                newCountries.remove(country)
            } else {
                newCountries.add(country)
            }
            state.copy(selectedCountries = newCountries)
        }

        if (_uiState.value.query.isNotEmpty()) {
            search()
        }
    }

    fun clearSearch() {
        _uiState.update {
            it.copy(
                query = "",
                results = emptyList(),
                hasSearched = false
            )
        }
    }
}

data class SearchUiState(
    val query: String = "",
    val isLoading: Boolean = false,
    val results: List<Law> = emptyList(),
    val selectedCountries: Set<Country> = emptySet(),
    val hasSearched: Boolean = false,
    val error: String? = null
)
