package com.safetycompliance.lawchecker.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.safetycompliance.lawchecker.ui.navigation.Screen
import com.safetycompliance.lawchecker.ui.screens.browse.BrowseLawsScreen
import com.safetycompliance.lawchecker.ui.screens.compliance.ComplianceScreen
import com.safetycompliance.lawchecker.ui.screens.detail.LawDetailScreen
import com.safetycompliance.lawchecker.ui.screens.home.HomeScreen
import com.safetycompliance.lawchecker.ui.screens.risk.RiskAssessmentScreen
import com.safetycompliance.lawchecker.ui.screens.search.SearchScreen
import com.safetycompliance.lawchecker.ui.screens.settings.SettingsScreen

@Composable
fun SafetyLawApp() {
    val navController = rememberNavController()
    var showBottomBar by rememberSaveable { mutableStateOf(true) }

    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    // Hide bottom bar on detail screens
    LaunchedEffect(currentRoute) {
        showBottomBar = currentRoute?.startsWith("law/") != true
    }

    Scaffold(
        bottomBar = {
            AnimatedVisibility(
                visible = showBottomBar,
                enter = slideInVertically(
                    animationSpec = spring(stiffness = Spring.StiffnessMedium),
                    initialOffsetY = { it }
                ),
                exit = slideOutVertically(
                    animationSpec = spring(stiffness = Spring.StiffnessMedium),
                    targetOffsetY = { it }
                )
            ) {
                NavigationBar(
                    containerColor = MaterialTheme.colorScheme.surface,
                    contentColor = MaterialTheme.colorScheme.onSurface
                ) {
                    Screen.bottomNavItems.forEach { screen ->
                        val isSelected = navBackStackEntry?.destination?.hierarchy?.any {
                            it.route == screen.route
                        } == true

                        NavigationBarItem(
                            icon = {
                                Icon(
                                    imageVector = if (isSelected) screen.selectedIcon else screen.unselectedIcon,
                                    contentDescription = screen.title
                                )
                            },
                            label = { Text(screen.title) },
                            selected = isSelected,
                            onClick = {
                                navController.navigate(screen.route) {
                                    popUpTo(navController.graph.findStartDestination().id) {
                                        saveState = true
                                    }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = MaterialTheme.colorScheme.primary,
                                selectedTextColor = MaterialTheme.colorScheme.primary,
                                indicatorColor = MaterialTheme.colorScheme.primaryContainer
                            )
                        )
                    }
                }
            }
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            NavHost(
                navController = navController,
                startDestination = Screen.Home.route
            ) {
                composable(Screen.Home.route) {
                    HomeScreen(
                        onNavigateToBrowse = { navController.navigate(Screen.Browse.route) },
                        onNavigateToCompliance = { navController.navigate(Screen.Compliance.route) },
                        onNavigateToRisk = { navController.navigate(Screen.Risk.route) },
                        onNavigateToSearch = { navController.navigate(Screen.Search.route) },
                        onNavigateToLaw = { lawId, country ->
                            navController.navigate(Screen.LawDetail.createRoute(lawId, country))
                        }
                    )
                }

                composable(Screen.Browse.route) {
                    BrowseLawsScreen(
                        onNavigateToLaw = { lawId, country ->
                            navController.navigate(Screen.LawDetail.createRoute(lawId, country))
                        }
                    )
                }

                composable(Screen.Search.route) {
                    SearchScreen(
                        onNavigateToLaw = { lawId, country ->
                            navController.navigate(Screen.LawDetail.createRoute(lawId, country))
                        }
                    )
                }

                composable(Screen.Compliance.route) {
                    ComplianceScreen()
                }

                composable(Screen.Risk.route) {
                    RiskAssessmentScreen()
                }

                composable(Screen.Settings.route) {
                    SettingsScreen()
                }

                composable(
                    route = Screen.LawDetail.route,
                    arguments = listOf(
                        navArgument("lawId") { type = NavType.StringType },
                        navArgument("country") {
                            type = NavType.StringType
                            defaultValue = "AT"
                        }
                    )
                ) { backStackEntry ->
                    val lawId = backStackEntry.arguments?.getString("lawId") ?: ""
                    val country = backStackEntry.arguments?.getString("country") ?: "AT"
                    LawDetailScreen(
                        lawId = lawId,
                        country = country,
                        onNavigateBack = { navController.popBackStack() }
                    )
                }
            }
        }
    }
}
