import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

// 类型定义
export interface Env {
  AI: Ai
  BUCKET: R2Bucket
  DB: D1Database
  JWT_SECRET: string
  ADMIN_USERNAME: string
  ADMIN_PASSWORD: string
}

// 图片类型
export interface Image {
  id: string
  prompt: string
  file_key: string
  file_url?: string
  width: number
  height: number
  is_visible: boolean
  created_at: string
  created_by: string
}

// API 响应类型
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  meta?: {
    total: number
    page: number
    limit: number
  }
}

const app = new Hono<{ Bindings: Env }>()

// 中间件
app.use('*', logger())
app.use('*', cors())

// 导入路由
import authRoutes from './routes/auth'
import imagesRoutes from './routes/images'
import adminRoutes from './routes/admin'

app.route('/api/auth', authRoutes)
app.route('/api/images', imagesRoutes)
app.route('/api/admin', adminRoutes)

// 首页
app.get('/', (c) => {
  return c.html(getIndexHtml())
})

// Admin 页面
app.get('/admin', (c) => {
  return c.html(getAdminHtml())
})

// 生成 HTML 页面
function getIndexHtml(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Gallery</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <div class="app">
    <header class="header">
      <div class="header-inner">
        <div class="logo">
          <span class="logo-icon">✨</span>
          <span class="logo-text">AI Gallery</span>
        </div>
        <nav class="nav">
          <a href="/admin" class="nav-link">Admin</a>
        </nav>
      </div>
    </header>

    <main class="main">
      <!-- 搜索栏 -->
      <div class="search-bar">
        <div class="search-input-wrapper">
          <input type="text" id="search-input" placeholder="搜索图片描述...">
          <button id="search-btn" class="search-btn">搜索</button>
          <button id="clear-search" class="clear-btn">清除</button>
        </div>
        <div class="search-info">
          <span id="search-status" class="search-status hidden"></span>
          <span id="image-count" class="image-count"></span>
        </div>
      </div>

      <div class="gallery-container">
        <div id="gallery" class="gallery"></div>
        <div id="loader" class="loader">
          <div class="spinner"></div>
        </div>
        <div id="empty" class="empty hidden">
          <p>暂无图片</p>
        </div>
      </div>
    </main>

    <div id="modal" class="modal hidden">
      <div class="modal-backdrop"></div>
      <div class="modal-content">
        <button class="modal-close">&times;</button>
        <img id="modal-image" src="" alt="">
        <div class="modal-info">
          <p id="modal-prompt"></p>
          <span id="modal-date"></span>
        </div>
      </div>
    </div>
  </div>
  <script src="/app.js"></script>
</body>
</html>`
}

function getAdminHtml(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin - AI Gallery</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <div class="app">
    <header class="header">
      <div class="header-inner">
        <div class="logo">
          <span class="logo-icon">✨</span>
          <span class="logo-text">AI Gallery</span>
        </div>
        <nav class="nav">
          <a href="/" class="nav-link">Gallery</a>
          <button id="logout-btn" class="nav-link hidden">Logout</button>
        </nav>
      </div>
    </header>

    <main class="main">
      <!-- 登录表单 -->
      <div id="login-section" class="auth-container">
        <form id="login-form" class="auth-form">
          <h2>Admin Login</h2>
          <div class="form-group">
            <input type="text" id="username" placeholder="Username" required>
          </div>
          <div class="form-group">
            <input type="password" id="password" placeholder="Password" required>
          </div>
          <button type="submit" class="btn-primary">Login</button>
          <p id="login-error" class="error-msg hidden"></p>
        </form>
      </div>

      <!-- Admin 面板 -->
      <div id="admin-panel" class="hidden">
        <div class="generate-section">
          <h2>Generate Image</h2>
          <form id="generate-form" class="generate-form">
            <textarea id="prompt" placeholder="Describe the image you want to generate..." required></textarea>

            <div class="generate-options">
              <select id="model"></select>
              <select id="size">
                <option value="1024x1024">1024 × 1024</option>
                <option value="512x512">512 × 512</option>
                <option value="768x768">768 × 768</option>
              </select>
              <button type="submit" class="btn-primary" id="generate-btn">Generate</button>
            </div>

            <button type="button" id="advanced-toggle" class="advanced-toggle">高级选项 ▼</button>

            <div id="advanced-options" class="advanced-options hidden">
              <!-- 参考图片 -->
              <div id="reference-image-group" class="form-group reference-image-group">
                <label for="reference-image">参考图片（可选）</label>
                <div class="reference-upload">
                  <input type="file" id="reference-image" accept="image/*">
                  <div id="reference-preview" class="reference-preview hidden">
                    <img id="reference-preview-img" src="" alt="Preview">
                    <button type="button" id="remove-reference" class="remove-btn">×</button>
                  </div>
                </div>
                <p class="hint">上传参考图片，AI 将基于该图片进行生成</p>
              </div>

              <div id="negative-prompt-group" class="form-group">
                <label for="negative-prompt">负面提示词</label>
                <textarea id="negative-prompt" placeholder="不想在图片中出现的内容..." rows="2"></textarea>
              </div>

              <div class="advanced-row">
                <div class="form-group">
                  <label for="num-steps">步数</label>
                  <input type="number" id="num-steps" min="1" max="50" step="1">
                </div>

                <div id="guidance-group" class="form-group">
                  <label for="guidance">引导系数</label>
                  <input type="number" id="guidance" min="0" max="20" step="0.5">
                </div>

                <div class="form-group">
                  <label for="seed">种子 (可选)</label>
                  <input type="number" id="seed" placeholder="随机">
                </div>
              </div>
            </div>
          </form>

          <div id="generate-status" class="generate-status hidden">
            <div class="spinner"></div>
            <span>Generating...</span>
          </div>
        </div>

        <div class="divider"></div>

        <div class="gallery-section">
          <div class="gallery-header">
            <h2>My Images</h2>
            <div class="gallery-controls">
              <div id="date-filter" class="date-filter"></div>
              <span id="admin-image-count" class="admin-image-count"></span>
            </div>
          </div>
          <div id="admin-gallery" class="gallery"></div>
        </div>
      </div>
    </main>
  </div>
  <script src="/admin.js"></script>
</body>
</html>`
}

export default app