-- Chrome VM Database Schema
CREATE TABLE IF NOT EXISTS vms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'initializing',
  container_id TEXT,
  novnc_url TEXT,
  agent_url TEXT,
  origin_agent_url TEXT,
  origin_novnc_url TEXT,
  public_ip TEXT,
  chrome_version TEXT,
  node_version TEXT,
  created_at TEXT NOT NULL,
  last_activity TEXT,
  metadata TEXT, -- JSON string
  instance_type TEXT,
  memory TEXT,
  cpu TEXT,
  storage TEXT,
  network TEXT, -- JSON string
  server_id TEXT,
  server_name TEXT,
  region TEXT,
  created_via TEXT,
  error TEXT
);

CREATE TABLE IF NOT EXISTS vm_scripts (
  id TEXT PRIMARY KEY,
  vm_id TEXT NOT NULL,
  script_name TEXT NOT NULL,
  script_content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, running, completed, failed
  result TEXT,
  created_at TEXT NOT NULL,
  executed_at TEXT,
  FOREIGN KEY (vm_id) REFERENCES vms(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS vm_metrics (
  id TEXT PRIMARY KEY,
  vm_id TEXT NOT NULL,
  metric_type TEXT NOT NULL, -- cpu, memory, storage, network
  value REAL NOT NULL,
  unit TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  FOREIGN KEY (vm_id) REFERENCES vms(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS vm_events (
  id TEXT PRIMARY KEY,
  vm_id TEXT NOT NULL,
  event_type TEXT NOT NULL, -- created, started, stopped, error, script_executed
  event_data TEXT, -- JSON string
  timestamp TEXT NOT NULL,
  FOREIGN KEY (vm_id) REFERENCES vms(id) ON DELETE CASCADE
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_vms_status ON vms(status);
CREATE INDEX IF NOT EXISTS idx_vms_server_id ON vms(server_id);
CREATE INDEX IF NOT EXISTS idx_vms_created_at ON vms(created_at);
CREATE INDEX IF NOT EXISTS idx_vm_scripts_vm_id ON vm_scripts(vm_id);
CREATE INDEX IF NOT EXISTS idx_vm_scripts_status ON vm_scripts(status);
CREATE INDEX IF NOT EXISTS idx_vm_metrics_vm_id ON vm_metrics(vm_id);
CREATE INDEX IF NOT EXISTS idx_vm_metrics_timestamp ON vm_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_vm_events_vm_id ON vm_events(vm_id);
CREATE INDEX IF NOT EXISTS idx_vm_events_timestamp ON vm_events(timestamp);
