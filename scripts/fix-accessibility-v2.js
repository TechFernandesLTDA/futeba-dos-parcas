/**
 * Script v2 - Correção AGRESSIVA de acessibilidade
 * Lida com Icons em múltiplas linhas e casos edge
 */

const fs = require('fs');
const path = require('path');

const cdStrings = {
  'ArrowBack': 'cd_back', 'ArrowForward': 'cd_forward', 'Close': 'cd_close',
  'Menu': 'cd_menu', 'MoreVert': 'cd_more_options', 'MoreHoriz': 'cd_more_options',
  'Add': 'cd_add', 'Delete': 'cd_delete', 'Edit': 'cd_edit', 'Save': 'cd_save',
  'Share': 'cd_share', 'Search': 'cd_search', 'Filter': 'cd_filter',
  'Check': 'cd_check', 'CheckCircle': 'cd_check_circle', 'Cancel': 'cd_cancel',
  'Clear': 'cd_clear', 'Refresh': 'cd_refresh', 'Send': 'cd_send',
  'Star': 'cd_star', 'Favorite': 'cd_favorite', 'FavoriteBorder': 'cd_favorite_border',
  'Person': 'cd_person', 'Group': 'cd_group', 'Groups': 'cd_groups',
  'LocationOn': 'cd_location', 'Place': 'cd_place', 'Event': 'cd_event',
  'CalendarToday': 'cd_calendar', 'Schedule': 'cd_schedule',
  'SportsSoccer': 'cd_soccer', 'EmojiEvents': 'cd_trophy',
  'Info': 'cd_info', 'Help': 'cd_help', 'Warning': 'cd_warning', 'Error': 'cd_error',
  'Settings': 'cd_settings', 'Notifications': 'cd_notifications',
  'Visibility': 'cd_show', 'VisibilityOff': 'cd_hide',
  'KeyboardArrowDown': 'cd_expand', 'KeyboardArrowUp': 'cd_collapse',
  'ExpandMore': 'cd_expand', 'ExpandLess': 'cd_collapse',
  'Chat': 'cd_chat', 'ThumbUp': 'cd_like',
  'AttachMoney': 'cd_money', 'Payment': 'cd_payment',
  'QrCode': 'cd_qr_code', 'Download': 'cd_download',
  'AccountCircle': 'cd_account', 'ExitToApp': 'cd_logout',
  'Phone': 'cd_phone', 'Email': 'cd_email', 'Lock': 'cd_lock',
  'ContentCopy': 'cd_copy', 'Image': 'cd_image', 'Camera': 'cd_camera',
  'Celebration': 'cd_celebration', 'MilitaryTech': 'cd_badge',
  'Timer': 'cd_timer', 'AccessTime': 'cd_time', 'DateRange': 'cd_date_range',
  'ChevronRight': 'cd_chevron_right', 'ChevronLeft': 'cd_chevron_left',
  'Comment': 'cd_comment', 'ThumbDown': 'cd_dislike', 'Photo': 'cd_photo',
  'CameraAlt': 'cd_camera', 'RadioButtonUnchecked': 'cd_unchecked',
  'Circle': 'cd_indicator', 'AccountBalance': 'cd_balance',
  'QrCodeScanner': 'cd_qr_scanner', 'Upload': 'cd_upload', 'Link': 'cd_link',
  'ContentPaste': 'cd_paste', 'LockOpen': 'cd_unlock', 'VpnKey': 'cd_key',
  'Login': 'cd_login', 'Logout': 'cd_logout', 'Tune': 'cd_tune',
  'NotificationsNone': 'cd_notifications', 'KeyboardArrowRight': 'cd_next',
  'KeyboardArrowLeft': 'cd_previous', 'InfoOutlined': 'cd_info',
  'ErrorOutline': 'cd_error', 'WorkspacePremium': 'cd_premium',
  'ArrowDropDown': 'cd_expand', 'ArrowDropUp': 'cd_collapse',
  'Remove': 'cd_remove', 'PhotoCamera': 'cd_camera', 'Mic': 'cd_microphone',
  'Stop': 'cd_stop', 'PlayArrow': 'cd_play', 'Pause': 'cd_pause',
  'VolumeUp': 'cd_volume', 'Android': 'cd_android', 'Apple': 'cd_apple',
  'Language': 'cd_language', 'Translate': 'cd_translate', 'Public': 'cd_public',
  'Launch': 'cd_launch', 'OpenInNew': 'cd_open_new', 'Build': 'cd_build',
  'Code': 'cd_code', 'BugReport': 'cd_bug', 'RateReview': 'cd_review',
};

function getIconKey(iconName) {
  return cdStrings[iconName] || 'cd_icon';
}

function processKotlinFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;
    let modified = false;

    // Skip non-UI files
    if (filePath.includes('FcmService') ||
        filePath.includes('/model/') ||
        filePath.includes('/data/') ||
        filePath.includes('/domain/') ||
        filePath.includes('/util/')) {
      return false;
    }

    // Fix 1: Icon(\n    imageVector = Icons.xxx,\n    tint = ...\n) - SEM contentDescription
    const pattern1 = /Icon\s*\(\s*\n\s*imageVector\s*=\s*(Icons\.[A-Za-z.]+),\s*\n((?:(?!contentDescription)[^\)])*)\)/gs;
    content = content.replace(pattern1, (match, icon, rest) => {
      if (!match.includes('contentDescription')) {
        const iconName = icon.split('.').pop();
        const key = getIconKey(iconName);
        modified = true;
        return `Icon(\n    imageVector = ${icon},\n    contentDescription = stringResource(R.string.${key}),\n${rest})`;
      }
      return match;
    });

    // Fix 2: Icon(\n    Icons.xxx\n) - single line wrapped
    const pattern2 = /Icon\s*\(\s*\n\s*(Icons\.[A-Za-z.]+)\s*\n\s*\)/gs;
    content = content.replace(pattern2, (match, icon) => {
      const iconName = icon.split('.').pop();
      const key = getIconKey(iconName);
      modified = true;
      return `Icon(\n    ${icon},\n    contentDescription = stringResource(R.string.${key})\n)`;
    });

    // Fix 3: Icon(Icons.xxx, tint = ...) - inline sem contentDescription
    const pattern3 = /Icon\s*\(\s*(Icons\.[A-Za-z.]+)\s*,\s*tint\s*=/g;
    content = content.replace(pattern3, (match, icon) => {
      // Check if contentDescription is already in the Icon call
      const startIdx = content.indexOf(match);
      const nextClosingParen = content.indexOf(')', startIdx);
      const iconCallSubstr = content.substring(startIdx, nextClosingParen);

      if (!iconCallSubstr.includes('contentDescription')) {
        const iconName = icon.split('.').pop();
        const key = getIconKey(iconName);
        modified = true;
        return `Icon(${icon}, contentDescription = stringResource(R.string.${key}), tint =`;
      }
      return match;
    });

    // Fix 4: Icon(Icons.xxx, modifier = ...) - inline sem contentDescription
    const pattern4 = /Icon\s*\(\s*(Icons\.[A-Za-z.]+)\s*,\s*modifier\s*=/g;
    content = content.replace(pattern4, (match, icon) => {
      const startIdx = content.indexOf(match);
      const nextClosingParen = content.indexOf(')', startIdx);
      const iconCallSubstr = content.substring(startIdx, nextClosingParen);

      if (!iconCallSubstr.includes('contentDescription')) {
        const iconName = icon.split('.').pop();
        const key = getIconKey(iconName);
        modified = true;
        return `Icon(${icon}, contentDescription = stringResource(R.string.${key}), modifier =`;
      }
      return match;
    });

    // Fix 5: Icon(Icons.xxx) alone
    const pattern5 = /Icon\s*\(\s*(Icons\.[A-Za-z.]+)\s*\)/g;
    content = content.replace(pattern5, (match, icon) => {
      const iconName = icon.split('.').pop();
      const key = getIconKey(iconName);
      modified = true;
      return `Icon(${icon}, contentDescription = stringResource(R.string.${key}))`;
    });

    // Fix 6: AsyncImage sem contentDescription (multiline)
    const pattern6 = /AsyncImage\s*\(\s*\n\s*model\s*=\s*([^,]+),\s*\n((?:(?!contentDescription)[^\)])*)\)/gs;
    content = content.replace(pattern6, (match, model, rest) => {
      if (!match.includes('contentDescription')) {
        modified = true;
        return `AsyncImage(\n    model = ${model},\n    contentDescription = stringResource(R.string.cd_profile_photo),\n${rest})`;
      }
      return match;
    });

    // Fix 7: Image(painter = ...) sem contentDescription
    const pattern7 = /Image\s*\(\s*\n\s*painter\s*=\s*([^,]+),\s*\n((?:(?!contentDescription)[^\)])*)\)/gs;
    content = content.replace(pattern7, (match, painter, rest) => {
      if (!match.includes('contentDescription')) {
        modified = true;
        return `Image(\n    painter = ${painter},\n    contentDescription = stringResource(R.string.cd_image),\n${rest})`;
      }
      return match;
    });

    // Fix 8: .clickable { sem onClickLabel
    const pattern8 = /\.clickable\s*\{\s*\n/g;
    content = content.replace(pattern8, (match) => {
      // Check context before for existing onClickLabel
      const idx = content.indexOf(match);
      const contextBefore = content.substring(Math.max(0, idx - 100), idx);
      if (!contextBefore.includes('onClickLabel')) {
        modified = true;
        return '.clickable(\n        onClickLabel = stringResource(R.string.action_click)\n    ) {\n';
      }
      return match;
    });

    // Adiciona import se modificado
    if (modified && !content.includes('import androidx.compose.ui.res.stringResource')) {
      const importMatch = content.match(/(import androidx\.compose[^\n]*\n)/);
      if (importMatch) {
        content = content.replace(
          importMatch[0],
          importMatch[0] + 'import androidx.compose.ui.res.stringResource\n'
        );
      } else {
        // Add after package declaration
        const packageMatch = content.match(/(package [^\n]+\n\n)/);
        if (packageMatch) {
          content = content.replace(
            packageMatch[0],
            packageMatch[0] + 'import androidx.compose.ui.res.stringResource\n\n'
          );
        }
      }
    }

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      return true;
    }

    return false;
  } catch (err) {
    console.error(`Error in ${filePath}:`, err.message);
    return false;
  }
}

function getAllKotlinFiles(dir) {
  let files = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files = files.concat(getAllKotlinFiles(fullPath));
      } else if (entry.name.endsWith('.kt')) {
        files.push(fullPath);
      }
    }
  } catch (err) {
    console.error(`Error reading ${dir}:`, err.message);
  }
  return files;
}

console.log('🚀 Accessibility Fix v2 - AGGRESSIVE MODE\n');

const appDir = path.join(__dirname, '..', 'app', 'src', 'main', 'java');
const files = getAllKotlinFiles(appDir);

let modified = 0;
let processed = 0;

for (const file of files) {
  processed++;
  if (processKotlinFile(file)) {
    modified++;
    const relPath = path.relative(appDir, file);
    console.log(`✓ ${relPath}`);
  }

  if (processed % 100 === 0) {
    console.log(`Progress: ${processed}/${files.length}...`);
  }
}

console.log(`\n✅ Modified ${modified}/${files.length} files`);
console.log(`\nRun: ./gradlew compileDebugKotlin to verify`);
