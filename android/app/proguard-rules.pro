# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# --- Vérif ---
# Plugins maison (appelés par leur nom depuis la page) et tâche WorkManager (instanciée par réflexion).
-keep class fr.johnbsoftware.verif.** { *; }
-keep class * extends androidx.work.ListenableWorker {
    public <init>(android.content.Context, androidx.work.WorkerParameters);
}
# Capacitor : le pont JavaScript appelle les méthodes des plugins par réflexion.
-keep class com.getcapacitor.** { *; }
-keepattributes *Annotation*, Signature, InnerClasses, EnclosingMethod
