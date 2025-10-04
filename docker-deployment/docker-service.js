const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

const app = express();
const PORT = process.env.PORT || 3002;

app.use(bodyParser.json());
app.use(express.static('public'));

const containers = {};

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Chrome VM Docker Service',
    timestamp: new Date().toISOString(),
    containers: Object.keys(containers).length
  });
});

// Create a real Docker container
app.post('/containers', async (req, res) => {
  try {
    const { name, image, ports, environment, resources } = req.body;
    const id = uuidv4();

    console.log(`Creating real Docker container: ${name} (${id})`);

    // Build the Docker run command
    const portMappings = Object.entries(ports || {})
      .map(([containerPort, hostPort]) => `-p ${hostPort}:${containerPort}`)
      .join(' ');

    const envVars = Object.entries(environment || {})
      .map(([key, value]) => `-e ${key}="${value}"`)
      .join(' ');

    // Use a real Chrome Docker image
    const dockerImage = image || 'browserless/chrome:latest';

    const dockerCommand = `docker run -d --name chrome-vm-${id} ${portMappings} ${envVars} ${dockerImage}`;

    console.log(`Executing: ${dockerCommand}`);

    try {
      const { stdout } = await execAsync(dockerCommand);
      const containerId = stdout.trim();

      console.log(`Container created with ID: ${containerId}`);

      // Get container info
      const { stdout: inspectOutput } = await execAsync(`docker inspect ${containerId}`);
      const containerInfo = JSON.parse(inspectOutput)[0];

      const publicIp = process.env.PUBLIC_IP || 'localhost';
      const novncPort = ports?.['6080'] || 6080;
      const agentPort = ports?.['3000'] || 3000;

      const newContainer = {
        id: containerId,
        name: `chrome-vm-${id}`,
        image: dockerImage,
        ports,
        environment,
        resources,
        status: 'running',
        publicIp,
        novncUrl: `http://${publicIp}:${novncPort}`,
        agentUrl: `http://${publicIp}:${agentPort}`,
        createdAt: new Date().toISOString(),
        containerId: containerId
      };

      containers[id] = newContainer;

      console.log(`✅ Real Docker container ${id} created successfully`);
      res.status(201).json(newContainer);

    } catch (dockerError) {
      console.error('Docker execution failed:', dockerError);

      // Fallback to simulation if Docker fails
      const fallbackContainer = {
        id: `sim-${id}`,
        name: `chrome-vm-${id}`,
        image: dockerImage,
        ports,
        environment,
        resources,
        status: 'simulated',
        publicIp: 'simulated-ip',
        novncUrl: `https://chrome-vm-workers.mgmt-5e1.workers.dev/vms/${id}/novnc`,
        agentUrl: `https://chrome-vm-workers.mgmt-5e1.workers.dev/vms/${id}/agent`,
        createdAt: new Date().toISOString(),
        containerId: `sim-${id}`,
        error: 'Docker not available, using simulation'
      };

      containers[id] = fallbackContainer;
      res.status(201).json(fallbackContainer);
    }

  } catch (error) {
    console.error('Error creating container:', error);
    res.status(500).json({ error: 'Failed to create container', details: error.message });
  }
});

// Get container info
app.get('/containers/:id', (req, res) => {
  const { id } = req.params;
  const container = containers[id];
  if (container) {
    res.json(container);
  } else {
    res.status(404).json({ error: 'Container not found' });
  }
});

// Delete container
app.delete('/containers/:id', async (req, res) => {
  const { id } = req.params;
  const container = containers[id];

  if (container) {
    try {
      if (container.containerId && !container.containerId.startsWith('sim-')) {
        await execAsync(`docker stop ${container.containerId}`);
        await execAsync(`docker rm ${container.containerId}`);
        console.log(`Real container ${container.containerId} stopped and removed`);
      }

      delete containers[id];
      console.log(`Container ${id} deleted`);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting container:', error);
      res.status(500).json({ error: 'Failed to delete container' });
    }
  } else {
    res.status(404).json({ error: 'Container not found' });
  }
});

// List all containers
app.get('/containers', (req, res) => {
  res.json(Object.values(containers));
});

app.listen(PORT, () => {
  console.log(`Chrome VM Docker Service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/`);
});
