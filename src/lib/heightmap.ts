export interface HeightmapData {
  values: Float32Array // normalized 0-1
  width: number
  height: number
}

export function loadHeightmap(url: string): Promise<HeightmapData> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Failed to get 2d context'))

      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, img.width, img.height)
      const pixels = imageData.data // RGBA
      const values = new Float32Array(img.width * img.height)

      for (let i = 0; i < values.length; i++) {
        // Grayscale JPEG loaded as RGBA — R channel has the elevation
        values[i] = pixels[i * 4] / 255
      }

      resolve({ values, width: img.width, height: img.height })
    }
    img.onerror = () => reject(new Error(`Failed to load heightmap: ${url}`))
    img.src = url
  })
}
