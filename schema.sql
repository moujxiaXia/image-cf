-- 图片表
CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY,
  prompt TEXT NOT NULL,
  negative_prompt TEXT,
  file_key TEXT NOT NULL,
  file_url TEXT,
  width INTEGER DEFAULT 1024,
  height INTEGER DEFAULT 1024,
  model TEXT DEFAULT '@cf/black-forest-labs/flux-1-schnell',
  num_steps INTEGER DEFAULT 4,
  guidance REAL DEFAULT 3.5,
  seed INTEGER,
  is_visible INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  created_by TEXT DEFAULT 'admin'
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_images_created_at ON images(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_images_is_visible ON images(is_visible);

-- 用户会话表（可选，用于多设备管理）
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);