import { computed, ref, watch } from 'vue'

export type Theme = 'dark' | 'light'

// Debe coincidir con el script inline de index.html (evita el parpadeo al cargar)
const STORAGE_KEY = 'atlashacker:theme'
const THEME_COLOR: Record<Theme, string> = { dark: '#000000', light: '#ffffff' }

function readSaved(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

// Estado compartido por toda la app; oscuro por defecto (identidad de marca)
const theme = ref<Theme>(readSaved())

watch(
  theme,
  (value) => {
    document.documentElement.dataset.theme = value
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[value])
    try {
      localStorage.setItem(STORAGE_KEY, value)
    } catch {
      // Sin almacenamiento: el tema dura solo esta sesión
    }
  },
  { immediate: true },
)

export function useTheme() {
  const isDark = computed(() => theme.value === 'dark')

  function toggle() {
    theme.value = isDark.value ? 'light' : 'dark'
  }

  return { theme, isDark, toggle }
}
