# AI Image Gallery

基于 Cloudflare Workers 的 AI 图片生成应用，使用 Cloudflare AI 模型生成图片。

## 功能

- **公开画廊**: 浏览 AI 生成的图片
- **Admin 管理**: 登录后可生成新图片、管理现有图片
- **Instagram 风格 UI**: 简洁美观的图片展示

## 技术栈

- **运行时**: Cloudflare Workers
- **AI 模型**: `@cf/black-forest-labs/flux-1-schnell`
- **框架**: Hono
- **存储**: Cloudflare R2
- **数据库**: Cloudflare D1

## 部署步骤

### 1. 安装依赖

```bash
npm install
```

### 2. 创建 D1 数据库

```bash
# 创建数据库
wrangler d1 create image-cf-db

# 复制返回的 database_id 到 wrangler.toml 中
```

### 3. 创建 R2 存储桶

```bash
wrangler r2 bucket create image-cf-bucket
```

### 4. 初始化数据库表

```bash
# 本地开发
npm run db:init

# 生产环境
npm run db:migrate
```

### 5. 配置环境变量

编辑 `wrangler.toml`，修改以下配置：

```toml
[vars]
JWT_SECRET = "your-secret-key"  # 建议使用强随机字符串
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "your-password"  # 请修改为安全密码
```

### 6. 本地开发

```bash
npm run dev
```

### 7. 部署到 Cloudflare

```bash
npm run deploy
```

## API 接口

### 公开接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/images` | 获取图片列表 |
| GET | `/api/images/:id` | 获取单张图片信息 |
| GET | `/api/images/:id/file` | 获取图片文件 |

### 认证接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 登录 |
| POST | `/api/auth/logout` | 登出 |
| GET | `/api/auth/verify` | 验证登录状态 |

### Admin 接口（需认证）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/images` | 获取所有图片 |
| POST | `/api/admin/generate` | 生成新图片 |
| PATCH | `/api/admin/images/:id/visibility` | 切换可见性 |
| DELETE | `/api/admin/images/:id` | 删除图片 |

## 使用说明

1. 访问 `/admin` 进入管理页面
2. 使用配置的用户名密码登录
3. 输入提示词生成图片
4. 在首页查看生成的图片

## 注意事项

- 请确保修改默认密码
- JWT_SECRET 建议使用强随机字符串
- 图片生成可能需要几秒钟时间