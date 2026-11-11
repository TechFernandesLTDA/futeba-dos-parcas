/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_VERSION: string
  readonly VITE_APP_BUILD: string
  readonly VITE_USE_EMULATOR?: string
  readonly VITE_ADSENSE_PUBLISHER_ID?: string
  readonly VITE_ADSENSE_SLOT_BANNER?: string
  readonly VITE_ADSENSE_NON_PERSONALIZED?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  prompt(): Promise<void>
}

interface WindowEventMap {
  beforeinstallprompt: BeforeInstallPromptEvent
}

interface Navigator {
  readonly standalone?: boolean
}
