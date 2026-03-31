/**
 * Script para corrigir automaticamente todos os issues de acessibilidade
 * Adiciona contentDescription em Icons, Images e onClickLabel em Clickables
 */

const fs = require('fs');
const path = require('path');

// Mapeamento de ícones para contentDescription
const iconDescriptions = {
  // Navigation
  'ArrowBack': 'cd_back',
  'ArrowForward': 'cd_forward',
  'Close': 'cd_close',
  'Menu': 'cd_menu',
  'MoreVert': 'cd_more_options',
  'MoreHoriz': 'cd_more_options',

  // Actions
  'Add': 'cd_add',
  'Delete': 'cd_delete',
  'Edit': 'cd_edit',
  'Save': 'cd_save',
  'Share': 'cd_share',
  'Search': 'cd_search',
  'Filter': 'cd_filter',
  'Check': 'cd_check',
  'CheckCircle': 'cd_check_circle',
  'Cancel': 'cd_cancel',
  'Clear': 'cd_clear',
  'Refresh': 'cd_refresh',
  'Send': 'cd_send',

  // Content
  'Star': 'cd_star',
  'Favorite': 'cd_favorite',
  'FavoriteBorder': 'cd_favorite_border',
  'Person': 'cd_person',
  'Group': 'cd_group',
  'Groups': 'cd_groups',
  'LocationOn': 'cd_location',
  'Place': 'cd_place',
  'Event': 'cd_event',
  'CalendarToday': 'cd_calendar',
  'Schedule': 'cd_schedule',
  'Timer': 'cd_timer',
  'AccessTime': 'cd_time',
  'DateRange': 'cd_date_range',

  // Sports
  'SportsSoccer': 'cd_soccer',
  'EmojiEvents': 'cd_trophy',
  'Celebration': 'cd_celebration',
  'MilitaryTech': 'cd_badge',
  'Star': 'cd_star',
  'WorkspacePremium': 'cd_premium',

  // Info
  'Info': 'cd_info',
  'InfoOutlined': 'cd_info',
  'Help': 'cd_help',
  'Warning': 'cd_warning',
  'Error': 'cd_error',
  'ErrorOutline': 'cd_error',

  // Settings
  'Settings': 'cd_settings',
  'Tune': 'cd_tune',
  'Notifications': 'cd_notifications',
  'NotificationsNone': 'cd_notifications',

  // Visibility
  'Visibility': 'cd_show',
  'VisibilityOff': 'cd_hide',

  // Navigation arrows
  'KeyboardArrowDown': 'cd_expand',
  'KeyboardArrowUp': 'cd_collapse',
  'KeyboardArrowRight': 'cd_next',
  'KeyboardArrowLeft': 'cd_previous',
  'ExpandMore': 'cd_expand',
  'ExpandLess': 'cd_collapse',
  'ChevronRight': 'cd_chevron_right',
  'ChevronLeft': 'cd_chevron_left',

  // Social
  'Chat': 'cd_chat',
  'Comment': 'cd_comment',
  'ThumbUp': 'cd_like',
  'ThumbDown': 'cd_dislike',

  // Media
  'Image': 'cd_image',
  'Photo': 'cd_photo',
  'Camera': 'cd_camera',
  'CameraAlt': 'cd_camera',

  // Status
  'CheckCircle': 'cd_completed',
  'RadioButtonUnchecked': 'cd_unchecked',
  'Circle': 'cd_indicator',

  // Money
  'AttachMoney': 'cd_money',
  'Payment': 'cd_payment',
  'AccountBalance': 'cd_balance',

  // Misc
  'QrCode': 'cd_qr_code',
  'QrCodeScanner': 'cd_qr_scanner',
  'Download': 'cd_download',
  'Upload': 'cd_upload',
  'Link': 'cd_link',
  'ContentCopy': 'cd_copy',
  'ContentPaste': 'cd_paste',
  'Phone': 'cd_phone',
  'Email': 'cd_email',
  'Lock': 'cd_lock',
  'LockOpen': 'cd_unlock',
  'VpnKey': 'cd_key',
  'AccountCircle': 'cd_account',
  'ExitToApp': 'cd_logout',
  'Login': 'cd_login',
  'Logout': 'cd_logout',
};

