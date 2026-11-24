CREATE TABLE IF NOT EXISTS app_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Databases that already hold data were seeded (or populated) before this
-- marker existed; never seed them again.
INSERT OR IGNORE INTO app_meta (key, value)
SELECT 'seeded', '1'
WHERE EXISTS (SELECT 1 FROM lists) OR EXISTS (SELECT 1 FROM todos);
