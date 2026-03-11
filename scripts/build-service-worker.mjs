/**
 * Script pour compiler le service worker TypeScript en JavaScript
 * Exécuté après chaque build Next.js
 */
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

const publicDir = path.join(process.cwd(), 'public')
const swSource = path.join(publicDir, 'service-worker.ts')
const swOutput = path.join(publicDir, 'service-worker.js')

if (!fs.existsSync(swSource)) {
  console.warn('[SW Compiler] Service worker source not found')
  process.exit(0)
}

// Utiliser tsc pour compiler TypeScript
const tsc = spawn('npx', ['tsc', swSource, '--target', 'ES2022', '--module', 'ES2022', '--lib', 'ES2022,WebWorker', '--outDir', publicDir], {
  stdio: 'inherit',
  cwd: process.cwd(),
})

tsc.on('close', (code) => {
  if (code === 0) {
    // Renommer le fichier compilé
    const compiled = path.join(publicDir, 'service-worker.js')
    if (fs.existsSync(compiled)) {
      console.log('[SW Compiler] Service worker compiled successfully')
    } else {
      console.warn('[SW Compiler] Compilation produced no output')
    }
  } else {
    console.error('[SW Compiler] Compilation failed with code', code)
    process.exit(1)
  }
})
