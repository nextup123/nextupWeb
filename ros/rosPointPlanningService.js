// service/rosPointPlanningService.js

import rclnodejs from 'rclnodejs';

// Store latest robot status
let latestRobotStatus = {
    jointValues: [0, 0, 0, 0, 0, 0],
    cartesianValues: [0, 0, 0, 0, 0, 0],
    timestamp: Date.now()
};

let currentMotionType = 'cartesian';
let rosNodeInstance = null;

// Initialize ROS subscriptions for point planning
export function initPointPlanningROS(rosNode, wsServer) {
    if (!rosNode || !rosNode.node) {
        console.warn('ROS Node not ready, will retry later');
        return;
    }
    
    rosNodeInstance = rosNode;
    
    try {
        // Subscribe to joint_values topic
        rosNode.node.createSubscription(
            'std_msgs/msg/Float64MultiArray',
            '/joint_values',
            (msg) => {
                if (msg.data && msg.data.length >= 6) {
                    latestRobotStatus.jointValues = msg.data;
                    latestRobotStatus.timestamp = Date.now();
                    
                    if (wsServer) {
                        wsServer.broadcast({
                            type: 'JOINT_VALUES',
                            payload: { values: msg.data }
                        });
                    }
                }
            }
        );
        
        // Subscribe to cartesian_values topic
        rosNode.node.createSubscription(
            'std_msgs/msg/Float64MultiArray',
            '/cartesian_values',
            (msg) => {
                if (msg.data && msg.data.length >= 6) {
                    latestRobotStatus.cartesianValues = msg.data;
                    latestRobotStatus.timestamp = Date.now();
                    
                    if (wsServer) {
                        wsServer.broadcast({
                            type: 'CARTESIAN_VALUES',
                            payload: { values: msg.data }
                        });
                    }
                }
            }
        );
        
        console.log('Point planning ROS subscriptions initialized');
    } catch (err) {
        console.error('Failed to initialize point planning ROS subscriptions:', err);
    }
}

// Publish command to /ui_commands topic
export function publishToUICommand(command) {
    try {
        if (!rosNodeInstance || !rosNodeInstance.uiCommandPublisher) {
            console.error('ROS UI command publisher not available');
            return false;
        }
        
        const StringMsg = rclnodejs.require('std_msgs/msg/String');
        
        const msg = new StringMsg();
        msg.data = command;
        
        rosNodeInstance.uiCommandPublisher.publish(msg);
        console.log(`Published to /ui_commands: ${command}`);
        return true;
    } catch (err) {
        console.error('Failed to publish to UI command:', err);
        return false;
    }
}

// Publish edited point notification
export function publishEditedPoint(pointName) {
    try {
        if (!rosNodeInstance || !rosNodeInstance.editedPointPublisher) {
            console.error('ROS edited point publisher not available');
            return false;
        }
        
        const StringMsg = rclnodejs.require('std_msgs/msg/String');
        
        const msg = new StringMsg();
        msg.data = pointName;
        
        rosNodeInstance.editedPointPublisher.publish(msg);
        console.log(`Published edited point: ${pointName}`);
        return true;
    } catch (err) {
        console.error('Failed to publish edited point:', err);
        return false;
    }
}

// Get latest robot status
export function getLatestRobotStatus() {
    return latestRobotStatus;
}

// Set motion type
export function setMotionType(type) {
    currentMotionType = type;
    console.log(`Motion type set to: ${type}`);
}

// Get current motion type
export function getCurrentMotionType() {
    return currentMotionType;
}