import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { openInPhotoshopPlugin } from './vite.photoshop.ts'
import { studioTemplatesPlugin } from './vite.templates.ts'
import { subjectCutoutPlugin } from './vite.cutout.ts'

export default defineConfig({
  plugins: [react(), tailwindcss(), openInPhotoshopPlugin(), subjectCutoutPlugin(), studioTemplatesPlugin()],
})
