# Safety Law Checker - Android App

A modern Android application for checking workplace health and safety (WHS) compliance laws across European countries (Austria, Germany, Netherlands).

## Features

- **Browse Laws**: Explore safety regulations by country and category
- **Smart Search**: Full-text search across all law databases
- **Compliance Checker**: Get AI-powered compliance requirements based on your company profile
- **Risk Assessment**: Interactive 5x5 risk matrix with mitigation recommendations
- **AI Explanations**: Get laws explained in simple terms (Manager view / Simple view)
- **Offline Support**: Laws are bundled with the app for offline access
- **Modern UI**: Material3 design with smooth animations and dark mode support

## Tech Stack

- **Language**: Kotlin
- **UI**: Jetpack Compose with Material3
- **Architecture**: MVVM with Clean Architecture
- **DI**: Hilt
- **Networking**: Retrofit + OkHttp
- **AI**: Google Gemini API
- **Navigation**: Jetpack Navigation Compose

## Building the App

### Prerequisites

- Android Studio Hedgehog (2023.1.1) or newer
- JDK 17
- Android SDK 34

### Setup

1. Clone the repository
2. Open the `android-app` folder in Android Studio
3. Add your Gemini API key to `local.properties`:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```
4. Sync Gradle and build the project

### Build Commands

```bash
# Debug build
./gradlew assembleDebug

# Release build (requires signing config)
./gradlew assembleRelease

# Install on connected device
./gradlew installDebug
```

## Project Structure

```
app/
├── src/main/
│   ├── java/com/safetycompliance/lawchecker/
│   │   ├── data/
│   │   │   ├── models/          # Data classes
│   │   │   ├── local/           # Database loader
│   │   │   └── repository/      # Data repositories
│   │   ├── di/                  # Hilt modules
│   │   ├── network/             # API services
│   │   ├── ui/
│   │   │   ├── components/      # Reusable UI components
│   │   │   ├── navigation/      # Navigation setup
│   │   │   ├── screens/         # Feature screens
│   │   │   └── theme/           # Material3 theming
│   │   └── util/                # Utilities
│   ├── assets/laws/             # Bundled law databases
│   └── res/                     # Android resources
└── build.gradle.kts             # App-level build config
```

## Screens

1. **Home**: Dashboard with quick stats and feature navigation
2. **Browse Laws**: Filter laws by country and category
3. **Search**: Full-text search with country filters
4. **Compliance**: Check compliance requirements with AI assistance
5. **Risk Assessment**: Interactive risk matrix tool
6. **Law Detail**: Detailed law view with AI explanations

## API Integration

The app uses Google Gemini API for:
- Law explanations (Manager vs Simple view)
- Compliance requirement generation
- Law simplification

Configure your API key in `local.properties` or as a build config field.

## Countries Supported

- 🇦🇹 **Austria** - ASchG, AStV, AM-VO, PSA-V, KennV
- 🇩🇪 **Germany** - ArbSchG, DGUV V1, ArbStättV, BetrSichV, GefStoffV, LasthandhabV
- 🇳🇱 **Netherlands** - Arbowet, Arbobesluit, Arboregeling, RI&E, PBM

## License

This project is part of the Safety Compliance Navigator suite.
