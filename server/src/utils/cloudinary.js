import { v2 as cloudinary } from 'cloudinary'
import { CloudinaryStorage } from 'multer-storage-cloudinary'
import multer from 'multer'
import { createLogger } from './logger.js'

const log = createLogger('Cloudinary')

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export async function verifyCloudinary() {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    log.warn('Cloudinary non configuré — uploads désactivés')
    return false
  }
  try {
    await cloudinary.api.ping()
    log.info('Cloudinary connecté')
    return true
  } catch (err) {
    log.error({ err }, 'Erreur connexion Cloudinary')
    return false
  }
}

export function isCloudinaryConfigured() {
  return !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
}

export function requireCloudinary(req, res, next) {
  if (!isCloudinaryConfigured()) {
    log.error({ url: req.url, method: req.method }, 'Upload rejeté — Cloudinary non configuré')
    return res.status(503).json({
      error: 'Service d\'upload non configuré. Contactez l\'administrateur pour configurer Cloudinary.',
    })
  }
  next()
}

const logoStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'gestpharma/logos',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'svg'],
    transformation: [
      { width: 400, height: 400, crop: 'limit' },
      { quality: 'auto', fetch_format: 'auto' }
    ],
    public_id: (req, file) => {
      const slug = req.tenant?.slug || 'unknown'
      return `logo-${slug}-${Date.now()}`
    },
  },
})

const ordonnanceStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'gestpharma/ordonnances',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
    resource_type: 'auto',
    public_id: (req, file) => {
      const tenantSlug = req.tenant?.slug || 'unknown'
      return `ordonnance-${tenantSlug}-${Date.now()}`
    },
  },
})

const imageStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'gestpharma/images',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'svg'],
    transformation: [
      { width: 1920, height: 1080, crop: 'limit' },
      { quality: 'auto', fetch_format: 'auto' }
    ],
    public_id: (req, file) => {
      const slug = req.tenant?.slug || 'unknown'
      return `${file.fieldname}-${slug}-${Date.now()}`
    },
  },
})

const videoStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'gestpharma/videos',
    resource_type: 'video',
    public_id: (req, file) => {
      const slug = req.tenant?.slug || 'unknown'
      return `${file.fieldname}-${slug}-${Date.now()}`
    },
  },
})

export const uploadLogo = multer({
  storage: logoStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
    if (allowed.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Format non supporté. Utilisez JPG, PNG, WebP ou SVG'), false)
    }
  },
})

export const uploadOrdonnance = multer({
  storage: ordonnanceStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (allowed.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Format non supporté. Utilisez JPG, PNG, WebP ou PDF'), false)
    }
  },
})

export const uploadImage = multer({
  storage: imageStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(new Error('Seuls les fichiers image sont autorisés'), false)
    }
  },
})

export const uploadVideo = multer({
  storage: videoStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime']
    if (allowedVideoTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Seuls les fichiers vidéo (MP4, WebM, OGG, MOV) sont autorisés'), false)
    }
  },
})

const docStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'gestpharma/documents-approvisionnement',
    allowed_formats: ['pdf', 'jpg', 'jpeg', 'png'],
    resource_type: 'auto',
    public_id: (req, file) => {
      const type = req.path.includes('bon-commande')
        ? 'BC' : req.path.includes('bon-livraison')
        ? 'BL' : 'DOC'
      const slug = req.tenant?.slug || 'unknown'
      return `${type}-${slug}-${Date.now()}`
    },
  },
})

export const uploadDocument = multer({
  storage: docStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
    if (allowed.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Format non supporté. Utilisez PDF, JPG ou PNG'), false)
    }
  },
})

export async function deleteImage(publicId) {
  if (!publicId) return
  try {
    await cloudinary.uploader.destroy(publicId)
    log.info({ publicId }, 'Image supprimée de Cloudinary')
  } catch (err) {
    log.error({ err, publicId }, 'Erreur suppression image Cloudinary')
  }
}

export { cloudinary }
