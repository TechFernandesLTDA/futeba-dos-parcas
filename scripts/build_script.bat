@echo off
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
set PATH=%JAVA_HOME%\bin;%PATH%
echo JAVA_HOME is set to: %JAVA_HOME%
echo Starting Gradle build...
call gradlew.bat assembleDebug --stacktrace --no-daemon > build_output.txt 2>&1
echo Build finished. Exit code: %ERRORLEVEL%
type build_output.txt
