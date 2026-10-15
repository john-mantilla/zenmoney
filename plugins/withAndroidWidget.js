const {
  withProjectBuildGradle,
  withAppBuildGradle,
  withAndroidManifest,
  withStringsXml,
  withMainApplication,
  withDangerousMod,
  AndroidConfig,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo Config Plugin to inject Jetpack Glance Android Widget into ZenMoney native build.
 */
function withAndroidWidget(config) {
  // 1. Root build.gradle -> compose compiler gradle plugin
  config = withProjectBuildGradle(config, (modConfig) => {
    let contents = modConfig.modResults.contents;
    if (!contents.includes('compose-compiler-gradle-plugin')) {
      contents = contents.replace(
        /dependencies\s*\{/,
        "dependencies {\n    classpath('org.jetbrains.kotlin:compose-compiler-gradle-plugin:2.0.21')"
      );
      modConfig.modResults.contents = contents;
    }
    return modConfig;
  });

  // 2. app/build.gradle -> compose plugin, compose build feature, and glance dependencies
  config = withAppBuildGradle(config, (modConfig) => {
    let contents = modConfig.modResults.contents;

    // Apply compose plugin
    if (!contents.includes('org.jetbrains.kotlin.plugin.compose')) {
      contents = contents.replace(
        /apply plugin: "org\.jetbrains\.kotlin\.android"/,
        'apply plugin: "org.jetbrains.kotlin.android"\napply plugin: "org.jetbrains.kotlin.plugin.compose"'
      );
    }

    // Enable buildFeatures { compose true }
    if (!contents.includes('compose true')) {
      if (contents.includes('buildFeatures {')) {
        contents = contents.replace(
          'buildFeatures {',
          'buildFeatures {\n        compose true'
        );
      } else {
        contents = contents.replace(
          /android\s*\{/,
          'android {\n    buildFeatures {\n        compose true\n    }'
        );
      }
    }

    // Add Glance dependencies
    if (!contents.includes('glance-appwidget')) {
      contents = contents.replace(
        /dependencies\s*\{/,
        'dependencies {\n    // Jetpack Glance Widget\n    implementation("androidx.glance:glance-appwidget:1.1.1")\n    implementation("androidx.glance:glance-material3:1.1.1")'
      );
    }

    modConfig.modResults.contents = contents;
    return modConfig;
  });

  // 3. AndroidManifest.xml -> receiver for QuickAddWidgetReceiver
  config = withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults.manifest;
    const application = manifest.application?.[0];

    if (application) {
      application.receiver = application.receiver || [];
      const receiverExists = application.receiver.some(
        (r) =>
          r.$?.['android:name'] === '.widget.QuickAddWidgetReceiver' ||
          r.$?.['android:name'] === 'com.zenmoney.app.widget.QuickAddWidgetReceiver'
      );

      if (!receiverExists) {
        application.receiver.push({
          $: {
            'android:name': '.widget.QuickAddWidgetReceiver',
            'android:exported': 'true',
            'android:label': '@string/widget_quick_add_name',
          },
          'intent-filter': [
            {
              action: [
                {
                  $: {
                    'android:name': 'android.appwidget.action.APPWIDGET_UPDATE',
                  },
                },
              ],
            },
          ],
          'meta-data': [
            {
              $: {
                'android:name': 'android.appwidget.provider',
                'android:resource': '@xml/quick_add_widget_info',
              },
            },
          ],
        });
      }
    }

    return modConfig;
  });

  // 4. strings.xml -> widget strings
  config = withStringsXml(config, (modConfig) => {
    modConfig.modResults = AndroidConfig.Strings.setStringItem(
      [
        { _: 'ZenMoney - Registro Rápido', $: { name: 'widget_quick_add_name' } },
        { _: 'Acceso rápido a registrar gasto, cámara y presupuesto disponible.', $: { name: 'widget_quick_add_desc' } },
      ],
      modConfig.modResults
    );
    return modConfig;
  });

  // 5. MainApplication.kt -> register ZenMoneyWidgetPackage
  config = withMainApplication(config, (modConfig) => {
    let contents = modConfig.modResults.contents;
    if (!contents.includes('ZenMoneyWidgetPackage')) {
      contents = contents.replace(
        /package com\.zenmoney\.app/,
        'package com.zenmoney.app\nimport com.zenmoney.app.widget.ZenMoneyWidgetPackage'
      );

      if (contents.includes('PackageList(this).packages.apply {')) {
        contents = contents.replace(
          'PackageList(this).packages.apply {',
          'PackageList(this).packages.apply {\n          add(ZenMoneyWidgetPackage())'
        );
      } else if (contents.includes('PackageList(this).packages')) {
        contents = contents.replace(
          'PackageList(this).packages',
          'PackageList(this).packages.apply {\n          add(ZenMoneyWidgetPackage())\n        }'
        );
      }
      modConfig.modResults.contents = contents;
    }
    return modConfig;
  });

  // 6. DangerousMod -> copy native Kotlin and XML files into android source tree during prebuild
  config = withDangerousMod(config, [
    'android',
    async (modConfig) => {
      const projectRoot = modConfig.modRequest.projectRoot;
      const widgetFilesDir = path.join(projectRoot, 'plugins', 'widget-files');

      // Copy Kotlin widget files
      const targetJavaDir = path.join(
        projectRoot,
        'android',
        'app',
        'src',
        'main',
        'java',
        'com',
        'zenmoney',
        'app',
        'widget'
      );
      fs.mkdirSync(targetJavaDir, { recursive: true });
      const srcJavaDir = path.join(widgetFilesDir, 'java', 'com', 'zenmoney', 'app', 'widget');
      if (fs.existsSync(srcJavaDir)) {
        for (const file of fs.readdirSync(srcJavaDir)) {
          fs.copyFileSync(path.join(srcJavaDir, file), path.join(targetJavaDir, file));
        }
      }

      // Copy XML info file
      const targetXmlDir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res', 'xml');
      fs.mkdirSync(targetXmlDir, { recursive: true });
      const srcXmlDir = path.join(widgetFilesDir, 'res', 'xml');
      if (fs.existsSync(srcXmlDir)) {
        for (const file of fs.readdirSync(srcXmlDir)) {
          fs.copyFileSync(path.join(srcXmlDir, file), path.join(targetXmlDir, file));
        }
      }

      // Copy drawables
      const targetDrawableDir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res', 'drawable');
      fs.mkdirSync(targetDrawableDir, { recursive: true });
      const srcDrawableDir = path.join(widgetFilesDir, 'res', 'drawable');
      if (fs.existsSync(srcDrawableDir)) {
        for (const file of fs.readdirSync(srcDrawableDir)) {
          fs.copyFileSync(path.join(srcDrawableDir, file), path.join(targetDrawableDir, file));
        }
      }

      return modConfig;
    },
  ]);

  return config;
}

module.exports = withAndroidWidget;
