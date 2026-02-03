#!/usr/bin/env python3
"""
Script para corrigir TODOS os accessibility issues automaticamente.
Foca em adicionar contentDescription em Icons, Images e onClickLabel em Clickables.
"""

import os
import re
import sys

# Mapeamento de ícones para content descriptions
ICON_MAP = {
    'ArrowBack': 'cd_back',
    'ArrowForward': 'cd_forward',
    'Close': 'cd_close',
    'Menu': 'cd_menu',
    'MoreVert': 'cd_more_options',
    'MoreHoriz': 'cd_more_options',
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
    'SportsSoccer': 'cd_soccer',
    'EmojiEvents': 'cd_trophy',
    'Info': 'cd_info',
    'Help': 'cd_help',
    'Warning': 'cd_warning',
    'Error': 'cd_error',
    'Settings': 'cd_settings',
    'Notifications': 'cd_notifications',
    'Visibility': 'cd_show',
    'VisibilityOff': 'cd_hide',
    'KeyboardArrowDown': 'cd_expand',
    'KeyboardArrowUp': 'cd_collapse',
    'ExpandMore': 'cd_expand',
    'ExpandLess': 'cd_collapse',
    'ChevronRight': 'cd_chevron_right',
    'ChevronLeft': 'cd_chevron_left',
    'AccountCircle': 'cd_account',
    'ExitToApp': 'cd_logout',
    'AttachMoney': 'cd_money',
    'QrCode': 'cd_qr_code',
    'Camera': 'cd_camera',
    'Image': 'cd_image',
    'Phone': 'cd_phone',
    'Email': 'cd_email',
}


def get_icon_cd_key(icon_name):
    """Get contentDescription key for an icon."""
    return ICON_MAP.get(icon_name, 'cd_icon')


def fix_icon_calls(content):
    """Fix Icon() calls that are missing contentDescription."""
    modified = False

    # Pattern 1: Icon(Icons.xxx) - simple case
    def replace_simple_icon(match):
        nonlocal modified
        icon_full = match.group(1)
        icon_name = icon_full.split('.')[-1]
        cd_key = get_icon_cd_key(icon_name)
        modified = True
        return f'Icon({icon_full}, contentDescription = stringResource(R.string.{cd_key}))'

    content = re.sub(
        r'Icon\s*\(\s*(Icons\.[A-Za-z.]+)\s*\)',
        replace_simple_icon,
        content
    )

    # Pattern 2: Icon(imageVector = Icons.xxx, ...) without contentDescription
    lines = content.split('\n')
    new_lines = []
    i = 0
    while i < len(lines):
        line = lines[i]

        # Check if this line starts an Icon call
        if re.match(r'\s*Icon\s*\(', line):
            # Collect the full Icon call
            icon_call_lines = [line]
            paren_count = line.count('(') - line.count(')')
            j = i + 1

            while paren_count > 0 and j < len(lines):
                icon_call_lines.append(lines[j])
                paren_count += lines[j].count('(') - lines[j].count(')')
                j += 1

            # Check if contentDescription is already present
            icon_call_text = '\n'.join(icon_call_lines)

            if 'contentDescription' not in icon_call_text:
                # Extract icon name if present
                icon_match = re.search(r'Icons\.[A-Za-z.]+\.(\w+)', icon_call_text)
                if icon_match:
                    icon_name = icon_match.group(1)
                    cd_key = get_icon_cd_key(icon_name)

                    # Find where to insert contentDescription
                    # Insert after imageVector line if present
                    for k, call_line in enumerate(icon_call_lines):
                        if 'imageVector' in call_line and k + 1 < len(icon_call_lines):
                            indent = len(call_line) - len(call_line.lstrip())
                            cd_line = ' ' * indent + f'contentDescription = stringResource(R.string.{cd_key}),'
                            icon_call_lines.insert(k + 1, cd_line)
                            modified = True
                            break

                    new_lines.extend(icon_call_lines)
                    i = j
                    continue

            new_lines.extend(icon_call_lines)
            i = j
        else:
            new_lines.append(line)
            i += 1

    if modified:
        content = '\n'.join(new_lines)

    return content, modified


