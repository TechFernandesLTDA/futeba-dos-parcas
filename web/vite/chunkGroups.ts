// Chunking do bundle (Rolldown `output.codeSplitting.groups`).
//
// Por que não `manualChunks`: no Rolldown ele herda a semântica do Rollup em que as DEPENDÊNCIAS de um
// módulo atribuído a um chunk são puxadas para o mesmo chunk. Com isso react/react-dom (dependências de
// recharts) caíam em `vendor-charts` e o entry passava a importar ~490 KB de gráficos de forma
// ESTÁTICA, em toda rota (inclusive nas páginas públicas). Aqui cada pacote tem grupo próprio com
// prioridade e `includeDependenciesRecursively: false`: react fica no núcleo e recharts só carrega nas
// rotas que o usam.
//
// Windows: os ids dos módulos podem vir com `\`; sempre normalize antes de comparar.

export const normalizeId = (id: string): string => id.replace(/\\/g, '/')

/** Nome do pacote npm do módulo (`@scope/pkg` ou `pkg`), ou undefined se não for de node_modules. */
export function packageOf(rawId: string): string | undefined {
  const id = normalizeId(rawId)
  const marker = '/node_modules/'
  const idx = id.lastIndexOf(marker)
  if (idx === -1) return undefined
  const parts = id.slice(idx + marker.length).split('/')
  return parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0]
}

const set = (...names: string[]) => new Set(names)

const REACT_CORE = set(
  'react',
  'react-dom',
  'scheduler',
  'react-is',
  'react-router',
  'react-router-dom',
  '@remix-run/router',
  'use-sync-external-store',
)
const I18N = set('i18next', 'react-i18next', 'i18next-browser-languagedetector', 'html-parse-stringify', 'void-elements')
const MUI_RUNTIME = set(
  '@emotion/react',
  '@emotion/styled',
  '@emotion/cache',
  '@emotion/serialize',
  '@emotion/sheet',
  '@emotion/utils',
  '@emotion/is-prop-valid',
  '@emotion/hash',
  '@emotion/memoize',
  '@emotion/unitless',
  '@emotion/weak-memoize',
  '@emotion/use-insertion-effect-with-fallbacks',
  '@popperjs/core',
  'react-transition-group',
  'stylis',
  'hoist-non-react-statics',
  'prop-types',
  'dom-helpers',
  '@babel/runtime',
  'clsx',
)
const CHARTS = set(
  'recharts',
  'react-redux',
  'redux',
  'reselect',
  'immer',
  '@reduxjs/toolkit',
  'es-toolkit',
  'decimal.js-light',
  'eventemitter3',
  'victory-vendor',
  'internmap',
  'redux-thunk',
  'tiny-invariant',
)

// Ícones do shell inicial (App, ErrorBoundary, ConnectionStatus, ToastContext,
// MobileTopBar, NotificationBell e navItems). Ficam no entry (~4 KB no total)
// para não forçar o download estático de `vendor-mui-icons` (~57 KB, 220+ ícones)
// no boot inicial.
const BOOT_MUI_ICONS = set(
  'ArrowBack',
  'BarChart',
  'BugReport',
  'ChatBubble',
  'Check',
  'Close',
  'CloudOff',
  'ContentCopy',
  'EmojiEvents',
  'Error',
  'ErrorOutline',
  'ExpandLess',
  'ExpandMore',
  'Groups',
  'Home',
  'LocationOn',
  'MilitaryTech',
  'NavigateNext',
  'Notifications',
  'NotificationsNone',
  'Person',
  'Refresh',
  'Search',
  'Settings',
  'SportsSoccer',
  'Sync',
  'Wifi',
  'WifiOff',
)

// Componentes @mui/material usados apenas nas rotas lazy (formulários, tabelas,
// drawers, menus, listas, tabs etc.), mantidos fora do chunk `vendor-mui` do boot.
const MUI_LAZY_COMPONENTS = set(
  'Accordion',
  'AccordionActions',
  'AccordionDetails',
  'AccordionSummary',
  'Autocomplete',
  'Breadcrumbs',
  'Checkbox',
  'Divider',
  'Drawer',
  'Fab',
  'FilledInput',
  'FormControlLabel',
  'FormGroup',
  'FormHelperText',
  'FormLabel',
  'Input',
  'InputAdornment',
  'InputBase',
  'InputLabel',
  'List',
  'ListItem',
  'ListItemAvatar',
  'ListItemButton',
  'ListItemIcon',
  'ListItemSecondaryAction',
  'ListItemText',
  'ListSubheader',
  'Menu',
  'MenuItem',
  'MenuList',
  'MobileStepper',
  'NativeSelect',
  'OutlinedInput',
  'Pagination',
  'PaginationItem',
  'Popover',
  'Radio',
  'RadioGroup',
  'Rating',
  'Select',
  'Slider',
  'SpeedDial',
  'SpeedDialAction',
  'SpeedDialIcon',
  'Step',
  'StepButton',
  'StepConnector',
  'StepContent',
  'StepIcon',
  'StepLabel',
  'Stepper',
  'SwipeableDrawer',
  'Switch',
  'Tab',
  'TabScrollButton',
  'Table',
  'TableBody',
  'TableCell',
  'TableContainer',
  'TableFooter',
  'TableHead',
  'TablePagination',
  'TableRow',
  'TableSortLabel',
  'Tabs',
  'TextField',
  'ToggleButton',
  'ToggleButtonGroup',
)

