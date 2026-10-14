<script setup lang="ts">
import { onErrorCaptured, ref } from 'vue'
import { useRouter } from 'vue-router'

// Red de seguridad: si una vista falla al dibujarse, Vue puede quedar a medias y dejar la pantalla en negro
// o en blanco. En su lugar se muestra un aviso para recuperarse. Los errores de la API (objetos, no Error)
// los maneja cada vista y no llegan aquí como fallo de la página.
const router = useRouter()
const failure = ref<string | null>(null)

onErrorCaptured((error) => {
  if (!(error instanceof Error)) return true
  console.error(error)
  failure.value = error.message
  return false
})

const DRAFT_KEYS = ['atlashacker:testimony-draft', 'atlashacker:staff-draft']

function recover(clearDrafts: boolean) {
  if (clearDrafts) {
    try {
      DRAFT_KEYS.forEach((k) => localStorage.removeItem(k))
    } catch {
      // Sin almacenamiento: no hay borrador que borrar
    }
  }
  // Recarga completa: garantiza que no quede nada del estado roto
  window.location.assign(clearDrafts ? window.location.href : router.resolve('/').href)
}
</script>

<template>
  <main v-if="failure" class="grid min-h-dvh place-items-center p-4">
    <section class="card-brut-lg w-full max-w-md space-y-4 p-6 text-center" role="alert">
      <p class="text-2xl font-black uppercase"><span class="hl-box hl-orange">Algo salió mal</span></p>
      <p class="text-sm opacity-80">
        La página no pudo mostrarse. Puede ser un borrador guardado de una versión anterior del formulario. Tus testimonios enviados no se pierden.
      </p>
      <div class="flex flex-col gap-3">
        <button type="button" class="btn-hxnf btn-lime" @click="recover(true)">Borrar el borrador y reintentar</button>
        <button type="button" class="btn-hxnf btn-paper" @click="recover(false)">Volver a los mapas</button>
      </div>
      <p class="font-mono text-[11px] break-all opacity-50">{{ failure }}</p>
    </section>
  </main>
  <RouterView v-else />
</template>
