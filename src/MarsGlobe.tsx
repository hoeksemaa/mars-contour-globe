import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { loadHeightmap } from './lib/heightmap'
import { buildContourLines } from './lib/contours'
import type { LineMaterial } from 'three/addons/lines/LineMaterial.js'

export default function MarsGlobe() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setClearColor(0x000000)
    renderer.toneMapping = THREE.ReinhardToneMapping
    container.appendChild(renderer.domElement)

    // Scene
    const scene = new THREE.Scene()

    // Camera
    const camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    )
    camera.position.set(0, 0, 12)

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.minDistance = 5
    controls.maxDistance = 30
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.3

    // Post-processing
    const composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      1.2,  // strength
      0.4,  // radius
      0.1   // threshold
    )
    composer.addPass(bloomPass)
    composer.addPass(new OutputPass())

    // Track line material for resize updates
    let lineMaterial: LineMaterial | null = null

    // Load heightmap and build contours
    loadHeightmap('/mars_heightmap.jpg').then((heightmap) => {
      const { mesh, material } = buildContourLines(heightmap, {
        baseRadius: 3,
        elevationScale: 1.5,
        thresholdCount: 28,
        lineWidth: 1.5,
      })
      lineMaterial = material
      scene.add(mesh)
    })

    // Resize handler
    const onResize = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
      composer.setSize(w, h)
      bloomPass.resolution.set(w, h)
      if (lineMaterial) {
        lineMaterial.resolution.set(w, h)
      }
    }
    window.addEventListener('resize', onResize)

    // Animation loop
    let animFrameId: number
    const animate = () => {
      animFrameId = requestAnimationFrame(animate)
      controls.update()
      composer.render()
    }
    animate()

    return () => {
      cancelAnimationFrame(animFrameId)
      window.removeEventListener('resize', onResize)
      controls.dispose()
      renderer.dispose()
      container.removeChild(renderer.domElement)
    }
  }, [])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}
