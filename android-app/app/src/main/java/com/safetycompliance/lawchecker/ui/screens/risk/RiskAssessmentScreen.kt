package com.safetycompliance.lawchecker.ui.screens.risk

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.safetycompliance.lawchecker.data.models.HazardCategory
import com.safetycompliance.lawchecker.data.models.RiskLevel
import com.safetycompliance.lawchecker.data.models.calculateRiskLevel
import com.safetycompliance.lawchecker.ui.components.RiskBadge
import com.safetycompliance.lawchecker.ui.theme.Green60
import com.safetycompliance.lawchecker.ui.theme.Orange60
import com.safetycompliance.lawchecker.ui.theme.Red60

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RiskAssessmentScreen(
    viewModel: RiskAssessmentViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val riskLevel = calculateRiskLevel(uiState.likelihood, uiState.consequence)
    val riskScore = uiState.likelihood * uiState.consequence

    Column(modifier = Modifier.fillMaxSize()) {
        TopAppBar(
            title = {
                Text(
                    text = "Risk Assessment",
                    fontWeight = FontWeight.SemiBold
                )
            },
            colors = TopAppBarDefaults.topAppBarColors(
                containerColor = MaterialTheme.colorScheme.background
            )
        )

        LazyColumn(
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Hazard Category Selection
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "Select Hazard Category",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold
                        )
                        Spacer(modifier = Modifier.height(12.dp))

                        LazyRow(
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            items(HazardCategory.values().toList()) { category ->
                                val isSelected = category == uiState.selectedCategory
                                FilterChip(
                                    selected = isSelected,
                                    onClick = { viewModel.selectCategory(category) },
                                    label = {
                                        Text("${category.icon} ${category.displayName}")
                                    },
                                    colors = FilterChipDefaults.filterChipColors(
                                        selectedContainerColor = MaterialTheme.colorScheme.primaryContainer
                                    )
                                )
                            }
                        }
                    }
                }
            }

            // Risk Matrix
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "Risk Matrix",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold
                        )
                        Spacer(modifier = Modifier.height(16.dp))

                        // Likelihood Slider
                        Text(
                            text = "Likelihood: ${getLikelihoodLabel(uiState.likelihood)}",
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.Medium
                        )
                        Slider(
                            value = uiState.likelihood.toFloat(),
                            onValueChange = { viewModel.setLikelihood(it.toInt()) },
                            valueRange = 1f..5f,
                            steps = 3,
                            colors = SliderDefaults.colors(
                                thumbColor = MaterialTheme.colorScheme.primary,
                                activeTrackColor = MaterialTheme.colorScheme.primary
                            )
                        )
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("Rare", style = MaterialTheme.typography.labelSmall)
                            Text("Almost Certain", style = MaterialTheme.typography.labelSmall)
                        }

                        Spacer(modifier = Modifier.height(24.dp))

                        // Consequence Slider
                        Text(
                            text = "Consequence: ${getConsequenceLabel(uiState.consequence)}",
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.Medium
                        )
                        Slider(
                            value = uiState.consequence.toFloat(),
                            onValueChange = { viewModel.setConsequence(it.toInt()) },
                            valueRange = 1f..5f,
                            steps = 3,
                            colors = SliderDefaults.colors(
                                thumbColor = MaterialTheme.colorScheme.primary,
                                activeTrackColor = MaterialTheme.colorScheme.primary
                            )
                        )
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("Negligible", style = MaterialTheme.typography.labelSmall)
                            Text("Catastrophic", style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }
            }

            // Risk Score Display
            item {
                val backgroundColor by animateColorAsState(
                    targetValue = Color(riskLevel.color).copy(alpha = 0.15f),
                    animationSpec = spring(stiffness = Spring.StiffnessLow),
                    label = "backgroundColor"
                )

                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = backgroundColor)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = "Risk Score",
                            style = MaterialTheme.typography.titleMedium
                        )
                        Spacer(modifier = Modifier.height(8.dp))

                        val scale by animateFloatAsState(
                            targetValue = 1f,
                            animationSpec = spring(
                                dampingRatio = Spring.DampingRatioMediumBouncy,
                                stiffness = Spring.StiffnessMedium
                            ),
                            label = "scale"
                        )

                        Box(
                            modifier = Modifier
                                .size(100.dp)
                                .scale(scale)
                                .clip(CircleShape)
                                .background(Color(riskLevel.color)),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = riskScore.toString(),
                                style = MaterialTheme.typography.displaySmall,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        RiskBadge(riskLevel = riskLevel)

                        Spacer(modifier = Modifier.height(16.dp))

                        Text(
                            text = getRiskDescription(riskLevel),
                            style = MaterialTheme.typography.bodyMedium,
                            textAlign = TextAlign.Center,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                        )
                    }
                }
            }

            // Visual Risk Matrix Grid
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "5x5 Risk Matrix",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold
                        )
                        Spacer(modifier = Modifier.height(16.dp))

                        // Matrix Grid
                        Column {
                            for (consequence in 5 downTo 1) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    for (likelihood in 1..5) {
                                        val cellScore = likelihood * consequence
                                        val cellRisk = calculateRiskLevel(likelihood, consequence)
                                        val isSelected = likelihood == uiState.likelihood &&
                                                consequence == uiState.consequence

                                        Box(
                                            modifier = Modifier
                                                .weight(1f)
                                                .aspectRatio(1f)
                                                .clip(RoundedCornerShape(4.dp))
                                                .background(Color(cellRisk.color).copy(alpha = 0.8f))
                                                .then(
                                                    if (isSelected) {
                                                        Modifier.border(
                                                            3.dp,
                                                            MaterialTheme.colorScheme.onSurface,
                                                            RoundedCornerShape(4.dp)
                                                        )
                                                    } else Modifier
                                                )
                                                .clickable {
                                                    viewModel.setLikelihood(likelihood)
                                                    viewModel.setConsequence(consequence)
                                                },
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Text(
                                                text = cellScore.toString(),
                                                style = MaterialTheme.typography.labelSmall,
                                                color = Color.White,
                                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                                            )
                                        }
                                    }
                                }
                                Spacer(modifier = Modifier.height(4.dp))
                            }
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        // Legend
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceEvenly
                        ) {
                            RiskLevel.values().forEach { level ->
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Box(
                                        modifier = Modifier
                                            .size(12.dp)
                                            .clip(CircleShape)
                                            .background(Color(level.color))
                                    )
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text(
                                        text = level.displayName,
                                        style = MaterialTheme.typography.labelSmall
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // Mitigation Recommendations
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "🛡️ Recommended Controls",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold
                        )
                        Spacer(modifier = Modifier.height(12.dp))

                        getMitigationMeasures(uiState.selectedCategory, riskLevel).forEach { measure ->
                            Row(
                                modifier = Modifier.padding(vertical = 4.dp),
                                verticalAlignment = Alignment.Top
                            ) {
                                Icon(
                                    Icons.Default.ArrowForward,
                                    null,
                                    tint = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier.size(18.dp)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = measure,
                                    style = MaterialTheme.typography.bodyMedium
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

private fun getLikelihoodLabel(value: Int): String = when (value) {
    1 -> "Rare"
    2 -> "Unlikely"
    3 -> "Possible"
    4 -> "Likely"
    5 -> "Almost Certain"
    else -> "Unknown"
}

private fun getConsequenceLabel(value: Int): String = when (value) {
    1 -> "Negligible"
    2 -> "Minor"
    3 -> "Moderate"
    4 -> "Major"
    5 -> "Catastrophic"
    else -> "Unknown"
}

private fun getRiskDescription(level: RiskLevel): String = when (level) {
    RiskLevel.LOW -> "Acceptable risk. Monitor and review periodically."
    RiskLevel.MEDIUM -> "Moderate risk. Implement controls to reduce risk where practical."
    RiskLevel.HIGH -> "High risk. Take action to reduce risk before proceeding."
    RiskLevel.CRITICAL -> "Unacceptable risk. Immediate action required. Do not proceed until risk is reduced."
}

private fun getMitigationMeasures(category: HazardCategory?, level: RiskLevel): List<String> {
    val baseMeasures = when (level) {
        RiskLevel.CRITICAL, RiskLevel.HIGH -> listOf(
            "Implement engineering controls immediately",
            "Provide comprehensive training",
            "Establish strict procedures and permits",
            "Increase supervision and monitoring"
        )
        RiskLevel.MEDIUM -> listOf(
            "Review and improve existing controls",
            "Provide refresher training",
            "Monitor for compliance"
        )
        RiskLevel.LOW -> listOf(
            "Maintain current controls",
            "Regular review schedule"
        )
    }

    val categoryMeasures = when (category) {
        HazardCategory.MANUAL_HANDLING -> listOf(
            "Use mechanical lifting aids",
            "Train on proper lifting techniques",
            "Implement weight limits per task"
        )
        HazardCategory.VEHICLE_TRAFFIC -> listOf(
            "Designate pedestrian walkways",
            "Install traffic mirrors and barriers",
            "Enforce speed limits"
        )
        HazardCategory.FIRE -> listOf(
            "Install fire detection systems",
            "Maintain fire extinguishers",
            "Conduct regular fire drills"
        )
        else -> emptyList()
    }

    return baseMeasures + categoryMeasures
}
