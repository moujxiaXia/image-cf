// Admin App
const API_BASE = '/api'

let currentPage = 1
let isLoading = false
let authToken = null
let availableModels = []
let currentDate = '' // 当前选中的日期
let availableDates = [] // 可用日期列表
let referenceImageKey = null // 上传的参考图片 key

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  await loadModels()
  checkAuth()
  setupLoginForm()
  setupGenerateForm()
  setupLogout()
  setupAdvancedToggle()
  setupReferenceImageUpload()
})

// 加载可用模型
async function loadModels() {
  try {
    const response = await fetch(`${API_BASE}/admin/models`)
    const result = await response.json()
    if (result.success) {
      availableModels = result.data
      renderModelSelect()
    }
  } catch (error) {
    console.error('Failed to load models:', error)
  }
}

// 渲染模型选择器
function renderModelSelect() {
  const select = document.getElementById('model')
  if (!select) return

  select.innerHTML = availableModels.map(model => `
    <option value="${model.id}">${model.name}${model.supportsImageInput ? ' 🖼️' : ''}</option>
  `).join('')

  // 更新高级选项显示
  updateAdvancedOptions()
}

// 更新高级选项
function updateAdvancedOptions() {
  const modelSelect = document.getElementById('model')
  const selectedModelId = modelSelect?.value
  const model = availableModels.find(m => m.id === selectedModelId)

  if (!model) return

  // 更新步数范围
  const stepsInput = document.getElementById('num-steps')
  if (stepsInput) {
    stepsInput.max = model.maxSteps
    stepsInput.value = model.defaultSteps
  }

  // 显示/隐藏负面提示词
  const negativeGroup = document.getElementById('negative-prompt-group')
  if (negativeGroup) {
    negativeGroup.style.display = model.supportsNegativePrompt ? 'block' : 'none'
  }

  // 显示/隐藏引导系数
  const guidanceGroup = document.getElementById('guidance-group')
  if (guidanceGroup) {
    guidanceGroup.style.display = model.supportsGuidance ? 'block' : 'none'
    const guidanceInput = document.getElementById('guidance')
    if (guidanceInput && model.defaultGuidance > 0) {
      guidanceInput.value = model.defaultGuidance
    }
  }

  // 显示/隐藏参考图片上传
  const referenceGroup = document.getElementById('reference-image-group')
  if (referenceGroup) {
    referenceGroup.style.display = model.supportsImageInput ? 'block' : 'none'
    // 如果不支持图片输入，清除已上传的参考图片
    if (!model.supportsImageInput) {
      clearReferenceImage()
    }
  }
}

// 设置参考图片上传
function setupReferenceImageUpload() {
  const input = document.getElementById('reference-image')
  const removeBtn = document.getElementById('remove-reference')

  if (input) {
    input.addEventListener('change', async (e) => {
      const file = e.target.files[0]
      if (file) {
        await uploadReferenceImage(file)
      }
    })
  }

  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      clearReferenceImage()
    })
  }
}

// 上传参考图片
async function uploadReferenceImage(file) {
  const preview = document.getElementById('reference-preview')
  const previewImg = document.getElementById('reference-preview-img')

  // 显示预览
  const reader = new FileReader()
  reader.onload = (e) => {
    previewImg.src = e.target.result
    preview.classList.remove('hidden')
  }
  reader.readAsDataURL(file)

  // 上传到服务器
  try {
    const formData = new FormData()
    formData.append('image', file)

    const response = await fetch(`${API_BASE}/admin/upload-reference`, {
      method: 'POST',
      body: formData
    })

    const result = await response.json()

    if (result.success) {
      referenceImageKey = result.data.file_key
    } else {
      alert(result.error || '上传失败')
      clearReferenceImage()
    }
  } catch (error) {
    console.error('Upload failed:', error)
    alert('上传失败，请重试')
    clearReferenceImage()
  }
}

// 清除参考图片
function clearReferenceImage() {
  referenceImageKey = null
  const input = document.getElementById('reference-image')
  const preview = document.getElementById('reference-preview')

  if (input) input.value = ''
  if (preview) preview.classList.add('hidden')
}

// 高级选项切换
function setupAdvancedToggle() {
  const toggle = document.getElementById('advanced-toggle')
  const options = document.getElementById('advanced-options')

  if (toggle && options) {
    toggle.addEventListener('click', () => {
      options.classList.toggle('hidden')
      toggle.textContent = options.classList.contains('hidden') ? '高级选项 ▼' : '高级选项 ▲'
    })
  }

  // 模型选择变化时更新选项
  const modelSelect = document.getElementById('model')
  if (modelSelect) {
    modelSelect.addEventListener('change', updateAdvancedOptions)
  }
}

