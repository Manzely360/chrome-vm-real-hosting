const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

// Store running containers
const containers = new Map();

// Create a new container
app.post('/containers', async (req, res) => {
  try {
    const { name, image, ports, environment, resources } = req.body;

    console.log(`Creating container: ${name}`);

    // Generate a unique container ID
    const containerId = `container-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create container directory
    const containerDir = path.join(__dirname, 'containers', containerId);
    fs.mkdirSync(containerDir, { recursive: true });

    // Create docker-compose.yml for the container
    const dockerCompose = `
version: '3.8'
services:
  chrome-vm:
    image: ${image || 'selenium/standalone-chrome:latest'}
    container_name: ${name}
    ports:
      - "${ports['6080'] || 6080}:6080"  # NoVNC
      - "${ports['3000'] || 3000}:3000"  # Agent
    environment:
      - DISPLAY=:99
      - VM_ID=${environment.VM_ID}
      - VM_NAME=${environment.VM_NAME}
      - CHROME_VERSION=${environment.CHROME_VERSION}
      - NODE_VERSION=${environment.NODE_VERSION}
    volumes:
      - ./data:/data
    deploy:
      resources:
        limits:
          memory: ${resources.memory || '2GB'}
          cpus: '${resources.cpu || '1'}'
    restart: unless-stopped
`;

    fs.writeFileSync(path.join(containerDir, 'docker-compose.yml'), dockerCompose);

    // Start the container
    const dockerProcess = spawn('docker-compose', ['up', '-d'], {
      cwd: containerDir,
      stdio: 'pipe'
    });

    let output = '';
    dockerProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    dockerProcess.stderr.on('data', (data) => {
      output += data.toString();
    });

    dockerProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`Container ${name} started successfully`);

        // Store container info
        containers.set(containerId, {
          id: containerId,
          name: name,
          status: 'running',
          agentUrl: `http://localhost:${ports['3000'] || 3000}`,
          novncUrl: `http://localhost:${ports['6080'] || 6080}`,
          publicIp: 'localhost',
          createdAt: new Date().toISOString()
        });

        res.json({
          id: containerId,
          name: name,
          status: 'running',
          agentUrl: `http://localhost:${ports['3000'] || 3000}`,
          novncUrl: `http://localhost:${ports['6080'] || 6080}`,
          publicIp: 'localhost'
        });
      } else {
        console.error(`Failed to start container ${name}:`, output);
        res.status(500).json({ error: 'Failed to start container', details: output });
      }
    });

  } catch (error) {
    console.error('Error creating container:', error);
    res.status(500).json({ error: 'Failed to create container', details: error.message });
  }
});

// Get container status
app.get('/containers/:id', (req, res) => {
  const container = containers.get(req.params.id);
  if (container) {
    res.json(container);
  } else {
    res.status(404).json({ error: 'Container not found' });
  }
});

// List all containers
app.get('/containers', (req, res) => {
  res.json(Array.from(containers.values()));
});

// Stop container
app.delete('/containers/:id', (req, res) => {
  const container = containers.get(req.params.id);
  if (container) {
    // Stop the container
    const stopProcess = spawn('docker', ['stop', container.name], { stdio: 'pipe' });
    stopProcess.on('close', (code) => {
      containers.delete(req.params.id);
      res.json({ message: 'Container stopped', id: req.params.id });
    });
  } else {
    res.status(404).json({ error: 'Container not found' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    containers: containers.size,
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Docker service running on port ${PORT}`);
});
