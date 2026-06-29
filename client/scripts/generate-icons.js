import sharp from 'sharp'
import { readFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const svgBuffer = readFileSync(join(__dirname, '../public/icons/icon.svg'))
const outDir = join(__dirname, '../public/icons')

mkdirSync(outDir, { recursive: true })

await sharp(svgBuffer).resize(192, 192).png().toFile(join(outDir, 'icon-192.png'))
await sharp(svgBuffer).resize(512, 512).png().toFile(join(outDir, 'icon-512.png'))

console.log('✅ Icônes PWA générées : icon-192.png, icon-512.png')
