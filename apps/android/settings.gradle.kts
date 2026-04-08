pluginManagement {
  repositories {
    google()
    mavenCentral()
    gradlePluginPortal()
  }
}

dependencyResolutionManagement {
  repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
  repositories {
    google()
    mavenCentral()
  }
}

rootProject.name = "linguride-android"

include(
  ":app",
  ":core-mobile-bridge",
  ":data-local",
  ":data-network",
  ":feature-import",
  ":feature-reader",
  ":feature-settings",
)
