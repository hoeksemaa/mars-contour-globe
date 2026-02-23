import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

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

    // Wireframe sphere placeholder
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(3, 64, 32),
      new THREE.MeshBasicMaterial({ color: 0x333333, wireframe: true })
    )
    scene.add(sphere)

    // Resize handler
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', onResize)

    // Animation loop
    let animFrameId: number
    const animate = () => {
      animFrameId = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
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
