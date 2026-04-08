plugins {
  alias(libs.plugins.android.library)
  alias(libs.plugins.compose.compiler)
}

android {
  namespace = "com.linguride.android.feature.reader"
  compileSdk = 36

  defaultConfig {
    minSdk = 28
  }

  buildFeatures {
    compose = true
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }
}

kotlin {
  compilerOptions {
    jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
  }
}

dependencies {
  implementation(project(":core-mobile-bridge"))
  implementation(libs.androidx.lifecycle.runtime.ktx)
  implementation(libs.androidx.lifecycle.viewmodel.compose)
  implementation(platform(libs.compose.bom))
  implementation("androidx.compose.ui:ui")
  implementation("androidx.compose.material3:material3")
  testImplementation(libs.junit4)
}
