Pod::Spec.new do |spec|
    spec.name                     = 'shared'
    spec.version                  = '1.4.0'
    spec.homepage                 = 'https://github.com/futebadosparcas'
    spec.source                   = { :http=> ''}
    spec.authors                  = 'Futeba dos Parças Team'
    spec.license                  = 'MIT'
    spec.summary                  = 'Shared KMP module for Futeba dos Parças (Android & iOS)'
    spec.vendored_frameworks      = 'build/cocoapods/framework/shared.framework'
    spec.libraries                = 'c++'
    spec.ios.deployment_target    = '14.0'

    spec.pod_target_xcconfig = {
        'KOTLIN_PROJECT_PATH' => ':shared',
        'PRODUCT_MODULE_NAME' => 'shared',
    }

    spec.script_phases = [
        {
            :name => 'Build shared KMP Framework',
            :execution_position => :before_compile,
            :shell_path => '/bin/sh',
            :script => <<-SCRIPT
                set -ev
                REPO_ROOT="$PODS_TARGET_SRCROOT"
                "$REPO_ROOT/../gradlew" -p "$REPO_ROOT" $KOTLIN_PROJECT_PATH:syncFramework \
                    -Pkotlin.native.cocoapods.platform=$PLATFORM_NAME \
                    -Pkotlin.native.cocoapods.archs="$ARCHS" \
                    -Pkotlin.native.cocoapods.configuration="$CONFIGURATION"
            SCRIPT
        }
    ]

    # Dependencies do shared module
    spec.dependency 'FirebaseAuth'
    spec.dependency 'FirebaseFirestore'
    spec.dependency 'FirebaseStorage'
end
