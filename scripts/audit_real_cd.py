#!/usr/bin/env python3
"""
Real accessibility audit - checks multi-line context for contentDescription.
Unlike the bash script, this properly handles multi-line Icon/Image calls.
Usage: python3 scripts/audit_real_cd.py
"""
import re
import os
import glob

UI_DIR = 'app/src/main/java/com/futebadosparcas/ui'
kt_files = glob.glob(os.path.join(UI_DIR, '**', '*.kt'), recursive=True)

missing_cd = []
positional_cd = []
hardcoded_cd = []

SKIP_LINE_PATTERNS = [
    'IconButton', 'AsyncImage', 'CachedProfileImage', 'CachedAsyncImage',
    'ProgressiveImage', 'LocationImage', 'FieldImage', 'processImage',
    'compressImage', 'setSmallIcon', 'setLargeIcon', 'BadgedIcon',
    'LeadingIcon', 'TrailingIcon', 'NavigationIcon', 'leadingIcon',
    'trailingIcon', 'GroupImage', 'ProfileImage', 'rememberAsyncImagePainter',
    'shareAsImage', 'NotificationIcon', 'FieldTypeIcon', 'PlayerCardShareHelper',
    'getActivityIcon', 'getEventIcon', 'getConnectionIcon', 'getErrorIcon',
    'getAmenityIcon', 'getMilestoneIcon', 'getDivisionIcon', 'ZoomableImage',
    'navigationIcon', 'fun ', 'import ', 'val icon', 'val ', '* ', 'painter =',
    'imageVector =',
]

def extract_full_call(lines, start_idx):
    paren_count = 0
    call_lines = []
    started = False
    for j in range(start_idx, min(start_idx + 30, len(lines))):
        for ch in lines[j]:
            if ch == '(':
                paren_count += 1
                started = True
            elif ch == ')':
                paren_count -= 1
        call_lines.append(lines[j])
        if started and paren_count <= 0:
            break
    return ''.join(call_lines)

def parse_positional_params(inner_text):
    parts = []
    depth = 0
    current = ''
    for ch in inner_text:
        if ch in '([':
            depth += 1
            current += ch
        elif ch in ')]':
            if depth == 0:
                parts.append(current.strip())
                break
            depth -= 1
            current += ch
        elif ch == ',' and depth == 0:
            parts.append(current.strip())
            current = ''
        else:
            current += ch
    return parts

for filepath in sorted(kt_files):
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        if stripped.startswith('//') or stripped.startswith('*') or stripped.startswith('/*'):
            i += 1
            continue

        for comp in ['Icon(', 'Image(']:
            if comp not in stripped:
                continue

            skip = any(pat in stripped for pat in SKIP_LINE_PATTERNS)
            if skip:
                continue

            call_text = extract_full_call(lines, i)

            if 'contentDescription' not in call_text:
                is_single = stripped.count('(') > 0 and (stripped.rstrip().endswith(')') or stripped.rstrip().endswith('),') or stripped.rstrip().endswith(') {') or stripped.rstrip().endswith('} }') or stripped.rstrip().endswith(') },'))

                if is_single and comp in stripped:
                    idx = stripped.index(comp) + len(comp)
                    inner = stripped[idx:]
                    parts = parse_positional_params(inner)

                    if len(parts) >= 2:
                        second = parts[1].strip()
                        if second == 'null' or second.startswith('stringResource') or second.startswith('"'):
                            positional_cd.append((filepath.replace('\\', '/'), i + 1, stripped[:120], second))
                        else:
                            positional_cd.append((filepath.replace('\\', '/'), i + 1, stripped[:120], second))
                    else:
                        missing_cd.append((filepath.replace('\\', '/'), i + 1, stripped[:120]))
                else:
                    # Multi-line: check if 2nd line has positional contentDescription
                    if i + 2 < len(lines):
                        line2 = lines[i + 2].strip().rstrip(',').strip()
                        if line2 in ['null'] or line2.startswith('stringResource') or line2.startswith('"'):
                            if '=' not in lines[i + 2] or 'contentDescription =' in lines[i + 2]:
                                if 'contentDescription =' not in lines[i + 2]:
                                    positional_cd.append((filepath.replace('\\', '/'), i + 1, stripped[:120], line2))
                                    i += 1
                                    continue
                    missing_cd.append((filepath.replace('\\', '/'), i + 1, stripped[:120]))
            else:
                cd_match = re.search(r'contentDescription\s*=\s*"([^"]+)"', call_text)
                if cd_match:
                    hardcoded_cd.append((filepath.replace('\\', '/'), i + 1, cd_match.group(1)))

        i += 1

print("=" * 70)
print("REAL ACCESSIBILITY AUDIT RESULTS")
print("=" * 70)

if positional_cd:
    print(f"\n--- Positional contentDescription (cosmetic, should use named param): {len(positional_cd)} ---")
    for rel, ln, text, val in positional_cd:
        print(f"  {rel}:{ln}: {text}  [value: {val}]")

if missing_cd:
    print(f"\n--- ACTUALLY MISSING contentDescription: {len(missing_cd)} ---")
    for rel, ln, text in missing_cd:
        print(f"  {rel}:{ln}: {text}")

if hardcoded_cd:
    print(f"\n--- Hardcoded contentDescription strings: {len(hardcoded_cd)} ---")
    for rel, ln, text in hardcoded_cd:
        print(f"  {rel}:{ln}: \"{text}\"")

print(f"\n{'=' * 70}")
print(f"Summary:")
print(f"  Positional (cosmetic): {len(positional_cd)}")
print(f"  Missing (real issue):  {len(missing_cd)}")
print(f"  Hardcoded (real issue): {len(hardcoded_cd)}")
print(f"  Total real issues: {len(missing_cd) + len(hardcoded_cd)}")
print(f"{'=' * 70}")
