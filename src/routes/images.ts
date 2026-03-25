import { Hono } from 'hono'
import type { Env } from '../index'

const images = new Hono<{ Bindings: Env }>()

// 模型配置（用于显示名称）
const MODEL_NAMES: Record<string, string> = {
  '@cf/black-forest-labs/flux-1-schnell': 'Flux.1 Schnell',
  '@cf/stabilityai/stable-diffusion-xl-base-1.0': 'Stable Diffusion XL',
  '@cf/bytedance/stable-diffusion-xl-lightning': 'SDXL Lightning',
  '@cf/lykon/dreamshaper-8-lcm': 'DreamShaper 8 LCM'
}

// 获取公开图片列表
images.get('/', async (c) => {
  const page = parseInt(c.req.query('page') || '1')
  const limit = parseInt(c.req.query('limit') || '20')
  const offset = (page - 1) * limit
  const search = c.req.query('search')?.trim() || ''

  // 构建查询条件
  let whereClause = 'is_visible = 1'
  const params: (string | number)[] = []

  if (search) {
    whereClause += ' AND prompt LIKE ?'
    params.push(`%${search}%`)
  }

  const countResult = await c.env.DB.prepare(`
    SELECT COUNT(*) as total FROM images WHERE ${whereClause}
  `).bind(...params).first<{ total: number }>()

  const total = countResult?.total || 0

  params.push(limit, offset)
  const imagesList = await c.env.DB.prepare(`
    SELECT id, prompt, negative_prompt, file_key, file_url, width, height, model, num_steps, guidance, seed, created_at
    FROM images
    WHERE ${whereClause}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).bind(...params).all<{
    id: string
    prompt: string
    negative_prompt: string | null
    file_key: string
    file_url: string | null
    width: number
    height: number
    model: string | null
    num_steps: number | null
    guidance: number | null
    seed: number | null
    created_at: string
  }>()

  // 生成公开访问 URL
  const imagesWithUrl = imagesList.results.map(img => ({
    ...img,
    file_url: img.file_url || `/api/images/${img.id}/file`,
    model_name: img.model ? (MODEL_NAMES[img.model] || img.model) : null
  }))

  return c.json({
    success: true,
    data: imagesWithUrl,
    meta: { total, page, limit, search }
  })
})

// 获取单个图片信息
images.get('/:id', async (c) => {
  const id = c.req.param('id')

  const image = await c.env.DB.prepare(`
    SELECT id, prompt, negative_prompt, file_key, file_url, width, height, model, num_steps, guidance, seed, created_at
    FROM images
    WHERE id = ? AND is_visible = 1
  `).bind(id).first<{
    id: string
    prompt: string
    negative_prompt: string | null
    file_key: string
    file_url: string | null
    width: number
    height: number
    model: string | null
    num_steps: number | null
    guidance: number | null
    seed: number | null
    created_at: string
  }>()

  if (!image) {
    return c.json({ success: false, error: 'Image not found' }, 404)
  }

  return c.json({
    success: true,
    data: {
      ...image,
      file_url: image.file_url || `/api/images/${image.id}/file`,
      model_name: image.model ? (MODEL_NAMES[image.model] || image.model) : null
    }
  })
})

// 获取图片文件
images.get('/:id/file', async (c) => {
  const id = c.req.param('id')

  const image = await c.env.DB.prepare(`
    SELECT file_key FROM images WHERE id = ? AND is_visible = 1
  `).bind(id).first<{ file_key: string }>()

  if (!image) {
    return c.json({ success: false, error: 'Image not found' }, 404)
  }

  const object = await c.env.BUCKET.get(image.file_key)

  if (!object) {
    return c.json({ success: false, error: 'File not found' }, 404)
  }

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('etag', object.httpEtag)
  headers.set('Cache-Control', 'public, max-age=31536000')

  return new Response(object.body, { headers })
})

export default images