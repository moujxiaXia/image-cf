import { Hono } from 'hono'
import { setCookie, getCookie } from 'hono/cookie'
import { sign, verify } from 'hono/jwt'
import type { Env } from '../index'

const auth = new Hono<{ Bindings: Env }>()

// 登录
auth.post('/login', async (c) => {
  const { username, password } = await c.req.json<{ username: string; password: string }>()

  if (username === c.env.ADMIN_USERNAME && password === c.env.ADMIN_PASSWORD) {
    const token = await sign(
      { username, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 }, // 7天过期
      c.env.JWT_SECRET
    )

    setCookie(c, 'auth_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      maxAge: 60 * 60 * 24 * 7
    })

    return c.json({ success: true, data: { token } })
  }

  return c.json({ success: false, error: 'Invalid credentials' }, 401)
})

// 登出
auth.post('/logout', (c) => {
  setCookie(c, 'auth_token', '', { maxAge: 0 })
  return c.json({ success: true })
})

// 验证登录状态
auth.get('/verify', async (c) => {
  const token = getCookie(c, 'auth_token')

  if (!token) {
    return c.json({ success: false, error: 'Not authenticated' }, 401)
  }

  try {
    const payload = await verify(token, c.env.JWT_SECRET, 'HS256')
    return c.json({ success: true, data: { username: (payload as { username: string }).username } })
  } catch {
    return c.json({ success: false, error: 'Invalid token' }, 401)
  }
})

export default auth