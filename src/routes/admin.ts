import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { verify } from 'hono/jwt'
import type { Env } from '../index'

// 扩展 Hono 的 Context 类型
type Variables = {
  user: { username: string }
}

const admin = new Hono<{ Bindings: Env; Variables: Variables }>()

// 支持的模型配置
const SUPPORTED_MODELS = {
  '@cf/black-forest-labs/flux-1-schnell': {
    name: 'Flux.1 Schnell',
    maxSteps: 4,
    defaultSteps: 4,
    supportsNegativePrompt: false,
    supportsGuidance: true,
    defaultGuidance: 3.5,
    supportsImageInput: false
  },
  '@cf/black-forest-labs/flux-2-klein-9b': {
    name: 'Flux.2 Klein',
    maxSteps: 50,
    defaultSteps: 20,
    supportsNegativePrompt: true,
    supportsGuidance: true,
    defaultGuidance: 3.5,
    supportsImageInput: true
  },
  '@cf/stabilityai/stable-diffusion-xl-base-1.0': {
    name: 'Stable Diffusion XL',
    maxSteps: 50,
    defaultSteps: 20,
    supportsNegativePrompt: true,
    supportsGuidance: true,
    defaultGuidance: 7.5,
    supportsImageInput: false
  },
  '@cf/bytedance/stable-diffusion-xl-lightning': {
    name: 'SDXL Lightning',
    maxSteps: 8,
    defaultSteps: 4,
    supportsNegativePrompt: true,
    supportsGuidance: false,
    defaultGuidance: 0,
    supportsImageInput: false
  },
  '@cf/lykon/dreamshaper-8-lcm': {
    name: 'DreamShaper 8 LCM',
    maxSteps: 8,
    defaultSteps: 4,
    supportsNegativePrompt: true,
    supportsGuidance: false,
    defaultGuidance: 0,
    supportsImageInput: false
  }
} as const

type ModelId = keyof typeof SUPPORTED_MODELS

// 获取可用模型列表（无需认证）
admin.get('/models', (c) => {
  return c.json({
    success: true,
    data: Object.entries(SUPPORTED_MODELS).map(([id, config]) => ({
      id,
      name: config.name,
      maxSteps: config.maxSteps,
      defaultSteps: config.defaultSteps,
      supportsNegativePrompt: config.supportsNegativePrompt,
      supportsGuidance: config.supportsGuidance,
      defaultGuidance: config.defaultGuidance,
      supportsImageInput: config.supportsImageInput
    }))
  })
})

// 认证中间件
async function authMiddleware(c: any, next: any) {
  const token = getCookie(c, 'auth_token') || c.req.header('Authorization')?.replace('Bearer ', '')

  if (!token) {
    return c.json({ success: false, error: 'Unauthorized' }, 401)
  }

  try {
    const payload = await verify(token, c.env.JWT_SECRET, 'HS256') as { username: string }
    c.set('user', { username: payload.username })
    await next()
  } catch {
    return c.json({ success: false, error: 'Invalid token' }, 401)
  }
}

// 上传参考图片
admin.post('/upload-reference', authMiddleware, async (c) => {
  try {
    const formData = await c.req.formData()
    const fileEntry = formData.get('image')

    if (!fileEntry) {
      return c.json({ success: false, error: 'No image provided' }, 400)
    }

    // 检查是否为 File 对象
    if (typeof fileEntry === 'string') {
      return c.json({ success: false, error: 'Invalid image format' }, 400)
    }

    const file = fileEntry as File

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      return c.json({ success: false, error: 'Invalid file type' }, 400)
    }

    // 限制文件大小 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      return c.json({ success: false, error: 'File too large (max 10MB)' }, 400)
    }

    // 生成唯一 ID
    const id = crypto.randomUUID()
    const ext = file.name.split('.').pop() || 'png'
    const fileKey = `references/${id}.${ext}`

    // 上传到 R2
    const buffer = await file.arrayBuffer()
    await c.env.BUCKET.put(fileKey, buffer, {
      httpMetadata: { contentType: file.type }
    })

    return c.json({
      success: true,
      data: {
        id,
        file_key: fileKey
      }
    })
  } catch (error) {
    console.error('Upload error:', error)
    return c.json({
      success: false,
      error: 'Failed to upload image: ' + (error instanceof Error ? error.message : 'Unknown error')
    }, 500)
  }
})

