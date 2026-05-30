-- calendar_events: each user's personal calendar
CREATE TABLE IF NOT EXISTS calendar_events (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  date        DATE NOT NULL,
  start_time  TIME,
  end_time    TIME,
  description TEXT,
  type        TEXT NOT NULL DEFAULT 'outro' CHECK (type IN ('reuniao','ligacao','tarefa','outro')),
  color       TEXT NOT NULL DEFAULT '#6366f1',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own events"
  ON calendar_events FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Profile: add avatar_url, phone, cargo
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone      TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cargo      TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS logo_url   TEXT;
