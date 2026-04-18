-- 在 Supabase SQL Editor 執行這個檔案來建立資料表

-- 儲存所有 app 資料（病人、套餐、常規範本、勾選狀態）
CREATE TABLE IF NOT EXISTS nursing_data (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 讓任何人都可以讀寫（因為是內部護理用途，不需要登入）
ALTER TABLE nursing_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all" ON nursing_data
  FOR ALL USING (true) WITH CHECK (true);
