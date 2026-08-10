CREATE TABLE progress (
  project_id INTEGER PRIMARY KEY,
  percent INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE project_order (
  project_id INTEGER PRIMARY KEY,
  position INTEGER NOT NULL
);