function isBootMuiIcon(rawId: string): boolean {
  const id = normalizeId(rawId)
  if (id.includes('/@mui/icons-material/esm/utils/') || id.includes('/@mui/icons-material/utils/')) {
    return true
  }
  const match = id.match(/\/@mui\/icons-material\/(?:esm\/)?([^/.]+)\.[cm]?js$/)
  return match !== null && BOOT_MUI_ICONS.has(match[1])
}

function isLazyMuiMaterialComponent(rawId: string, pkg: string | undefined): boolean {
  if (pkg !== '@mui/material') return false
  const id = normalizeId(rawId)
  // FormControl (no core) importa apenas `InputBase/utils` (isFilled/isAdornedStart, ~200B).
  if (id.includes('/@mui/material/InputBase/utils') || id.includes('/@mui/material/esm/InputBase/utils')) {
    return false
  }
  const match = id.match(/\/node_modules\/@mui\/material\/(?:esm\/)?([^/]+)\//)
  return match !== null && MUI_LAZY_COMPONENTS.has(match[1])
}

type Matcher = (id: string, pkg: string | undefined) => boolean

const fromPkgs = (names: Set<string>): Matcher => (_id, pkg) => pkg !== undefined && names.has(pkg)

export interface ChunkGroup {
  name: string
  priority: number
  matches: Matcher
}

// Ordem = precedência (maior prioridade primeiro).
export const CHUNK_GROUPS: ChunkGroup[] = [
  { name: 'vendor-react', priority: 100, matches: fromPkgs(REACT_CORE) },
  { name: 'vendor-i18n', priority: 90, matches: fromPkgs(I18N) },
  { name: 'i18n-en', priority: 92, matches: (id) => normalizeId(id).endsWith('/src/i18n/locales/en.json') },
  { name: 'i18n-es', priority: 92, matches: (id) => normalizeId(id).endsWith('/src/i18n/locales/es.json') },
  { name: 'i18n-locales', priority: 90, matches: (id) => normalizeId(id).includes('/src/i18n/locales/') },
  {
    name: 'vendor-mui-icons',
    priority: 80,
    matches: (id, pkg) => pkg === '@mui/icons-material' && !isBootMuiIcon(id),
  },
  { name: 'vendor-mui-pickers', priority: 80, matches: (_id, pkg) => pkg === '@mui/x-date-pickers' },
  { name: 'vendor-date-fns', priority: 80, matches: (_id, pkg) => pkg === 'date-fns' },
  {
    name: 'vendor-mui-extra',
    priority: 75,
    matches: (id, pkg) => isLazyMuiMaterialComponent(id, pkg),
  },
  {
    name: 'vendor-mui',
    priority: 70,
    matches: (id, pkg) =>
      pkg !== undefined &&
      ((pkg.startsWith('@mui/') && (pkg !== '@mui/icons-material' || isBootMuiIcon(id))) || MUI_RUNTIME.has(pkg)),
  },
  // Firebase: serviços frios ficam fora do chunk inicial de auth/dados.
  { name: 'vendor-firebase-messaging', priority: 65, matches: (id) => /\/(@firebase|firebase)\/messaging/.test(normalizeId(id)) },
  { name: 'vendor-firebase-storage', priority: 65, matches: (id) => /\/(@firebase|firebase)\/storage/.test(normalizeId(id)) },
  { name: 'vendor-firebase-functions', priority: 65, matches: (id) => /\/(@firebase|firebase)\/functions/.test(normalizeId(id)) },
  { name: 'vendor-firebase-analytics', priority: 65, matches: (id) => /\/(@firebase|firebase)\/analytics/.test(normalizeId(id)) },
  {
    name: 'vendor-firebase',
    priority: 60,
    matches: (_id, pkg) => pkg !== undefined && (pkg === 'firebase' || pkg.startsWith('@firebase/') || pkg === 'idb'),
  },
  { name: 'vendor-query', priority: 50, matches: (_id, pkg) => pkg === '@tanstack/react-query' || pkg === '@tanstack/query-core' },
  {
    name: 'vendor-charts',
    priority: 40,
    matches: (_id, pkg) => pkg !== undefined && (CHARTS.has(pkg) || pkg.startsWith('d3-') || pkg.startsWith('victory-')),
  },
  {
    name: 'vendor-google-maps',
    priority: 40,
    matches: (_id, pkg) => pkg !== undefined && (pkg === '@react-google-maps/api' || pkg.startsWith('@googlemaps/')),
  },
]

/** Resolve o nome do chunk de um módulo (undefined = chunking automático). Usado também nos testes. */
export function chunkNameFor(rawId: string): string | undefined {
  const pkg = packageOf(rawId)
  let best: ChunkGroup | undefined
  for (const group of CHUNK_GROUPS) {
    if (group.matches(rawId, pkg) && (!best || group.priority > best.priority)) best = group
  }
  return best?.name
}

/** Grupos no formato de `build.rolldownOptions.output.codeSplitting`. */
export const codeSplittingGroups = CHUNK_GROUPS.map((group) => ({
  name: group.name,
  priority: group.priority,
  includeDependenciesRecursively: false,
  test: (id: string) => group.matches(id, packageOf(id)),
}))
