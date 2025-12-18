package com.safetycompliance.lawchecker.ui.screens.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.safetycompliance.lawchecker.data.models.Country
import com.safetycompliance.lawchecker.data.models.Law
import com.safetycompliance.lawchecker.data.repository.LawRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val lawRepository: LawRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    init {
        loadData()
    }

    private fun loadData() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }

            try {
                lawRepository.initialize()

                val countryStats = lawRepository.getCountryStats()
                val totalLaws = countryStats.values.sum()
                val recentLaws = lawRepository.getAllLaws().take(10)

                _uiState.update {
                    it.copy(
                        isLoading = false,
                        totalLaws = totalLaws,
                        countryStats = countryStats,
                        recentLaws = recentLaws
                    )
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
}

data class HomeUiState(
    val isLoading: Boolean = false,
    val totalLaws: Int = 0,
    val countryStats: Map<Country, Int> = emptyMap(),
    val recentLaws: List<Law> = emptyList(),
    val error: String? = null
)
