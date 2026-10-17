import type { EvidenceAttachment } from '@testimonies/types/testimony'

// «Proteger mi huella digital»: vuelve a dibujar la foto en un canvas y la exporta de nuevo. El archivo
// resultante ya no trae metadatos (EXIF/XMP: ubicación GPS, fecha y hora, modelo del teléfono…).
// La orientación se aplica antes de borrar, para que la foto no quede girada.
// Solo JPEG, PNG y WebP (lo que el navegador sabe re-codificar); videos, audios y PDF se suben tal cual.
// De paso, las fotos enormes del celular (12+ MP, 4–8 MB) se reducen a 2560 px por lado: se siguen viendo nítidas
// en cualquier pantalla y quien abre el testimonio descarga ~5 veces menos datos

const REENCODABLE = /^image\/(jpeg|png|webp)$/
const MAX_SIDE = 2560

export async function stripImageMetadata(file: File): Promise<File> {
  if (!REENCODABLE.test(file.type) || typeof createImageBitmap !== 'function') return file
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, file.type, 0.85))
    return blob ? new File([blob], file.name, { type: file.type, lastModified: Date.now() }) : file
  } catch (error) {
    console.warn('No se pudieron borrar los metadatos de', file.name, error)
    return file
  }
}

export async function stripAttachments(attachments: EvidenceAttachment[]): Promise<EvidenceAttachment[]> {
  return Promise.all(attachments.map(async (a) => ({ ...a, file: await stripImageMetadata(a.file) })))
}
