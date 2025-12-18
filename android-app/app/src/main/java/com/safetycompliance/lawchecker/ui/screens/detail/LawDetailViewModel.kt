package com.safetycompliance.lawchecker.ui.screens.detail

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.safetycompliance.lawchecker.data.models.AIExplanation
import com.safetycompliance.lawchecker.data.models.AIResult
import com.safetycompliance.lawchecker.data.models.Country
import com.safetycompliance.lawchecker.data.models.Law
import com.safetycompliance.lawchecker.data.repository.LawRepository
import com.safetycompliance.lawchecker.network.AIService
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class LawDetailViewModel @Inject constructor(
    private val lawRepository: LawRepository,
    private val aiService: AIService
) : ViewModel() {

    private val _uiState = MutableStateFlow(LawDetailUiState())
    val uiState: StateFlow<LawDetailUiState> = _uiState.asStateFlow()

    fun loadLaw(lawId: String, country: Country) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }

            try {
                lawRepository.initialize()
                val law = lawRepository.getLawById(lawId, country)

                _uiState.update {
                    it.copy(
                        isLoading = false,
                        law = law
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

    fun explainWithAI() {
        val law = _uiState.value.law ?: return

        viewModelScope.launch {
            _uiState.update { it.copy(isExplaining = true) }

            when (val result = aiService.explainLaw(law)) {
                is AIResult.Success -> {
                    _uiState.update {
                        it.copy(
                            isExplaining = false,
                            aiExplanation = result.data
                        )
                    }
                }
                is AIResult.Error -> {
                    _uiState.update {
                        it.copy(
                            isExplaining = false,
                            error = result.message
                        )
                    }
                }
                AIResult.Loading -> {}
            }
        }
    }

    fun toggleBookmark() {
        _uiState.update { it.copy(isBookmarked = !it.isBookmarked) }
        // In a full implementation, save to DataStore
    }

    fun toggleFullText() {
        _uiState.update { it.copy(showFullText = !it.showFullText) }
    }

    fun setManagerView(isManager: Boolean) {
        _uiState.update { it.copy(showManagerView = isManager) }
    }
}

data class LawDetailUiState(
    val isLoading: Boolean = false,
    val law: Law? = null,
    val isBookmarked: Boolean = false,
    val isExplaining: Boolean = false,
    val aiExplanation: AIExplanation? = null,
    val showFullText: Boolean = false,
    val showManagerView: Boolean = true,
    val error: String? = null
)
