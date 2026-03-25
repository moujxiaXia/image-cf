// Gallery App
const API_BASE = '/api'

let currentPage = 1
let isLoading = false
let hasMore = true
let currentSearch = ''

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  loadImages()
  setupInfiniteScroll()
  setupModal()
  setupSearch()
})

// 设置搜索
function setupSearch() {
  const searchInput = document.getElementById('search-input')
  const searchBtn = document.getElementById('search-btn')
  const clearBtn = document.getElementById('clear-search')

  // 搜索按钮
  searchBtn.addEventListener('click', () => {
    performSearch()
  })

  // 回车搜索
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      performSearch()
    }
  })

  // 清除搜索
  clearBtn.addEventListener('click', () => {
    searchInput.value = ''
    currentSearch = ''
    resetGallery()
    loadImages()
  })
}

// 执行搜索
function performSearch() {
  const searchInput = document.getElementById('search-input')
  const newSearch = searchInput.value.trim()

  if (newSearch !== currentSearch) {
    currentSearch = newSearch
    resetGallery()
    loadImages()
  }
}

// 重置 Gallery
function resetGallery() {
  currentPage = 1
  hasMore = true
  document.getElementById('gallery').innerHTML = ''
}

// 加载图片
async function loadImages(page = 1) {
  if (isLoading || !hasMore) return

  isLoading = true
  showLoader()

  try {
    let url = `${API_BASE}/images?page=${page}&limit=20`
    if (currentSearch) {
      url += `&search=${encodeURIComponent(currentSearch)}`
    }

    const response = await fetch(url)
    const result = await response.json()

    if (result.success) {
      // 更新搜索状态显示
      updateSearchStatus(result.meta.search, result.meta.total)

      renderImages(result.data)

      if (result.data.length === 0 || result.data.length < 20) {
        hasMore = false
      }

      currentPage = page
    }
  } catch (error) {
    console.error('Failed to load images:', error)
    showError('加载图片失败，请刷新重试')
  } finally {
    isLoading = false
    hideLoader()
  }
}

// 更新搜索状态
function updateSearchStatus(search, total) {
  const statusEl = document.getElementById('search-status')
  const countEl = document.getElementById('image-count')

  if (search) {
    statusEl.textContent = `搜索 "${search}" 的结果`
    statusEl.classList.remove('hidden')
  } else {
    statusEl.classList.add('hidden')
  }

  countEl.textContent = `共 ${total} 张图片`
}

// 渲染图片
function renderImages(images) {
  const gallery = document.getElementById('gallery')
  const empty = document.getElementById('empty')

  if (images.length === 0 && currentPage === 1) {
    empty.classList.remove('hidden')
    return
  }

  empty.classList.add('hidden')

  const fragment = document.createDocumentFragment()

  images.forEach(image => {
    const item = document.createElement('div')
    item.className = 'gallery-item'
    item.innerHTML = `
      <img src="${image.file_url}" alt="${escapeHtml(image.prompt)}" loading="lazy">
      <div class="overlay"></div>
    `
    item.addEventListener('click', () => openModal(image))
    fragment.appendChild(item)
  })

  gallery.appendChild(fragment)
}

// 无限滚动
function setupInfiniteScroll() {
  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && hasMore && !isLoading) {
      loadImages(currentPage + 1)
    }
  }, { rootMargin: '100px' })

  const loader = document.getElementById('loader')
  observer.observe(loader)
}

// 模态框
function setupModal() {
  const modal = document.getElementById('modal')
  const backdrop = modal.querySelector('.modal-backdrop')
  const closeBtn = modal.querySelector('.modal-close')

  backdrop.addEventListener('click', closeModal)
  closeBtn.addEventListener('click', closeModal)

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal()
  })
}

function openModal(image) {
  const modal = document.getElementById('modal')
  const modalImage = document.getElementById('modal-image')
  const modalPrompt = document.getElementById('modal-prompt')
  const modalDate = document.getElementById('modal-date')

  modalImage.src = image.file_url
  modalImage.alt = image.prompt

  // 构建提示词信息
  let promptInfo = image.prompt

  // 添加模型和参数信息
  const params = []
  if (image.model_name) params.push(image.model_name)
  if (image.width && image.height) params.push(`${image.width}×${image.height}`)
  if (image.num_steps) params.push(`${image.num_steps} 步`)
  if (image.guidance) params.push(`引导 ${image.guidance}`)

  if (params.length > 0) {
    promptInfo += `\n\n${params.join(' | ')}`
  }

  modalPrompt.textContent = promptInfo
  modalDate.textContent = formatDate(image.created_at)

  modal.classList.remove('hidden')
  document.body.style.overflow = 'hidden'
}

function closeModal() {
  const modal = document.getElementById('modal')
  modal.classList.add('hidden')
  document.body.style.overflow = ''
}

// 工具函数
function showLoader() {
  document.getElementById('loader').classList.remove('hidden')
}

function hideLoader() {
  document.getElementById('loader').classList.add('hidden')
}

function showError(message) {
  // 简单的错误提示
  alert(message)
}

function escapeHtml(text) {
  if (!text) return ''
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function formatDate(dateStr) {
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}