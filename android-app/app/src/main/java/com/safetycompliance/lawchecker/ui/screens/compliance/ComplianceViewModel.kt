package com.safetycompliance.lawchecker.ui.screens.compliance

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.safetycompliance.lawchecker.data.models.AIResult
import com.safetycompliance.lawchecker.data.models.CompanyProfile
import com.safetycompliance.lawchecker.data.models.CompanySize
import com.safetycompliance.lawchecker.data.models.ComplianceCheck
import com.safetycompliance.lawchecker.data.models.Country
import com.safetycompliance.lawchecker.data.models.Industry
import com.safetycompliance.lawchecker.network.AIService
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ComplianceViewModel @Inject constructor(
    private val aiService: AIService
) : ViewModel() {

    private val _uiState = MutableStateFlow(ComplianceUiState())
    val uiState: StateFlow<ComplianceUiState> = _uiState.asStateFlow()

    fun selectCountry(country: Country) {
        _uiState.update { it.copy(selectedCountry = country) }
    }

    fun selectSize(size: CompanySize) {
        _uiState.update { it.copy(selectedSize = size) }
    }

    fun selectIndustry(industry: Industry) {
        _uiState.update { it.copy(selectedIndustry = industry) }
    }

    fun updateTopic(topic: String) {
        _uiState.update { it.copy(topic = topic) }
    }

    fun checkCompliance() {
        val state = _uiState.value
        if (state.topic.isBlank()) return

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            val companyProfile = CompanyProfile(
                size = state.selectedSize,
                industry = state.selectedIndustry,
                country = state.selectedCountry
            )

            when (val result = aiService.checkCompliance(state.topic, companyProfile)) {
                is AIResult.Success -> {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            complianceCheck = result.data
                        )
                    }
                }
                is AIResult.Error -> {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            error = result.message
                        )
                    }
                }
                AIResult.Loading -> {}
            }
        }
    }
}

data class ComplianceUiState(
    val selectedCountry: Country = Country.AT,
    val selectedSize: CompanySize = CompanySize.SMALL,
    val selectedIndustry: Industry = Industry.LOGISTICS,
    val topic: String = "",
    val isLoading: Boolean = false,
    val complianceCheck: ComplianceCheck? = null,
    val error: String? = null
)
