// Genera los íconos optimizados (.webp) a partir de los PNG originales.
// Uso: npm run icons:optimize
import { readdir, stat } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ICONS_DIR = fileURLToPath(new URL('../src/assets/icons/', import.meta.url))
const ORIGINALS_DIR = join(ICONS_DIR, 'originals')
// 3× el círculo de las historias (64px)
const MAX_SIZE = 192

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`

const files = (await readdir(ORIGINALS_DIR)).filter((f) => extname(f).toLowerCase() === '.png')
let before = 0
let after = 0

for (const file of files) {
  const input = join(ORIGINALS_DIR, file)
  const output = join(ICONS_DIR, `${basename(file, extname(file))}.webp`)

  await sharp(input)
    .resize(MAX_SIZE, MAX_SIZE, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82, alphaQuality: 90, effort: 6 })
    .toFile(output)

  const [{ size: inSize }, { size: outSize }] = await Promise.all([stat(input), stat(output)])
  before += inSize
  after += outSize
  console.log(`${file.padEnd(18)} ${kb(inSize).padStart(10)} → ${kb(outSize).padStart(9)}`)
}

console.log(`${'Total'.padEnd(18)} ${kb(before).padStart(10)} → ${kb(after).padStart(9)} (−${Math.round((1 - after / before) * 100)}%)`)
