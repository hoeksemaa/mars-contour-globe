export interface HeightmapData {
  values: Float32Array // normalized 0-1
  width: number
  height: number
}

// Max contour-grid dimension. 4096x2048 source kills d3-contour + generates
// millions of segments; 720x360 is plenty for visible contour fidelity.
const MAX_WIDTH = 720

export function loadHeightmap(url: string): Promise<HeightmapData> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      // Downsample to a manageable resolution for contour generation
      let w = img.width
      let h = img.height
      if (w > MAX_WIDTH) {
        const scale = MAX_WIDTH / w
        w = MAX_WIDTH
        h = Math.round(h * scale)
      }

      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Failed to get 2d context'))

      ctx.drawImage(img, 0, 0, w, h)
      const imageData = ctx.getImageData(0, 0, w, h)
      const pixels = imageData.data // RGBA
      const values = new Float32Array(w * h)

      for (let i = 0; i < values.length; i++) {
        // Grayscale JPEG loaded as RGBA — R channel has the elevation
        values[i] = pixels[i * 4] / 255
      }

      resolve({ values, width: w, height: h })
    }
    img.onerror = () => reject(new Error(`Failed to load heightmap: ${url}`))
    img.src = url
  })
}
