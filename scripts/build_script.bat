@echo off
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
set PATH=%JAVA_HOME%\bin;%PATH%
echo JAVA_HOME is set to: %JAVA_HOME%
echo Starting Gradle build...
call gradlew.bat assembleDebug --stacktrace --no-daemon > build_output.txt 2>&1
set GRADLE_EXIT=%ERRORLEVEL%
echo Build finished. Exit code: %GRADLE_EXIT%
type build_output.txt
exit /b %GRADLE_EXIT%