// 获取所有图片（包括隐藏的）
admin.get('/images', authMiddleware, async (c) => {
  const page = parseInt(c.req.query('page') || '1')
  const limit = parseInt(c.req.query('limit') || '20')
  const offset = (page - 1) * limit
  const date = c.req.query('date')?.trim() || '' // 格式: YYYY-MM-DD

  // 构建查询条件
  let whereClause = '1=1'
  const params: (string | number)[] = []

  if (date) {
    whereClause += ' AND DATE(created_at) = ?'
    params.push(date)
  }

  const countResult = await c.env.DB.prepare(`
    SELECT COUNT(*) as total FROM images WHERE ${whereClause}
  `).bind(...params).first<{ total: number }>()

  const total = countResult?.total || 0

  params.push(limit, offset)
  const imagesList = await c.env.DB.prepare(`
    SELECT id, prompt, negative_prompt, file_key, file_url, width, height, model, num_steps, guidance, seed, is_visible, created_at, created_by
    FROM images
    WHERE ${whereClause}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).bind(...params).all()

  return c.json({
    success: true,
    data: imagesList.results.map((img: any) => ({
      ...img,
      file_url: img.file_url || `/api/images/${img.id}/file`,
      model_name: img.model ? (SUPPORTED_MODELS[img.model as ModelId]?.name || img.model) : 'Unknown'
    })),
    meta: { total, page, limit, date }
  })
})

// 获取可用日期列表
admin.get('/dates', authMiddleware, async (c) => {
  const result = await c.env.DB.prepare(`
    SELECT DATE(created_at) as date, COUNT(*) as count
    FROM images
    GROUP BY DATE(created_at)
    ORDER BY date DESC
    LIMIT 30
  `).all<{ date: string; count: number }>()

  return c.json({
    success: true,
    data: result.results
  })
})

// 生成图片
admin.post('/generate', authMiddleware, async (c) => {
  const body = await c.req.json<{
    prompt: string
    negative_prompt?: string
    size?: string
    model?: string
    num_steps?: number
    guidance?: number
    seed?: number
    reference_image_key?: string
  }>()

  const {
    prompt,
    negative_prompt,
    size = '1024x1024',
    model = '@cf/black-forest-labs/flux-1-schnell',
    num_steps,
    guidance,
    seed,
    reference_image_key
  } = body

  if (!prompt || prompt.trim().length === 0) {
    return c.json({ success: false, error: 'Prompt is required' }, 400)
  }

  // 验证模型
  const modelConfig = SUPPORTED_MODELS[model as ModelId]
  if (!modelConfig) {
    return c.json({ success: false, error: 'Invalid model' }, 400)
  }

  // 如果模型不支持图片输入但提供了参考图片，返回错误
  if (reference_image_key && !modelConfig.supportsImageInput) {
    return c.json({ success: false, error: 'This model does not support image input' }, 400)
  }

  const [width, height] = size.split('x').map(Number)

  // 使用模型默认值或用户指定值
  const steps = Math.min(num_steps || modelConfig.defaultSteps, modelConfig.maxSteps)
  const guidanceScale = guidance ?? modelConfig.defaultGuidance

  // 如果模型不支持负面提示词，则忽略
  const negativePrompt = modelConfig.supportsNegativePrompt ? negative_prompt : undefined

  try {
    // 构建请求参数
    const requestParams: Record<string, unknown> = {
      prompt: prompt.trim(),
      width,
      height,
      num_steps: steps
    }

    // 只有模型支持时才添加这些参数
    if (negativePrompt) {
      requestParams.negative_prompt = negativePrompt.trim()
    }
    if (modelConfig.supportsGuidance && guidanceScale > 0) {
      requestParams.guidance = guidanceScale
    }
    if (seed !== undefined) {
      requestParams.seed = seed
    }

    // 调用 AI 生成图片
    let aiResponse: unknown

    // Flux.2 Klein 始终需要 multipart 格式
    if (model === '@cf/black-forest-labs/flux-2-klein-9b') {
      const formData = new FormData()
      formData.append('prompt', prompt.trim())
      formData.append('width', String(width))
      formData.append('height', String(height))
      formData.append('num_steps', String(steps))
      if (negativePrompt) {
        formData.append('negative_prompt', negativePrompt.trim())
      }
      if (guidanceScale > 0) {
        formData.append('guidance', String(guidanceScale))
      }
      if (seed !== undefined) {
        formData.append('seed', String(seed))
      }

      // 如果有参考图片
      if (reference_image_key) {
        const refImage = await c.env.BUCKET.get(reference_image_key)
        if (refImage) {
          const refBuffer = await refImage.arrayBuffer()
          const imageBlob = new Blob([refBuffer], { type: 'image/png' })
          formData.append('image', imageBlob, 'reference.png')
        }
      }

      // FormData 需要通过 Response 序列化
      const formResponse = new Response(formData)
      const formStream = formResponse.body
      const formContentType = formResponse.headers.get('content-type')!

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      aiResponse = await (c.env.AI as any).run(model, {
        multipart: {
          body: formStream,
          contentType: formContentType
        }
      })
    } else {
      // 其他模型使用 JSON 格式
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      aiResponse = await (c.env.AI as any).run(model, requestParams)
    }

    const response = aiResponse

    // 生成唯一 ID
    const id = crypto.randomUUID()
    const fileKey = `images/${id}.png`

    // 处理响应 - AI 返回的是二进制数据
    let imageBuffer: ArrayBuffer

    if (response instanceof ReadableStream) {
      imageBuffer = await new Response(response).arrayBuffer() as ArrayBuffer
    } else if (response instanceof ArrayBuffer) {
      imageBuffer = response
    } else if (response instanceof Uint8Array) {
      imageBuffer = response.buffer as ArrayBuffer
    } else if (response && typeof response === 'object' && 'image' in response) {
      // 某些模型可能返回 { image: "base64..." } 格式
      const base64Data = (response as { image: string }).image
      imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0)).buffer as ArrayBuffer
    } else {
      // 如果是 base64 或其他格式
      const responseText = typeof response === 'string' ? response : JSON.stringify(response)
      imageBuffer = new TextEncoder().encode(responseText).buffer as ArrayBuffer
    }

    // 上传到 R2
    await c.env.BUCKET.put(fileKey, imageBuffer, {
      httpMetadata: { contentType: 'image/png' }
    })

    // 保存元数据到 D1
    const user = c.get('user') as { username: string } | undefined
    await c.env.DB.prepare(`
      INSERT INTO images (id, prompt, negative_prompt, file_key, width, height, model, num_steps, guidance, seed, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      prompt.trim(),
      negativePrompt?.trim() || null,
      fileKey,
      width,
      height,
      model,
      steps,
      guidanceScale,
      seed ?? null,
      user?.username || 'admin'
    ).run()

    return c.json({
      success: true,
      data: {
        id,
        prompt: prompt.trim(),
        negative_prompt: negativePrompt?.trim(),
        file_url: `/api/images/${id}/file`,
        width,
        height,
        model,
        model_name: modelConfig.name,
        num_steps: steps,
        guidance: guidanceScale,
        seed
      }
    })
  } catch (error) {
    console.error('Generate error:', error)
    return c.json({
      success: false,
      error: 'Failed to generate image: ' + (error instanceof Error ? error.message : 'Unknown error')
    }, 500)
  }
})

// 切换图片可见性
admin.patch('/images/:id/visibility', authMiddleware, async (c) => {
  const id = c.req.param('id')
  const { is_visible } = await c.req.json<{ is_visible: boolean }>()

  const result = await c.env.DB.prepare(`
    UPDATE images SET is_visible = ? WHERE id = ?
  `).bind(is_visible ? 1 : 0, id).run()

  if (result.meta.changes === 0) {
    return c.json({ success: false, error: 'Image not found' }, 404)
  }

  return c.json({ success: true })
})

// 删除图片
admin.delete('/images/:id', authMiddleware, async (c) => {
  const id = c.req.param('id')

  // 获取文件信息
  const image = await c.env.DB.prepare(`
    SELECT file_key FROM images WHERE id = ?
  `).bind(id).first<{ file_key: string }>()

  if (!image) {
    return c.json({ success: false, error: 'Image not found' }, 404)
  }

  // 删除 R2 文件
  await c.env.BUCKET.delete(image.file_key)

  // 删除数据库记录
  await c.env.DB.prepare(`
    DELETE FROM images WHERE id = ?
  `).bind(id).run()

  return c.json({ success: true })
})

export default admin