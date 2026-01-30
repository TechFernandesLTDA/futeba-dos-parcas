# Fastlane Setup Guide

## Prerequisites

1. **Install Fastlane**:
   ```bash
   # macOS
   brew install fastlane

   # Windows (via Ruby)
   gem install fastlane
   ```

2. **Install Fastlane plugins**:
   ```bash
   fastlane add_plugin firebase_app_distribution
   ```

## Configuration

### Google Play Store Setup

1. Create a service account in Google Cloud Console
2. Download the JSON key file
3. Store it as `fastlane/play-store-key.json` (gitignored)
4. Or set environment variable: `PLAY_STORE_JSON_KEY_PATH=/path/to/key.json`

### Firebase App Distribution Setup

1. Get your Firebase App ID from Firebase Console
2. Set environment variable: `FIREBASE_APP_ID=1:123456789:android:abcdef`
3. Authenticate Firebase CLI: `firebase login:ci`

## Available Lanes

### Build Lanes

```bash
# Build debug APK
fastlane build_debug

# Build release APK
fastlane build_release

# Build release AAB (for Play Store)
fastlane build_aab
```

### Testing Lanes

```bash
# Run all tests
fastlane test

# Run static analysis (Detekt + Lint)
fastlane static_analysis

# Run all quality checks
fastlane quality
```

### Deployment Lanes

```bash
# Deploy to Firebase App Distribution (beta testers)
fastlane beta

# Deploy to Play Store Internal Testing
fastlane internal

# Promote to Production (10% rollout)
fastlane production
```

### Utility Lanes

```bash
# Increment version code/name
fastlane bump_version

# Generate Play Store screenshots
fastlane screenshots
```

## Environment Variables

Create a `.env` file (gitignored) with:

```bash
# Play Store
PLAY_STORE_JSON_KEY_PATH=/path/to/play-store-key.json

# Firebase
FIREBASE_APP_ID=1:123456789:android:abcdef

# Slack notifications (optional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

## CI/CD Integration

### GitHub Actions

```yaml
- name: Deploy to Firebase App Distribution
  env:
    FIREBASE_APP_ID: ${{ secrets.FIREBASE_APP_ID }}
  run: fastlane beta
```

See `.github/workflows/deploy.yml` for complete example.

## Troubleshooting

### "Gradle task failed"
- Ensure `local.properties` exists with signing config
- Check that `STORE_FILE`, `STORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD` are set

### "Firebase authentication failed"
- Run `firebase login:ci` to generate a new token
- Set `FIREBASE_TOKEN` environment variable

### "Play Store upload failed"
- Verify service account has "Release Manager" role
- Check that version code is higher than current production version
