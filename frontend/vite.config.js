import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // This setting is crucial for client-side routing.
    // It prevents 404 errors by serving index.html for any path.
    historyApiFallback: true,
    port: 5173, // You can specify a port if needed
  },
})
