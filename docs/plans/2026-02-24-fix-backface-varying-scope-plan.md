---
title: "fix: backface fade varying declared inside dead #ifdef USE_DASH"
type: fix
status: completed
date: 2026-02-24
---

# fix: backface fade varying declared inside dead `#ifdef USE_DASH`

## Problem Statement

Globe renders black (silent shader link failure) after the backface-fade commits (694f8ef, 85396da).

**Root cause:** The `onBeforeCompile` patch in `src/lib/contours.ts:118-145` injects `varying vec3 vBackfaceWorldPos;` by replacing `varying float vLineDistance;`. In the **vertex shader**, that string lives inside `#ifdef USE_DASH` (LineMaterial.js:64-71) — since USE_DASH is off, the declaration is preprocessed out. In the **fragment shader**, the same string is at global scope (LineMaterial.js:257), so `vBackfaceWorldPos` IS declared. Varying mismatch → GLSL link error → nothing renders.

The other two replacements (`vec4 start = modelViewMatrix...` at line 106 and `gl_FragColor` at line 394) are both at unconditional scope and work fine.

## Proposed Solution

Replace the fragile `vLineDistance`-adjacent injection with a simple **prepend** of the varying declaration to both shader sources. This is the standard Three.js `onBeforeCompile` pattern — no dependency on where existing declarations happen to sit relative to `#ifdef` blocks.

### `src/lib/contours.ts` — changes to `onBeforeCompile`

```ts
material.onBeforeCompile = (shader) => {
  // Vertex shader: declare varying + compute world-space position
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
```

**What changes:**
- Lines 120-124 and 132-136 (the two `vLineDistance` replacements) → replaced with prepends
- Lines 125-129 and 137-144 → unchanged (those targets are unconditional)

## Acceptance Criteria

- [x] Globe renders with visible contour lines
- [x] Backface lines fade correctly (back hemisphere near-transparent)
- [x] `npm run build` succeeds with no errors
- [x] No shader warnings in browser console

## Context

- Affected file: `src/lib/contours.ts` (lines 118-145)
- Shader host: `node_modules/three/examples/jsm/lines/LineMaterial.js`
- The uncommitted changes in `heightmap.ts` (downsampling) and `MarsGlobe.tsx` (error catch) are unrelated improvements and should be committed alongside
