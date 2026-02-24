import * as THREE from 'three'
import { contours as d3Contours } from 'd3-contour'
import { range } from 'd3-array'
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js'
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { elevationToColor } from './colorRamp'
import type { HeightmapData } from './heightmap'

const DEG2RAD = Math.PI / 180

function pixelToLatLon(
  px: number,
  py: number,
  width: number,
  height: number
): { lat: number; lon: number } {
  return {
    lon: (px / width) * 360 - 180,
    lat: 90 - (py / height) * 180,
  }
}

function latLonToSphere(
  lat: number,
  lon: number,
  radius: number
): THREE.Vector3 {
  const phi = (90 - lat) * DEG2RAD
  const theta = (lon + 180) * DEG2RAD
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  )
}

export interface ContourConfig {
  baseRadius: number
  elevationScale: number // how much to extrude above base radius
  thresholdCount: number // number of contour levels
  lineWidth: number
}

export function buildContourLines(
  heightmap: HeightmapData,
  config: ContourConfig
): { mesh: LineSegments2; material: LineMaterial } {
  const { values, width, height } = heightmap
  const { baseRadius, elevationScale, thresholdCount } = config

  // Generate contour thresholds (skip 0 and 1 extremes)
  const thresholds = range(thresholdCount).map(
    (i) => (i + 1) / (thresholdCount + 1)
  )

  // Scale values to 0-255 range for d3-contour (it works with raw numbers)
  const scaled = new Float64Array(values.length)
  for (let i = 0; i < values.length; i++) {
    scaled[i] = values[i] * 255
  }

  const contourGen = d3Contours()
    .size([width, height])
    .thresholds(thresholds.map((t) => t * 255))

  // d3-contour accepts ArrayLike<number> at runtime; TS types are overly strict
  const contourPolygons = contourGen(scaled as unknown as number[])

  // Build line segments: pairs of consecutive points per ring
  // LineSegmentsGeometry takes pairs: [Ax, Ay, Az, Bx, By, Bz, Cx, Cy, Cz, Dx, Dy, Dz, ...]
  // where AB and CD are separate segments
  const positions: number[] = []
  const colors: number[] = []

  for (const polygon of contourPolygons) {
    const t = polygon.value / 255 // normalized elevation
    const color = elevationToColor(t)
    const r = baseRadius + t * elevationScale

    for (const multiPoly of polygon.coordinates) {
      for (const ring of multiPoly) {
        // Convert ring to line segments (consecutive pairs)
        for (let i = 0; i < ring.length - 1; i++) {
          const [px1, py1] = ring[i]
          const [px2, py2] = ring[i + 1]

          const ll1 = pixelToLatLon(px1, py1, width, height)
          const ll2 = pixelToLatLon(px2, py2, width, height)

          const v1 = latLonToSphere(ll1.lat, ll1.lon, r)
          const v2 = latLonToSphere(ll2.lat, ll2.lon, r)

          positions.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z)
          colors.push(color.r, color.g, color.b, color.r, color.g, color.b)
        }
      }
    }
  }

  const geometry = new LineSegmentsGeometry()
  geometry.setPositions(positions)
  geometry.setColors(colors)

  const material = new LineMaterial({
    linewidth: config.lineWidth,
    vertexColors: true,
    worldUnits: false, // screen-space pixels
    transparent: true,
    depthWrite: false,
  })
  // Resolution must be set — critical for LineMaterial
  material.resolution.set(window.innerWidth, window.innerHeight)

  // Fade lines on far side of sphere to near-invisible.
  // worldPos varying only exists under WORLD_UNITS, so we inject our own.
  // Coupled to three.js LineMaterial shader source — pin version.
  material.onBeforeCompile = (shader) => {
    // Vertex shader: declare varying + compute world-space position
    // Prepend to avoid #ifdef USE_DASH scope — vLineDistance is conditional
    shader.vertexShader =
      'varying vec3 vBackfaceWorldPos;\n' + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace(
      'vec4 start = modelViewMatrix * vec4( instanceStart, 1.0 );',
      `vBackfaceWorldPos = ( modelMatrix * vec4( instanceStart, 1.0 ) ).xyz;
       vec4 start = modelViewMatrix * vec4( instanceStart, 1.0 );`
    )

    // Fragment shader: declare varying + fade alpha by facing ratio
    shader.fragmentShader =
      'varying vec3 vBackfaceWorldPos;\n' + shader.fragmentShader
    shader.fragmentShader = shader.fragmentShader.replace(
      'gl_FragColor = vec4( diffuseColor.rgb, alpha );',
      `vec3 surfaceNormal = normalize(vBackfaceWorldPos);
       vec3 viewDir = normalize(cameraPosition - vBackfaceWorldPos);
       float facing = dot(surfaceNormal, viewDir);
       float fadeFactor = smoothstep(-0.05, 0.35, facing);
       gl_FragColor = vec4( diffuseColor.rgb, alpha * fadeFactor );`
    )
  }

  const mesh = new LineSegments2(geometry, material)
  return { mesh, material }
}
