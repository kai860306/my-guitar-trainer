import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite' // 1. 引入新版外掛

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(), // 2. 把外掛放進去
  ],
  base: '/my-guitar-trainer/', // 3. 順便幫你把未來 GitHub Pages 部署的路徑預先設定好！
})
