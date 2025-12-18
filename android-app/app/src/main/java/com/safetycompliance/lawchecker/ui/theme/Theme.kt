package com.safetycompliance.lawchecker.ui.theme

import android.app.Activity
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val LightColorScheme = lightColorScheme(
    // Primary
    primary = Orange60,
    onPrimary = Color.White,
    primaryContainer = Orange90,
    onPrimaryContainer = Orange20,

    // Secondary
    secondary = Blue60,
    onSecondary = Color.White,
    secondaryContainer = Blue90,
    onSecondaryContainer = Blue20,

    // Tertiary
    tertiary = Green60,
    onTertiary = Color.White,
    tertiaryContainer = Green90,
    onTertiaryContainer = Green20,

    // Error
    error = Red60,
    onError = Color.White,
    errorContainer = Red90,
    onErrorContainer = Red20,

    // Background
    background = Stone95,
    onBackground = Stone10,

    // Surface
    surface = Stone99,
    onSurface = Stone10,
    surfaceVariant = Stone90,
    onSurfaceVariant = Stone40,

    // Outline
    outline = Stone50,
    outlineVariant = Stone70,

    // Inverse
    inverseSurface = Stone20,
    inverseOnSurface = Stone90,
    inversePrimary = Orange80
)

private val DarkColorScheme = darkColorScheme(
    // Primary
    primary = Orange70,
    onPrimary = Orange20,
    primaryContainer = Orange40,
    onPrimaryContainer = Orange90,

    // Secondary
    secondary = Blue70,
    onSecondary = Blue20,
    secondaryContainer = Blue40,
    onSecondaryContainer = Blue90,

    // Tertiary
    tertiary = Green70,
    onTertiary = Green20,
    tertiaryContainer = Green40,
    onTertiaryContainer = Green90,

    // Error
    error = Red70,
    onError = Red20,
    errorContainer = Red40,
    onErrorContainer = Red90,

    // Background
    background = Stone10,
    onBackground = Stone90,

    // Surface
    surface = Stone20,
    onSurface = Stone90,
    surfaceVariant = Stone30,
    onSurfaceVariant = Stone70,

    // Outline
    outline = Stone60,
    outlineVariant = Stone40,

    // Inverse
    inverseSurface = Stone90,
    inverseOnSurface = Stone20,
    inversePrimary = Orange50
)

@Composable
fun SafetyLawCheckerTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = true,
    content: @Composable () -> Unit
) {
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }
        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = Color.Transparent.toArgb()
            window.navigationBarColor = Color.Transparent.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !darkTheme
            WindowCompat.getInsetsController(window, view).isAppearanceLightNavigationBars = !darkTheme
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