// Strings para adicionar ao strings.xml
const contentDescriptionStrings = {
  // Navigation
  'cd_back': 'Back',
  'cd_forward': 'Forward',
  'cd_close': 'Close',
  'cd_menu': 'Menu',
  'cd_more_options': 'More options',

  // Actions
  'cd_add': 'Add',
  'cd_delete': 'Delete',
  'cd_edit': 'Edit',
  'cd_save': 'Save',
  'cd_share': 'Share',
  'cd_search': 'Search',
  'cd_filter': 'Filter',
  'cd_check': 'Check',
  'cd_check_circle': 'Checked',
  'cd_cancel': 'Cancel',
  'cd_clear': 'Clear',
  'cd_refresh': 'Refresh',
  'cd_send': 'Send',

  // Content
  'cd_star': 'Star',
  'cd_favorite': 'Favorite',
  'cd_favorite_border': 'Add to favorites',
  'cd_person': 'Person',
  'cd_group': 'Group',
  'cd_groups': 'Groups',
  'cd_location': 'Location',
  'cd_place': 'Place',
  'cd_event': 'Event',
  'cd_calendar': 'Calendar',
  'cd_schedule': 'Schedule',
  'cd_timer': 'Timer',
  'cd_time': 'Time',
  'cd_date_range': 'Date range',

  // Sports
  'cd_soccer': 'Soccer',
  'cd_trophy': 'Trophy',
  'cd_celebration': 'Celebration',
  'cd_badge': 'Badge',
  'cd_premium': 'Premium',

  // Info
  'cd_info': 'Information',
  'cd_help': 'Help',
  'cd_warning': 'Warning',
  'cd_error': 'Error',

  // Settings
  'cd_settings': 'Settings',
  'cd_tune': 'Tune',
  'cd_notifications': 'Notifications',

  // Visibility
  'cd_show': 'Show',
  'cd_hide': 'Hide',

  // Navigation arrows
  'cd_expand': 'Expand',
  'cd_collapse': 'Collapse',
  'cd_next': 'Next',
  'cd_previous': 'Previous',
  'cd_chevron_right': 'Navigate forward',
  'cd_chevron_left': 'Navigate back',

  // Social
  'cd_chat': 'Chat',
  'cd_comment': 'Comment',
  'cd_like': 'Like',
  'cd_dislike': 'Dislike',

  // Media
  'cd_image': 'Image',
  'cd_photo': 'Photo',
  'cd_camera': 'Camera',

  // Status
  'cd_completed': 'Completed',
  'cd_unchecked': 'Unchecked',
  'cd_indicator': 'Indicator',

  // Money
  'cd_money': 'Money',
  'cd_payment': 'Payment',
  'cd_balance': 'Balance',

  // Misc
  'cd_qr_code': 'QR Code',
  'cd_qr_scanner': 'QR Scanner',
  'cd_download': 'Download',
  'cd_upload': 'Upload',
  'cd_link': 'Link',
  'cd_copy': 'Copy',
  'cd_paste': 'Paste',
  'cd_phone': 'Phone',
  'cd_email': 'Email',
  'cd_lock': 'Lock',
  'cd_unlock': 'Unlock',
  'cd_key': 'Key',
  'cd_account': 'Account',
  'cd_logout': 'Log out',
  'cd_login': 'Log in',

  // Generic
  'cd_profile_photo': 'Profile photo',
  'cd_group_photo': 'Group photo',
  'cd_game_photo': 'Game photo',
  'cd_location_photo': 'Location photo',
  'cd_decorative': 'Decorative image',
  'cd_icon': 'Icon',
  'action_click': 'Click',
  'action_tap': 'Tap',
};

function getIconName(iconCode) {
  // Extrai o nome do ícone de padrões como:
  // Icons.Default.Add
  // Icons.Filled.Star
  // Icons.Outlined.Person
  const match = iconCode.match(/Icons\.(Default|Filled|Outlined|Rounded|Sharp|TwoTone|AutoMirrored\.Filled)\.(\w+)/);
  if (match) {
    return match[2];
  }
  return null;
}

function getContentDescriptionKey(iconCode) {
  const iconName = getIconName(iconCode);
  if (iconName && iconDescriptions[iconName]) {
    return iconDescriptions[iconName];
  }
  return 'cd_icon'; // fallback genérico
}

