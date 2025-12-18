package com.safetycompliance.lawchecker.ui.screens.risk

import androidx.lifecycle.ViewModel
import com.safetycompliance.lawchecker.data.models.HazardCategory
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import javax.inject.Inject

@HiltViewModel
class RiskAssessmentViewModel @Inject constructor() : ViewModel() {

    private val _uiState = MutableStateFlow(RiskAssessmentUiState())
    val uiState: StateFlow<RiskAssessmentUiState> = _uiState.asStateFlow()

    fun selectCategory(category: HazardCategory) {
        _uiState.update { it.copy(selectedCategory = category) }
    }

    fun setLikelihood(value: Int) {
        _uiState.update { it.copy(likelihood = value.coerceIn(1, 5)) }
    }

    fun setConsequence(value: Int) {
        _uiState.update { it.copy(consequence = value.coerceIn(1, 5)) }
    }
}

data class RiskAssessmentUiState(
    val selectedCategory: HazardCategory = HazardCategory.MANUAL_HANDLING,
    val likelihood: Int = 3,
    val consequence: Int = 3
)
