# AI Image Gallery

基于 Cloudflare Workers 的 AI 图片生成应用，支持多种 AI 模型，可上传参考图片进行风格迁移。

## 功能特性

### 多模型支持

| 模型 | 名称 | 特点 | 图片输入 |
|------|------|------|----------|
| `@cf/black-forest-labs/flux-1-schnell` | Flux.1 Schnell | 快速生成，4步即可 | ❌ |
| `@cf/black-forest-labs/flux-2-klein-9b` | Flux.2 Klein | 高质量，支持参考图片 | ✅ |
| `@cf/stabilityai/stable-diffusion-xl-base-1.0` | Stable Diffusion XL | 经典模型 | ❌ |
| `@cf/bytedance/stable-diffusion-xl-lightning` | SDXL Lightning | 快速版 SDXL | ❌ |
| `@cf/lykon/dreamshaper-8-lcm` | DreamShaper 8 LCM | 艺术风格 | ❌ |

### 核心功能

- **多模型选择** - 5 种 AI 图片生成模型可选
- **高级参数** - 负面提示词、步数、引导系数、种子
- **参考图片** - Flux.2 Klein 支持上传参考图片进行风格迁移
- **图片搜索** - 按提示词搜索图片
- **日期筛选** - Admin 按日期查看生成记录
- **公开画廊** - 浏览所有可见图片
- **权限管理** - Admin 可控制图片可见性

### 界面预览

- **首页 Gallery**: Instagram 风格的图片瀑布流展示
- **Admin 面板**: 图片生成 + 管理界面

## 技术栈

- **运行时**: Cloudflare Workers
- **框架**: Hono
- **AI**: Cloudflare Workers AI
- **存储**: Cloudflare R2
- **数据库**: Cloudflare D1 (SQLite)
- **认证**: JWT

## 部署步骤

### 1. 克隆项目

```bash
git clone git@github.com:moujxiaXia/image-cf.git
cd image-cf
npm install
```

### 2. 创建 D1 数据库

```bash
wrangler d1 create image-cf-db
# 复制返回的 database_id 到 wrangler.toml 中
```

### 3. 创建 R2 存储桶

```bash
wrangler r2 bucket create image-cf-bucket
```

### 4. 初始化数据库

```bash
# 本地开发
wrangler d1 execute image-cf-db --local --file=./schema.sql

# 生产环境
wrangler d1 execute image-cf-db --remote --file=./schema.sql
```

### 5. 配置 Secrets

```bash
# 本地开发 - 创建 .dev.vars 文件
cat > .dev.vars << EOF
JWT_SECRET=your-jwt-secret-key
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password
EOF

# 生产环境 - 设置 Cloudflare Secrets
echo "your-jwt-secret-key" | wrangler secret put JWT_SECRET
echo "admin" | wrangler secret put ADMIN_USERNAME
echo "your-secure-password" | wrangler secret put ADMIN_PASSWORD
```

### 6. 部署

```bash
# 本地开发
npm run dev

# 部署到 Cloudflare
npm run deploy
```

## API 接口

### 公开接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 首页 Gallery |
| GET | `/admin` | Admin 登录页面 |
| GET | `/api/images` | 获取图片列表 (支持 `?search=keyword` 搜索) |
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
| GET | `/api/admin/models` | 获取可用模型列表 |
| GET | `/api/admin/images` | 获取所有图片 (支持 `?date=YYYY-MM-DD` 筛选) |
| GET | `/api/admin/dates` | 获取有图片的日期列表 |
| POST | `/api/admin/generate` | 生成新图片 |
| POST | `/api/admin/upload-reference` | 上传参考图片 |
| PATCH | `/api/admin/images/:id/visibility` | 切换可见性 |
| DELETE | `/api/admin/images/:id` | 删除图片 |

## 使用说明

### 基本使用

1. 访问 `/admin` 进入管理页面
2. 使用配置的用户名密码登录
3. 选择模型，输入提示词
4. 点击 Generate 生成图片
5. 在首页查看生成的图片

### 高级选项

- **负面提示词**: 指定不想在图片中出现的内容
- **步数**: 生成迭代次数 (更多步数 = 更高质量 = 更长时间)
- **引导系数**: 控制生成结果与提示词的匹配程度
- **种子**: 固定种子可复现相同结果

### 使用参考图片

1. 选择 **Flux.2 Klein 🖼️** 模型
2. 展开高级选项
3. 上传参考图片
4. 输入提示词描述想要的风格变化
5. 点击 Generate

## 项目结构

```
image-cf/
├── src/
│   ├── index.ts          # 主入口，HTML 页面
│   └── routes/
│       ├── admin.ts      # Admin API
│       ├── auth.ts       # 认证 API
│       └── images.ts     # 图片 API
├── public/
│   ├── app.js            # Gallery 前端
│   ├── admin.js          # Admin 前端
│   └── style.css         # 样式
├── schema.sql            # 数据库结构
├── wrangler.toml         # Cloudflare 配置
├── .dev.vars             # 本地环境变量 (不提交)
└── .env                  # API Token (不提交)
```

## 注意事项

- 请务必修改默认密码
- `JWT_SECRET` 建议使用 32 位以上随机字符串
- 图片生成可能需要 5-30 秒，取决于模型和参数
- 参考图片最大 10MB
- R2 存储会产生费用，注意监控用量

## License

MIT