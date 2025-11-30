import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'


export default defineConfig(({ mode }) => {
    if (mode =="production") {
        return {
            plugins: [react(), tailwindcss()],
            server: {
                host: true,
                allowedHosts: ["https://mikiwikipolvoron.github.io"],
            },
            base: '/wilco-client/'
        }
    } else {
        return {
            plugins: [react(), tailwindcss()],
            server: {
                host: true,
                allowedHosts: true
            },
            base: '/'
        }
    }
})
