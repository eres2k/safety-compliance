package com.safetycompliance.lawchecker.ui.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.List
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.List
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.Warning
import androidx.compose.ui.graphics.vector.ImageVector

sealed class Screen(
    val route: String,
    val title: String,
    val selectedIcon: ImageVector,
    val unselectedIcon: ImageVector
) {
    data object Home : Screen(
        route = "home",
        title = "Home",
        selectedIcon = Icons.Filled.Home,
        unselectedIcon = Icons.Outlined.Home
    )

    data object Browse : Screen(
        route = "browse",
        title = "Laws",
        selectedIcon = Icons.Filled.List,
        unselectedIcon = Icons.Outlined.List
    )

    data object Search : Screen(
        route = "search",
        title = "Search",
        selectedIcon = Icons.Filled.Search,
        unselectedIcon = Icons.Outlined.Search
    )

    data object Compliance : Screen(
        route = "compliance",
        title = "Compliance",
        selectedIcon = Icons.Filled.CheckCircle,
        unselectedIcon = Icons.Outlined.CheckCircle
    )

    data object Risk : Screen(
        route = "risk",
        title = "Risk",
        selectedIcon = Icons.Filled.Warning,
        unselectedIcon = Icons.Outlined.Warning
    )

    data object Settings : Screen(
        route = "settings",
        title = "Settings",
        selectedIcon = Icons.Filled.Settings,
        unselectedIcon = Icons.Outlined.Settings
    )

    data object LawDetail : Screen(
        route = "law/{lawId}?country={country}",
        title = "Law Detail",
        selectedIcon = Icons.Filled.List,
        unselectedIcon = Icons.Outlined.List
    ) {
        fun createRoute(lawId: String, country: String): String {
            return "law/$lawId?country=$country"
        }
    }

    companion object {
        val bottomNavItems = listOf(Home, Browse, Search, Compliance, Risk)
    }
}