function fixIconsInFile(filePath, content) {
  let modified = content;
  let hasChanges = false;
  let needsStringResourceImport = false;

  // Pattern 1: Icon(Icons.xxx) sem contentDescription
  const iconPattern1 = /Icon\(\s*(Icons\.[^\)]+)\s*\)/g;
  modified = modified.replace(iconPattern1, (match, iconCode) => {
    if (!match.includes('contentDescription')) {
      hasChanges = true;
      needsStringResourceImport = true;
      const cdKey = getContentDescriptionKey(iconCode);
      return `Icon(${iconCode}, contentDescription = stringResource(R.string.${cdKey}))`;
    }
    return match;
  });

  // Pattern 2: Icon(\n    imageVector = Icons.xxx\n) sem contentDescription
  const iconPattern2 = /Icon\(\s*imageVector\s*=\s*(Icons\.[^,\)]+)([^)]*)\)/gs;
  modified = modified.replace(iconPattern2, (match, iconCode, rest) => {
    if (!match.includes('contentDescription')) {
      hasChanges = true;
      needsStringResourceImport = true;
      const cdKey = getContentDescriptionKey(iconCode);
      // Adiciona contentDescription após imageVector
      return `Icon(imageVector = ${iconCode}, contentDescription = stringResource(R.string.${cdKey})${rest})`;
    }
    return match;
  });

  // Pattern 3: Icon { Icon(xxx) } - IconButton com Icon dentro
  const iconButtonPattern = /IconButton[^{]*\{[^}]*Icon\(\s*(Icons\.[^\)]+)\s*\)[^}]*\}/gs;
  modified = modified.replace(iconButtonPattern, (match) => {
    if (!match.includes('contentDescription')) {
      const iconMatch = match.match(/Icon\(\s*(Icons\.[^\)]+)\s*\)/);
      if (iconMatch) {
        hasChanges = true;
        needsStringResourceImport = true;
        const cdKey = getContentDescriptionKey(iconMatch[1]);
        return match.replace(
          iconMatch[0],
          `Icon(${iconMatch[1]}, contentDescription = stringResource(R.string.${cdKey}))`
        );
      }
    }
    return match;
  });

  // Adiciona import se necessário
  if (needsStringResourceImport && !modified.includes('import androidx.compose.ui.res.stringResource')) {
    // Encontra a seção de imports e adiciona
    const importPattern = /(import androidx\.compose[^\n]*\n)/;
    if (importPattern.test(modified)) {
      modified = modified.replace(
        importPattern,
        '$1import androidx.compose.ui.res.stringResource\n'
      );
    } else {
      // Se não há imports do Compose, adiciona no início dos imports
      const packagePattern = /(package [^\n]+\n\n)/;
      if (packagePattern.test(modified)) {
        modified = modified.replace(
          packagePattern,
          '$1import androidx.compose.ui.res.stringResource\n\n'
        );
      }
    }
  }

  return { modified, hasChanges };
}

function fixImagesInFile(filePath, content) {
  let modified = content;
  let hasChanges = false;
  let needsStringResourceImport = false;

  // Pattern: AsyncImage sem contentDescription
  const asyncImagePattern = /AsyncImage\s*\(\s*model\s*=\s*([^,\)]+)([^)]*)\)/gs;
  modified = modified.replace(asyncImagePattern, (match, model, rest) => {
    if (!match.includes('contentDescription')) {
      hasChanges = true;
      needsStringResourceImport = true;
      // Determina o tipo de imagem baseado no contexto
      let cdKey = 'cd_image';
      if (filePath.includes('Profile') || model.includes('photoUrl') || model.includes('profilePicture')) {
        cdKey = 'cd_profile_photo';
      } else if (filePath.includes('Group') || model.includes('groupPhoto')) {
        cdKey = 'cd_group_photo';
      } else if (filePath.includes('Game') || model.includes('gamePhoto')) {
        cdKey = 'cd_game_photo';
      } else if (filePath.includes('Location') || model.includes('locationPhoto')) {
        cdKey = 'cd_location_photo';
      }

      return `AsyncImage(model = ${model}, contentDescription = stringResource(R.string.${cdKey})${rest})`;
    }
    return match;
  });

  // Pattern: Image(painter = ...) sem contentDescription
  const imagePattern = /Image\s*\(\s*painter\s*=\s*([^,\)]+)([^)]*)\)/gs;
  modified = modified.replace(imagePattern, (match, painter, rest) => {
    if (!match.includes('contentDescription')) {
      hasChanges = true;
      needsStringResourceImport = true;
      return `Image(painter = ${painter}, contentDescription = stringResource(R.string.cd_image)${rest})`;
    }
    return match;
  });

  // Adiciona import se necessário
  if (needsStringResourceImport && !modified.includes('import androidx.compose.ui.res.stringResource')) {
    const importPattern = /(import androidx\.compose[^\n]*\n)/;
    if (importPattern.test(modified)) {
      modified = modified.replace(
        importPattern,
        '$1import androidx.compose.ui.res.stringResource\n'
      );
    }
  }

  return { modified, hasChanges };
}

