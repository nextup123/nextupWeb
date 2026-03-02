// utils/ros2Manager.js
// Shared ROS2 context and node management

const rclnodejs = require('rclnodejs');

class ROS2Manager {
  constructor() {
    this.initialized = false;
    this.nodes = new Map();
    this.publishers = new Map();
    this.subscribers = new Map();
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      await rclnodejs.init();
      this.initialized = true;
      console.log('ROS2 context initialized');
    } catch (err) {
      console.error('Failed to initialize ROS2:', err.message);
      throw err;
    }
  }

  async createNode(nodeName) {
    await this.initialize();
    
    if (this.nodes.has(nodeName)) {
      return this.nodes.get(nodeName);
    }
    
    const node = rclnodejs.createNode(nodeName);
    this.nodes.set(nodeName, node);
    
    // Spin the node
    rclnodejs.spin(node);
    
    console.log(`ROS2 node '${nodeName}' created`);
    return node;
  }

  getNode(nodeName) {
    return this.nodes.get(nodeName);
  }

  async createPublisher(nodeName, topic, messageType) {
    const node = await this.createNode(nodeName);
    
    const key = `${nodeName}:${topic}`;
    if (this.publishers.has(key)) {
      return this.publishers.get(key);
    }
    
    const publisher = node.createPublisher(messageType, topic);
    this.publishers.set(key, publisher);
    
    console.log(`Publisher created: ${topic} on node ${nodeName}`);
    return publisher;
  }

  async createSubscription(nodeName, topic, messageType, callback) {
    const node = await this.createNode(nodeName);
    
    const key = `${nodeName}:${topic}`;
    if (this.subscribers.has(key)) {
      // console.warn(`Subscription already exists for ${topic} on node ${nodeName}`);
      return;
    }
    
    const subscription = node.createSubscription(messageType, topic, callback);
    this.subscribers.set(key, subscription);
    
    console.log(`Subscription created: ${topic} on node ${nodeName}`);
    return subscription;
  }

  async shutdown() {
    if (!this.initialized) {
      return;
    }

    try {
      // Destroy all nodes
      for (const [name, node] of this.nodes) {
        try {
          node.destroy();
        } catch (e) {
          console.error(`Error destroying node ${name}:`, e.message);
        }
      }
      
      this.nodes.clear();
      this.publishers.clear();
      this.subscribers.clear();
      
      await rclnodejs.shutdown();
      this.initialized = false;
      console.log('ROS2 context shutdown complete');
    } catch (err) {
      console.error('Error during ROS2 shutdown:', err.message);
      throw err;
    }
  }
}

// Singleton instance
const ros2Manager = new ROS2Manager();

// Graceful shutdown on process termination
process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down ROS2...');
  await ros2Manager.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down ROS2...');
  await ros2Manager.shutdown();
  process.exit(0);
});

module.exports = ros2Manager;