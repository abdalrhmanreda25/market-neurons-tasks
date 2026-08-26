'use client'

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024 // guard before we even decode
const OUTPUT_SIZE = 256

/**
 * Centre-crops an image file to a square and returns a compressed JPEG data
 * URL. Firebase Storage is not provisioned on this project, and a 256px JPEG
 * lands around 15-25 KB, far below Firestore's 1 MB document ceiling.
 */
export function fileToAvatarDataUrl(file, size = OUTPUT_SIZE) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('No file selected.'))
    if (!file.type.startsWith('image/')) return reject(new Error('Pick an image file.'))
    if (file.size > MAX_UPLOAD_BYTES) return reject(new Error('That image is larger than 8 MB.'))

    const url = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      URL.revokeObjectURL(url)
      try {
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        ctx.imageSmoothingQuality = 'high'

        const side = Math.min(img.width, img.height)
        const sx = (img.width - side) / 2
        const sy = (img.height - side) / 2
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size)

        // Step the quality down until it comfortably fits in a document.
        let quality = 0.85
        let out = canvas.toDataURL('image/jpeg', quality)
        while (out.length > 120_000 && quality > 0.4) {
          quality -= 0.1
          out = canvas.toDataURL('image/jpeg', quality)
        }
        if (out.length > 200_000) return reject(new Error('That image is too complex to compress. Try another.'))
        resolve(out)
      } catch (err) {
        reject(err)
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('That file could not be read as an image.'))
    }
    img.src = url
  })
}