function fixClickablesInFile(filePath, content) {
  let modified = content;
  let hasChanges = false;
  let needsStringResourceImport = false;

  // Pattern: .clickable { ... } sem onClickLabel
  const clickablePattern = /\.clickable\s*\{/g;
  modified = modified.replace(clickablePattern, (match) => {
    // Verifica se já tem onClickLabel no contexto próximo
    const contextBefore = modified.substring(Math.max(0, modified.indexOf(match) - 200), modified.indexOf(match));
    if (!contextBefore.includes('onClickLabel')) {
      hasChanges = true;
      needsStringResourceImport = true;
      return '.clickable(onClickLabel = stringResource(R.string.action_click)) {';
    }
    return match;
  });

  // Pattern: .combinedClickable { ... } sem onClickLabel
  const combinedClickablePattern = /\.combinedClickable\s*\{/g;
  modified = modified.replace(combinedClickablePattern, (match) => {
    const contextBefore = modified.substring(Math.max(0, modified.indexOf(match) - 200), modified.indexOf(match));
    if (!contextBefore.includes('onClickLabel')) {
      hasChanges = true;
      needsStringResourceImport = true;
      return '.combinedClickable(onClickLabel = stringResource(R.string.action_click)) {';
    }
    return match;
  });

  // Adiciona import se necessário
  if (needsStringResourceImport && !modified.includes('import androidx.compose.ui.res.stringResource')) {
    const importPattern = /(import androidx\.compose[^\n]*\n)/;
    if (importPattern.test(modified)) {
      modified = modified.replace(
        importPattern,
        '$1import androidx.compose.ui.res.stringResource\n'
      );
    }
  }

  return { modified, hasChanges };
}

function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let totalChanges = false;

    // Fix Icons
    let result = fixIconsInFile(filePath, content);
    if (result.hasChanges) {
      content = result.modified;
      totalChanges = true;
    }

    // Fix Images
    result = fixImagesInFile(filePath, content);
    if (result.hasChanges) {
      content = result.modified;
      totalChanges = true;
    }

    // Fix Clickables
    result = fixClickablesInFile(filePath, content);
    if (result.hasChanges) {
      content = result.modified;
      totalChanges = true;
    }

    if (totalChanges) {
      fs.writeFileSync(filePath, content, 'utf8');
      return true;
    }

    return false;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return false;
  }
}

function getAllKotlinFiles(dir) {
  let files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(getAllKotlinFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.kt')) {
      files.push(fullPath);
    }
  }

  return files;
}

function generateStringsXml() {
  let xml = '\n    <!-- Content Descriptions for Accessibility -->\n';

  for (const [key, value] of Object.entries(contentDescriptionStrings)) {
    xml += `    <string name="${key}">${value}</string>\n`;
  }

  return xml;
}

function updateStringsXml(stringsPath) {
  try {
    let content = fs.readFileSync(stringsPath, 'utf8');

    // Verifica se já tem as strings
    if (content.includes('<!-- Content Descriptions for Accessibility -->')) {
      console.log('strings.xml já contém as content descriptions');
      return;
    }

    // Adiciona antes da tag </resources>
    const newStrings = generateStringsXml();
    content = content.replace('</resources>', `${newStrings}</resources>`);

    fs.writeFileSync(stringsPath, content, 'utf8');
    console.log('✅ strings.xml atualizado com content descriptions');
  } catch (error) {
    console.error('Erro ao atualizar strings.xml:', error.message);
  }
}

// Main execution
console.log('🚀 Iniciando correção automática de acessibilidade...\n');

const appDir = path.join(__dirname, '..', 'app', 'src', 'main', 'java');
const stringsPath = path.join(__dirname, '..', 'app', 'src', 'main', 'res', 'values', 'strings.xml');

// Step 1: Update strings.xml
console.log('Step 1: Atualizando strings.xml...');
updateStringsXml(stringsPath);

// Step 2: Process all Kotlin files
console.log('\nStep 2: Processando arquivos Kotlin...');
const kotlinFiles = getAllKotlinFiles(appDir);
let processedCount = 0;
let modifiedCount = 0;

for (const file of kotlinFiles) {
  processedCount++;
  if (processFile(file)) {
    modifiedCount++;
    console.log(`✓ ${path.relative(appDir, file)}`);
  }

  // Progress indicator
  if (processedCount % 50 === 0) {
    console.log(`Progresso: ${processedCount}/${kotlinFiles.length} arquivos processados...`);
  }
}

console.log(`\n✅ Concluído!`);
console.log(`📊 Estatísticas:`);
console.log(`   - Total de arquivos: ${kotlinFiles.length}`);
console.log(`   - Arquivos modificados: ${modifiedCount}`);
console.log(`   - Arquivos sem alterações: ${kotlinFiles.length - modifiedCount}`);
console.log(`\n🔍 Execute './gradlew compileDebugKotlin' para validar as mudanças`);