def fix_async_images(content):
    """Fix AsyncImage calls that are missing contentDescription."""
    modified = False

    def replace_async_image(match):
        nonlocal modified
        full_match = match.group(0)
        if 'contentDescription' not in full_match:
            modified = True
            # Insert contentDescription after model parameter
            return re.sub(
                r'(model\s*=\s*[^,]+,)',
                r'\1\n    contentDescription = stringResource(R.string.cd_profile_photo),',
                full_match
            )
        return full_match

    content = re.sub(
        r'AsyncImage\s*\([^)]+\)',
        replace_async_image,
        content,
        flags=re.DOTALL
    )

    return content, modified


def fix_clickables(content):
    """Fix .clickable calls that are missing onClickLabel."""
    modified = False

    def replace_clickable(match):
        nonlocal modified
        full_match = match.group(0)
        if 'onClickLabel' not in full_match:
            modified = True
            return '.clickable(\n        onClickLabel = stringResource(R.string.action_click)\n    ) {'
        return full_match

    content = re.sub(
        r'\.clickable\s*\{',
        replace_clickable,
        content
    )

    return content, modified


def add_import_if_needed(content, modified):
    """Add stringResource import if not present and modifications were made."""
    if modified and 'import androidx.compose.ui.res.stringResource' not in content:
        # Find the imports section and add
        import_match = re.search(r'(import androidx\.compose[^\n]*\n)', content)
        if import_match:
            content = content.replace(
                import_match.group(0),
                import_match.group(0) + 'import androidx.compose.ui.res.stringResource\n'
            )
        else:
            # Add after package declaration
            package_match = re.search(r'(package [^\n]+\n\n)', content)
            if package_match:
                content = content.replace(
                    package_match.group(0),
                    package_match.group(0) + 'import androidx.compose.ui.res.stringResource\n\n'
                )

    return content


def process_file(file_path):
    """Process a single Kotlin file."""
    # Skip non-UI files
    if any(x in file_path for x in ['/model/', '/data/', '/domain/', '/util/', 'FcmService']):
        return False

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        original = content
        overall_modified = False

        # Fix Icons
        content, mod1 = fix_icon_calls(content)
        overall_modified = overall_modified or mod1

        # Fix AsyncImages
        content, mod2 = fix_async_images(content)
        overall_modified = overall_modified or mod2

        # Fix Clickables
        content, mod3 = fix_clickables(content)
        overall_modified = overall_modified or mod3

        # Add import if needed
        if overall_modified:
            content = add_import_if_needed(content, overall_modified)

        if overall_modified:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            return True

        return False

    except Exception as e:
        print(f'Error processing {file_path}: {e}', file=sys.stderr)
        return False


def get_all_kotlin_files(directory):
    """Recursively get all Kotlin files in directory."""
    kotlin_files = []
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith('.kt'):
                kotlin_files.append(os.path.join(root, file))
    return kotlin_files


def main():
    print('>>> Accessibility Fix - Python Edition\n')

    # Get project root
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    app_dir = os.path.join(project_root, 'app', 'src', 'main', 'java')

    # Get all Kotlin files
    kotlin_files = get_all_kotlin_files(app_dir)
    print(f'Found {len(kotlin_files)} Kotlin files\n')

    # Process files
    modified_count = 0
    for i, file_path in enumerate(kotlin_files):
        if process_file(file_path):
            modified_count += 1
            rel_path = os.path.relpath(file_path, app_dir)
            print(f'[OK] {rel_path}')

        if (i + 1) % 100 == 0:
            print(f'Progress: {i + 1}/{len(kotlin_files)}...')

    print(f'\n>>> Modified {modified_count}/{len(kotlin_files)} files')
    print('\nRun: ./gradlew compileDebugKotlin to verify')


if __name__ == '__main__':
    main()