// 检查认证状态
async function checkAuth() {
  try {
    const response = await fetch(`${API_BASE}/auth/verify`)
    const result = await response.json()

    if (result.success) {
      showAdminPanel()
      await loadAvailableDates()
      loadAdminImages()
    }
  } catch (error) {
    console.error('Auth check failed:', error)
  }
}

// 登录表单
function setupLoginForm() {
  const form = document.getElementById('login-form')
  form.addEventListener('submit', async (e) => {
    e.preventDefault()

    const username = document.getElementById('username').value
    const password = document.getElementById('password').value
    const errorEl = document.getElementById('login-error')

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })

      const result = await response.json()

      if (result.success) {
        authToken = result.data.token
        showAdminPanel()
        await loadAvailableDates()
        loadAdminImages()
      } else {
        errorEl.textContent = result.error || '登录失败'
        errorEl.classList.remove('hidden')
      }
    } catch (error) {
      errorEl.textContent = '网络错误，请重试'
      errorEl.classList.remove('hidden')
    }
  })
}

// 生成图片表单
function setupGenerateForm() {
  const form = document.getElementById('generate-form')

  form.addEventListener('submit', async (e) => {
    e.preventDefault()

    const prompt = document.getElementById('prompt').value.trim()
    const negativePrompt = document.getElementById('negative-prompt')?.value.trim()
    const size = document.getElementById('size').value
    const model = document.getElementById('model')?.value
    const numSteps = parseInt(document.getElementById('num-steps')?.value) || undefined
    const guidance = parseFloat(document.getElementById('guidance')?.value) || undefined
    const seedInput = document.getElementById('seed')?.value.trim()
    const seed = seedInput ? parseInt(seedInput) : undefined
    const statusEl = document.getElementById('generate-status')
    const btn = document.getElementById('generate-btn')

    if (!prompt) return

    btn.disabled = true
    statusEl.classList.remove('hidden')

    try {
      const requestBody = { prompt, size }
      if (model) requestBody.model = model
      if (negativePrompt) requestBody.negative_prompt = negativePrompt
      if (numSteps) requestBody.num_steps = numSteps
      if (guidance) requestBody.guidance = guidance
      if (seed !== undefined) requestBody.seed = seed
      if (referenceImageKey) requestBody.reference_image_key = referenceImageKey

      const response = await fetch(`${API_BASE}/admin/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      const result = await response.json()

      if (result.success) {
        // 清空输入
        document.getElementById('prompt').value = ''
        document.getElementById('negative-prompt').value = ''
        document.getElementById('seed').value = ''
        clearReferenceImage()
        // 刷新日期列表和图片
        await loadAvailableDates()
        // 切换到今天的日期
        const today = new Date().toISOString().split('T')[0]
        currentDate = today
        updateDateSelect()
        loadAdminImages(1)
      } else {
        alert(result.error || '生成失败')
      }
    } catch (error) {
      console.error('Generate failed:', error)
      alert('网络错误，请重试')
    } finally {
      btn.disabled = false
      statusEl.classList.add('hidden')
    }
  })
}

// 登出
function setupLogout() {
  const btn = document.getElementById('logout-btn')
  btn.addEventListener('click', async () => {
    await fetch(`${API_BASE}/auth/logout`, { method: 'POST' })
    authToken = null
    showLoginForm()
  })
}

// 显示 Admin 面板
function showAdminPanel() {
  document.getElementById('login-section').classList.add('hidden')
  document.getElementById('admin-panel').classList.remove('hidden')
  document.getElementById('logout-btn').classList.remove('hidden')
}

// 显示登录表单
function showLoginForm() {
  document.getElementById('login-section').classList.remove('hidden')
  document.getElementById('admin-panel').classList.add('hidden')
  document.getElementById('logout-btn').classList.add('hidden')
}

// 加载可用日期列表
async function loadAvailableDates() {
  try {
    const response = await fetch(`${API_BASE}/admin/dates`)
    const result = await response.json()

    if (result.success) {
      availableDates = result.data
      renderDateFilter()
    }
  } catch (error) {
    console.error('Failed to load dates:', error)
  }
}

// 渲染日期筛选器
function renderDateFilter() {
  const container = document.getElementById('date-filter')
  if (!container || availableDates.length === 0) return

  // 添加"全部"选项
  const allOption = { date: '', count: availableDates.reduce((sum, d) => sum + d.count, 0), label: '全部' }

  container.innerHTML = `
    <select id="date-select" class="date-select">
      <option value="">全部 (${allOption.count})</option>
      ${availableDates.map(d => `
        <option value="${d.date}">${formatDateShort(d.date)} (${d.count})</option>
      `).join('')}
    </select>
  `

  // 绑定事件
  document.getElementById('date-select').addEventListener('change', (e) => {
    currentDate = e.target.value
    loadAdminImages(1)
  })
}

// 更新日期选择器选中状态
function updateDateSelect() {
  const select = document.getElementById('date-select')
  if (select) {
    select.value = currentDate
  }
}

// 加载 Admin 图片列表
async function loadAdminImages(page = 1) {
  if (isLoading) return

  isLoading = true
  currentPage = page

  try {
    let url = `${API_BASE}/admin/images?page=${page}&limit=30`
    if (currentDate) {
      url += `&date=${currentDate}`
    }

    const response = await fetch(url)
    const result = await response.json()

    if (result.success) {
      renderAdminImages(result.data, result.meta)
    }
  } catch (error) {
    console.error('Failed to load images:', error)
  } finally {
    isLoading = false
  }
}

// 渲染 Admin 图片
function renderAdminImages(images, meta) {
  const gallery = document.getElementById('admin-gallery')
  const countEl = document.getElementById('admin-image-count')

  // 更新计数
  if (countEl) {
    const dateText = meta.date ? formatDateShort(meta.date) : '全部'
    countEl.textContent = `${dateText} - ${meta.total} 张图片`
  }

  gallery.innerHTML = ''

  if (images.length === 0) {
    gallery.innerHTML = '<p class="empty">暂无图片，开始生成你的第一张图片吧！</p>'
    return
  }

  const fragment = document.createDocumentFragment()

  images.forEach(image => {
    const item = document.createElement('div')
    item.className = 'gallery-item'
    item.innerHTML = `
      <img src="${image.file_url}" alt="${escapeHtml(image.prompt)}" loading="lazy">
      <div class="overlay"></div>
      <div class="gallery-item-info">
        <span class="model-badge">${escapeHtml(image.model_name || image.model || 'Unknown')}</span>
      </div>
      <div class="gallery-item-actions">
        <button class="btn-icon visibility-btn" data-id="${image.id}" data-visible="${image.is_visible}" title="切换可见性">
          ${image.is_visible ? '👁️' : '👁️‍🗨️'}
        </button>
        <button class="btn-icon danger delete-btn" data-id="${image.id}" title="删除">
          🗑️
        </button>
      </div>
    `

    // 点击查看大图
    item.querySelector('img').addEventListener('click', () => {
      showImageDetail(image)
    })

    // 可见性切换
    item.querySelector('.visibility-btn').addEventListener('click', (e) => {
      e.stopPropagation()
      toggleVisibility(image.id, !image.is_visible)
    })

    // 删除
    item.querySelector('.delete-btn').addEventListener('click', (e) => {
      e.stopPropagation()
      deleteImage(image.id)
    })

    fragment.appendChild(item)
  })

  gallery.appendChild(fragment)
}

// 显示图片详情
function showImageDetail(image) {
  const params = []
  if (image.model_name) params.push(`模型: ${image.model_name}`)
  if (image.width && image.height) params.push(`尺寸: ${image.width}×${image.height}`)
  if (image.num_steps) params.push(`步数: ${image.num_steps}`)
  if (image.guidance) params.push(`引导: ${image.guidance}`)
  if (image.seed) params.push(`种子: ${image.seed}`)

  const info = params.length > 0 ? `\n\n${params.join(' | ')}` : ''
  const negative = image.negative_prompt ? `\n\n负面提示词: ${image.negative_prompt}` : ''

  alert(`提示词: ${image.prompt}${negative}${info}`)
}

// 切换可见性
async function toggleVisibility(id, isVisible) {
  try {
    const response = await fetch(`${API_BASE}/admin/images/${id}/visibility`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_visible: isVisible })
    })

    const result = await response.json()

    if (result.success) {
      loadAdminImages(currentPage)
    } else {
      alert(result.error || '操作失败')
    }
  } catch (error) {
    console.error('Toggle visibility failed:', error)
    alert('网络错误，请重试')
  }
}

// 删除图片
async function deleteImage(id) {
  if (!confirm('确定要删除这张图片吗？')) return

  try {
    const response = await fetch(`${API_BASE}/admin/images/${id}`, {
      method: 'DELETE'
    })

    const result = await response.json()

    if (result.success) {
      // 刷新日期列表和图片
      await loadAvailableDates()
      loadAdminImages(currentPage)
    } else {
      alert(result.error || '删除失败')
    }
  } catch (error) {
    console.error('Delete failed:', error)
    alert('网络错误，请重试')
  }
}

// 工具函数
function escapeHtml(text) {
  if (!text) return ''
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function formatDateShort(dateStr) {
  const date = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (dateStr === today.toISOString().split('T')[0]) {
    return '今天'
  } else if (dateStr === yesterday.toISOString().split('T')[0]) {
    return '昨天'
  } else {
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric'
    })
  }
}