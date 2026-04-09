plugins {
  alias(libs.plugins.android.library)
}

val rustJniLibsDir = layout.buildDirectory.dir("generated/jniLibs")
val rustBuildScript = rootProject.projectDir.resolve("scripts/build-rust-android.sh")

android {
  namespace = "com.linguride.android.mobile"
  compileSdk = 36

  defaultConfig {
    minSdk = 28
  }

  sourceSets["main"].jniLibs.srcDir("build/generated/jniLibs")

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
  implementation(libs.androidx.core.ktx)
  testImplementation(libs.junit4)
  testImplementation("org.json:json:20240303")
}

val prepareRustJniLibs by tasks.registering(Exec::class) {
  group = "build"
  description = "Builds the mobile-core Rust JNI libraries for Android packaging."

  commandLine("bash", rustBuildScript.absolutePath)
  workingDir = rootProject.projectDir.parentFile.parentFile

  System.getenv("ANDROID_SDK_ROOT")?.let { environment("ANDROID_SDK_ROOT", it) }
  System.getenv("ANDROID_NDK_HOME")?.let { environment("ANDROID_NDK_HOME", it) }
  System.getenv("ANDROID_NDK_ROOT")?.let { environment("ANDROID_NDK_ROOT", it) }

  inputs.file(rustBuildScript)
  inputs.file(rootProject.projectDir.parentFile.parentFile.resolve("Cargo.toml"))
  inputs.dir(rootProject.projectDir.parentFile.parentFile.resolve("bindings/mobile-core"))
  outputs.dir(rustJniLibsDir)
}

tasks.matching { task ->
  task.name.contains("JniLibFolders") || task.name.contains("JniLibsProjectOnly")
}.configureEach {
  dependsOn(prepareRustJniLibs)
}
