import sharp from 'sharp'
import { mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '../public/icons')
const sourcePath = join(outDir, 'logo-source.jpg')

mkdirSync(outDir, { recursive: true })

const sample = await sharp(sourcePath)
  .extract({ left: 2, top: 2, width: 1, height: 1 })
  .raw()
  .toBuffer()

const bg = { r: sample[0], g: sample[1], b: sample[2], alpha: 1 }

async function makeIcon(size, filename, { paddingRatio = 0 } = {}) {
  const inner = Math.max(1, Math.round(size * (1 - paddingRatio * 2)))
  const resized = await sharp(sourcePath)
    .resize(inner, inner, { fit: 'cover' })
    .png()
    .toBuffer()

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: bg,
    },
  })
    .composite([{ input: resized, gravity: 'centre' }])
    .png()
    .toFile(join(outDir, filename))
}

await makeIcon(192, 'icon-192.png')
await makeIcon(512, 'icon-512.png')
await makeIcon(512, 'icon-512-maskable.png', { paddingRatio: 0.12 })
await makeIcon(180, 'apple-touch-icon.png')
await makeIcon(32, 'favicon-32.png')
await makeIcon(48, 'favicon-48.png')

console.log('✅ Icônes PWA générées : icon-192.png, icon-512.png, icon-512-maskable.png, apple-touch-icon.png, favicon-32.png, favicon-48.png')
