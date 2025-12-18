package com.safetycompliance.lawchecker.ui.screens.home

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.List
import androidx.compose.material.icons.filled.School
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.safetycompliance.lawchecker.data.models.Country
import com.safetycompliance.lawchecker.ui.components.FeatureCard
import com.safetycompliance.lawchecker.ui.components.LawCard
import com.safetycompliance.lawchecker.ui.theme.Blue60
import com.safetycompliance.lawchecker.ui.theme.Green60
import com.safetycompliance.lawchecker.ui.theme.Orange60
import kotlinx.coroutines.delay

@Composable
fun HomeScreen(
    onNavigateToBrowse: () -> Unit,
    onNavigateToCompliance: () -> Unit,
    onNavigateToRisk: () -> Unit,
    onNavigateToSearch: () -> Unit,
    onNavigateToLaw: (String, String) -> Unit,
    viewModel: HomeViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var showContent by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        delay(100)
        showContent = true
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
        contentPadding = PaddingValues(bottom = 24.dp)
    ) {
        // Header
        item {
            AnimatedVisibility(
                visible = showContent,
                enter = fadeIn() + slideInVertically(
                    animationSpec = spring(stiffness = Spring.StiffnessLow),
                    initialOffsetY = { -it }
                )
            ) {
                HomeHeader()
            }
        }

        // Quick Stats
        item {
            AnimatedVisibility(
                visible = showContent,
                enter = fadeIn(
                    animationSpec = spring(stiffness = Spring.StiffnessLow)
                ) + slideInVertically(
                    animationSpec = spring(stiffness = Spring.StiffnessLow, dampingRatio = Spring.DampingRatioMediumBouncy),
                    initialOffsetY = { it / 2 }
                )
            ) {
                QuickStats(
                    lawCount = uiState.totalLaws,
                    countryStats = uiState.countryStats
                )
            }
        }

        // Features Grid
        item {
            Spacer(modifier = Modifier.height(24.dp))
            Text(
                text = "Tools",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(horizontal = 20.dp)
            )
            Spacer(modifier = Modifier.height(12.dp))
        }

        item {
            AnimatedVisibility(
                visible = showContent,
                enter = fadeIn() + slideInVertically(
                    animationSpec = spring(stiffness = Spring.StiffnessLow),
                    initialOffsetY = { it / 3 }
                )
            ) {
                Column(
                    modifier = Modifier.padding(horizontal = 20.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        FeatureCard(
                            title = "Browse Laws",
                            description = "Explore safety regulations",
                            icon = Icons.Default.List,
                            onClick = onNavigateToBrowse,
                            modifier = Modifier.weight(1f),
                            gradientColors = listOf(
                                Orange60.copy(alpha = 0.2f),
                                Orange60.copy(alpha = 0.05f)
                            )
                        )
                        FeatureCard(
                            title = "Search",
                            description = "Find specific laws",
                            icon = Icons.Default.Search,
                            onClick = onNavigateToSearch,
                            modifier = Modifier.weight(1f),
                            gradientColors = listOf(
                                Blue60.copy(alpha = 0.2f),
                                Blue60.copy(alpha = 0.05f)
                            )
                        )
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        FeatureCard(
                            title = "Compliance",
                            description = "Check requirements",
                            icon = Icons.Default.CheckCircle,
                            onClick = onNavigateToCompliance,
                            modifier = Modifier.weight(1f),
                            gradientColors = listOf(
                                Green60.copy(alpha = 0.2f),
                                Green60.copy(alpha = 0.05f)
                            )
                        )
                        FeatureCard(
                            title = "Risk Assessment",
                            description = "Evaluate hazards",
                            icon = Icons.Default.Warning,
                            onClick = onNavigateToRisk,
                            modifier = Modifier.weight(1f),
                            gradientColors = listOf(
                                MaterialTheme.colorScheme.error.copy(alpha = 0.2f),
                                MaterialTheme.colorScheme.error.copy(alpha = 0.05f)
                            )
                        )
                    }
                }
            }
        }

        // Recent Laws
        if (uiState.recentLaws.isNotEmpty()) {
            item {
                Spacer(modifier = Modifier.height(24.dp))
                Text(
                    text = "Recent Laws",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(horizontal = 20.dp)
                )
                Spacer(modifier = Modifier.height(12.dp))
            }

            item {
                LazyRow(
                    contentPadding = PaddingValues(horizontal = 20.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    itemsIndexed(uiState.recentLaws) { index, law ->
                        AnimatedVisibility(
                            visible = showContent,
                            enter = fadeIn() + slideInVertically(
                                animationSpec = spring(
                                    stiffness = Spring.StiffnessLow,
                                    dampingRatio = Spring.DampingRatioMediumBouncy
                                ),
                                initialOffsetY = { it + (index * 50) }
                            )
                        ) {
                            LawCard(
                                title = law.title,
                                abbreviation = law.abbreviation,
                                description = law.description,
                                country = law.country,
                                category = law.category,
                                onClick = { onNavigateToLaw(law.id, law.country.name) },
                                modifier = Modifier.size(width = 280.dp, height = 160.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun HomeHeader() {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                brush = Brush.verticalGradient(
                    colors = listOf(
                        MaterialTheme.colorScheme.primaryContainer,
                        MaterialTheme.colorScheme.background
                    )
                )
            )
            .statusBarsPadding()
            .padding(20.dp)
    ) {
        Column {
            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Default.Shield,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(32.dp)
                )
                Spacer(modifier = Modifier.padding(8.dp))
                Column {
                    Text(
                        text = "Safety Law Checker",
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onBackground
                    )
                    Text(
                        text = "WHS Compliance Navigator",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f)
                    )
                }
            }
        }
    }
}

@Composable
private fun QuickStats(
    lawCount: Int,
    countryStats: Map<Country, Int>
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp),
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surface,
        shadowElevation = 2.dp
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            horizontalArrangement = Arrangement.SpaceEvenly
        ) {
            StatItem(
                label = "Total Laws",
                value = lawCount.toString(),
                icon = Icons.Default.List
            )
            StatItem(
                label = "🇦🇹 Austria",
                value = (countryStats[Country.AT] ?: 0).toString(),
                icon = null
            )
            StatItem(
                label = "🇩🇪 Germany",
                value = (countryStats[Country.DE] ?: 0).toString(),
                icon = null
            )
            StatItem(
                label = "🇳🇱 Netherlands",
                value = (countryStats[Country.NL] ?: 0).toString(),
                icon = null
            )
        }
    }
}

@Composable
private fun StatItem(
    label: String,
    value: String,
    icon: ImageVector?
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        icon?.let {
            Icon(
                imageVector = it,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.height(4.dp))
        }
        Text(
            text = value,
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary
        )
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
        )
    }
}
