import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'


export default defineConfig(({ mode }) => {
    if (mode === "production") {
        return {
            plugins: [react(), tailwindcss()],
            server: {
                host: true,
                // allowedHosts: "client.rachee.dev",
            }

        }
    }
})
