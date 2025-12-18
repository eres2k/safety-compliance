package com.safetycompliance.lawchecker.ui.screens.browse

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.safetycompliance.lawchecker.data.models.Country
import com.safetycompliance.lawchecker.data.models.Law
import com.safetycompliance.lawchecker.data.models.LawCategory
import com.safetycompliance.lawchecker.data.repository.LawRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class BrowseLawsViewModel @Inject constructor(
    private val lawRepository: LawRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(BrowseLawsUiState())
    val uiState: StateFlow<BrowseLawsUiState> = _uiState.asStateFlow()

    init {
        loadLaws()
    }

    private fun loadLaws() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }

            try {
                lawRepository.initialize()
                filterLaws()
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

    private fun filterLaws() {
        val state = _uiState.value
        val countries = state.selectedCountries.ifEmpty { Country.values().toSet() }

        var laws = countries.flatMap { country ->
            lawRepository.getAllLaws(country)
        }

        state.selectedCategory?.let { category ->
            laws = laws.filter { it.category == category }
        }

        _uiState.update {
            it.copy(
                isLoading = false,
                laws = laws.take(100)
            )
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
        filterLaws()
    }

    fun selectCategory(category: LawCategory?) {
        _uiState.update { it.copy(selectedCategory = category) }
        filterLaws()
    }
}

data class BrowseLawsUiState(
    val isLoading: Boolean = false,
    val laws: List<Law> = emptyList(),
    val selectedCountries: Set<Country> = emptySet(),
    val selectedCategory: LawCategory? = null,
    val error: String? = null
)
