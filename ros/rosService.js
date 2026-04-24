//backend - rosService.js

import rclnodejs from "rclnodejs";

let rosNodeInstance = null;
let lastCycleTime = null;

import fs from "fs";
import { LOGS_JSON_FILE } from "../config/path.js";
import { saveLogMessage } from "./rosHelper.js";

const LOG_FILE = LOGS_JSON_FILE;

function initLogFile() {
  if (!fs.existsSync(LOG_FILE)) {
    const initialData = { error: [], success: [], warn: [] };
    fs.writeFileSync(LOG_FILE, JSON.stringify(initialData, null, 2));
  }
}

class ROSService {
  constructor() {
    this.node = null;
    this.initialized = false;

    // Existing publishers
    this.movePublisher = null;
    this.startServoClient = null;
    this.uiCommandPublisher = null;
    this.editedPointPublisher = null;
    this.motionCommandPublisher = null;
    this.motionStartPublisher = null;
    this.autoGenerateXMLPublisher = null;
    this.autoGenerateSequencePublisher = null;
    this.logsPublisher = null;
    this.emergencyPublisher = null;
    this.resetPublisher = null;
    this.doPublishers = {};


    // New publishers
    this.changeModePublisher = null;
    this.controlStartPublisher = null;
    this.controlResetPublisher = null;
    this.processControlPublisher = null;
    this.speedScalePublisher = null;
    this.cncSelectionPublisher = null;
    this.framePublisher = null;

    this.lastDIBroadcast = 0;
    this.doStateCache = {};
  }

  async init(wsServer) {
    if (this.initialized) return;

    await rclnodejs.init();
    this.node = new rclnodejs.Node("web_backend_node");

    initLogFile();

    // ── PUBLISHERS ──────────────────────────────────────────────

    this.movePublisher = this.node.createPublisher(
      "geometry_msgs/msg/Twist",
      "/cmd_vel"
    );

    this.uiCommandPublisher = this.node.createPublisher(
      "std_msgs/msg/String",
      "/ui_commands"
    );

    this.framePublisher = this.node.createPublisher('std_msgs/msg/String', '/frame_mode');

    this.editedPointPublisher = this.node.createPublisher(
      "std_msgs/msg/String",
      "/edited_point_name"
    );

    this.emergencyPublisher = this.node.createPublisher(
      "nextup_joint_interfaces/msg/NextupEmergencyTrigger",
      "/nextup_emergency_trigger_controller/commands"
    );

    this.resetPublisher = this.node.createPublisher(
      "std_msgs/msg/Bool",
      "/reset_fault"
    );

    this.motionCommandPublisher = this.node.createPublisher(
      "std_msgs/msg/String",
      "/control_process_motion_bt"
    );

    this.motionStartPublisher = this.node.createPublisher(
      "std_msgs/msg/Bool",
      "/motion_start_bt"
    );

    this.autoGenerateXMLPublisher = this.node.createPublisher(
      "std_msgs/msg/Bool",
      "/auto_generate_xml"
    );

    this.autoGenerateSequencePublisher = this.node.createPublisher(
      "std_msgs/msg/String",
      "/auto_plan_sequence"
    );

    this.logsPublisher = this.node.createPublisher(
      "std_msgs/msg/String",
      "/logs_topic"
    );

    this.changeModePublisher = this.node.createPublisher(
      "std_msgs/msg/String",
      "/change_mode"
    );

    this.controlStartPublisher = this.node.createPublisher(
      "std_msgs/msg/Bool",
      "/control_start_bt"
    );

    this.controlResetPublisher = this.node.createPublisher(
      "std_msgs/msg/Bool",
      "/control_reset_bt"
    );

    this.processControlPublisher = this.node.createPublisher(
      "std_msgs/msg/String",
      "/control_process_control_bt"
    );

    this.speedScalePublisher = this.node.createPublisher(
      "std_msgs/msg/Float64",
      "/dynamic_speed_scale"
    );

    this.cncSelectionPublisher = this.node.createPublisher(
      "std_msgs/msg/String",
      "/select_cnc"
    );

    // ── SERVICE CLIENT ───────────────────────────────────────────

    this.startServoClient = this.node.createClient(
      "std_srvs/srv/Trigger",
      "/servo_node/start_servo"
    );
    this.monitoringStartClient = this.node.createClient(
      "std_srvs/srv/Trigger",
      "/monitoring_start"
    );

    this.monitoringStopClient = this.node.createClient(
      "std_srvs/srv/Trigger",
      "/monitoring_stop"
    );
    // ── SUBSCRIPTIONS ────────────────────────────────────────────

    this.node.createSubscription(
      "std_msgs/msg/Int32",
      "/cycle_count",
      (msg) => {
        const now = Date.now();
        let delta = null;
        if (lastCycleTime !== null) {
          delta = (now - lastCycleTime) / 1000;
        }
        lastCycleTime = now;
        wsServer.broadcast({ type: "CYCLE_TIME", payload: delta });
      }
    );

    this.node.createSubscription(
      "nextup_joint_interfaces/msg/NextupDriverStatus",
      "/nextup_driver_status",
      (msg) => {
        const jointOrder = ["joint1", "joint2", "joint3", "joint4", "joint5", "joint6"];

        const jointStatus = jointOrder.map((j) => {
          const i = msg.name.indexOf(j);
          return i !== -1 ? Boolean(msg.op_status[i]) : false;
        });

        const faultStatus = jointOrder.map((j) => {
          const i = msg.name.indexOf(j);
          return i !== -1 ? Boolean(msg.fault[i]) : false;
        });

        wsServer.broadcast({
          type: "DRIVER_STATUS",
          payload: { jointStatus, faultStatus },
        });
      }
    );


    this.node.createSubscription(
      "std_msgs/msg/String",
      "/logs_topic",
      (msg) => {
        wsServer.broadcast({ type: "LOG_MESSAGE_INCOMING", payload: msg.data });
      }
    );

    this.node.createSubscription(
      "nextup_joint_interfaces/msg/NextupDigitalInputs",
      "/nextup_digital_inputs",
      (msg) => {
        const jointCount = msg.name?.length || 0;

        const diMap = [
          msg.di1, msg.di2, msg.di3, msg.di4,
          msg.di5, msg.sto1, msg.sto2, msg.edm
        ];

        const payload = [];
        for (let drv = 0; drv < jointCount; drv++) {
          const driverData = [];
          for (let di = 0; di < diMap.length; di++) {
            driverData.push(diMap[di]?.[drv] ?? false);
          }
          payload.push(driverData);
        }

        const now = Date.now();
        if (now - this.lastDIBroadcast > 100) {
          wsServer.broadcast({ type: "DI_STATUS", payload });
          this.lastDIBroadcast = now;
        }

        const emergency = (msg.di5 || []).map(Boolean);
        wsServer.broadcast({
          type: "EMERGENCY_STATUS",
          payload: { jointStatus: emergency },
        });
      }
    );

    this.node.createSubscription(
      "sensor_msgs/msg/JointState",
      "/joint_states",
      (msg) => {
        wsServer.broadcast({ type: "JOINT_STATES", payload: msg });
      }
    );

    this.node.createSubscription(
      "std_msgs/msg/String",
      "/active_nodes_report",
      (msg) => {
        const list = msg.data
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        wsServer.broadcast({ type: "ACTIVE_NODES", payload: list });
      }
    );

    this.node.createSubscription(
      "std_msgs/msg/String",
      "/control_process_motion_bt_status",
      (msg) => {
        wsServer.broadcast({
          type: "MOTION_STATUS",
          payload: msg.data.toLowerCase(),
        });
      }
    );

    this.node.createSubscription(
      "std_msgs/msg/Bool",
      "/motion_start_bt_active",
      (msg) => {
        wsServer.broadcast({ type: "MOTION_ACTIVE", payload: msg.data });
      }
    );

    this.node.createSubscription(
      "std_msgs/msg/Bool",
      "/motion_planning_bt_success",
      (msg) => {
        if (msg.data === true) {
          wsServer.broadcast({ type: "MOTION_PLANNING_SUCCESS", payload: true });
        }
      }
    );

    this.node.createSubscription(
      "std_msgs/msg/String",
      "/bt_toast_popup",
      (msg) => {
        saveLogMessage(msg.data);
      }
    );

    this.node.createSubscription(
      "std_msgs/msg/String",
      "/control_process_control_bt_status",
      (msg) => {
        wsServer.broadcast({ type: "PROCESS_STATUS", payload: msg.data });
      }
    );

    this.node.createSubscription(
      "std_msgs/msg/Bool",
      "/control_start_bt_active",
      (msg) => {
        wsServer.broadcast({ type: "MOTION_ACTIVE", payload: msg.data });
      }
    );

    for (let driver = 1; driver <= 6; driver++) {
      const topic = `/nextup_digital_output_controller_${driver}/commands`;
      this.node.createSubscription(
        "nextup_joint_interfaces/msg/NextupDigitalOutputs",
        topic,
        (msg) => {
          const state = {
            do1: msg.do1?.[0] || false,
            do2: msg.do2?.[0] || false,
            do3: msg.do3?.[0] || false,
            do4: msg.pi_p?.[0] || false,
          };
          this.doStateCache[driver] = state;
          wsServer.broadcast({ type: "DO_STATUS", payload: { driver, ...state } });
        }
      );
    }

    try {
      const { initPointPlanningROS } = await import("../ros/rosPointPlanningService.js");
      initPointPlanningROS(this, wsServer);
    } catch (err) {
      console.error("Failed to initialize point planning ROS subscriptions:", err);
    }

    rclnodejs.spin(this.node);
    this.initialized = true;
    console.log("ROS Service initialized successfully");
  }

  // ── DIGITAL OUTPUT ───────────────────────────────────────────

  getDOPublisher(driver) {
    const topic = `/nextup_digital_output_controller_${driver}/commands`;
    if (!this.doPublishers[topic]) {
      this.doPublishers[topic] = this.node.createPublisher(
        "nextup_joint_interfaces/msg/NextupDigitalOutputs",
        topic
      );
    }
    return this.doPublishers[topic];
  }

  // Inside ROSService class
  publishFrameMode(frameName) {
    if (!this.framePublisher) {
      console.warn("Frame publisher not ready");
      return;
    }
    const StringMsg = rclnodejs.require("std_msgs/msg/String");
    const msg = new StringMsg();
    msg.data = frameName;
    this.framePublisher.publish(msg);
    console.log(`Published frame_mode: ${frameName}`);
  }
  publishDO(driver, doId, state) {
    const pub = this.getDOPublisher(driver);
    const Msg = rclnodejs.require("nextup_joint_interfaces/msg/NextupDigitalOutputs");

    if (!this.doStateCache[driver]) {
      this.doStateCache[driver] = { do1: false, do2: false, do3: false, do4: false };
    }

    this.doStateCache[driver][`do${doId}`] = state;

    const msg = new Msg();
    msg.do1 = [this.doStateCache[driver].do1];
    msg.do2 = [this.doStateCache[driver].do2];
    msg.do3 = [this.doStateCache[driver].do3];
    msg.pi_p = [this.doStateCache[driver].do4];

    pub.publish(msg);
  }

  publishChangeMode(mode) {
  if (!this.changeModePublisher) {
    console.warn("Change mode publisher not ready");
    return;
  }

  const StringMsg = rclnodejs.require("std_msgs/msg/String");
  const msg = new StringMsg();
  msg.data = mode;

  this.changeModePublisher.publish(msg);
  console.log(`Published /change_mode: "${mode}"`);
}

  // ── MOTION ───────────────────────────────────────────────────

  publishMotionCommand(command) {
    if (!this.motionCommandPublisher) { console.warn("Motion command publisher not ready"); return; }
    const StringMsg = rclnodejs.require("std_msgs/msg/String");
    const msg = new StringMsg();
    msg.data = command;
    this.motionCommandPublisher.publish(msg);
    console.log(`Published motion command: ${command}`);
  }

  publishMotionStart(isActive) {
    if (!this.motionStartPublisher) { console.warn("Motion start publisher not ready"); return; }
    const Bool = rclnodejs.require("std_msgs/msg/Bool");
    const msg = new Bool();
    msg.data = isActive;
    this.motionStartPublisher.publish(msg);
    console.log(`Published motion start: ${isActive}`);
  }

  publishAutoGenerateXML(shouldGenerate) {
    if (!this.autoGenerateXMLPublisher) { console.warn("Auto generate XML publisher not ready"); return; }
    const Bool = rclnodejs.require("std_msgs/msg/Bool");
    const msg = new Bool();
    msg.data = shouldGenerate;
    this.autoGenerateXMLPublisher.publish(msg);
    console.log(`Published auto generate XML: ${shouldGenerate}`);
  }

  publishAutoGenerateSequence(sequenceData) {
    if (!this.autoGenerateSequencePublisher) { console.warn("Auto generate sequence publisher not ready"); return; }
    const StringMsg = rclnodejs.require("std_msgs/msg/String");
    const msg = new StringMsg();
    msg.data = sequenceData;
    this.autoGenerateSequencePublisher.publish(msg);
    console.log(`Published auto generate sequence: ${sequenceData}`);
  }

  publishLogMessage(logData) {
    if (!this.logsPublisher) { console.warn("Logs publisher not ready"); return; }
    const StringMsg = rclnodejs.require("std_msgs/msg/String");
    const msg = new StringMsg();
    msg.data = logData;
    this.logsPublisher.publish(msg);
    console.log(`Published log message: ${logData}`);
  }

  // ── MOVE / SERVO ─────────────────────────────────────────────

  publishMove(data) {
    if (!this.movePublisher) return;
    const Twist = rclnodejs.require("geometry_msgs/msg/Twist");
    const msg = new Twist();
    msg.linear.x = data?.linear || 0;
    msg.angular.z = data?.angular || 0;
    this.movePublisher.publish(msg);
    console.log(`Published move: linear=${msg.linear.x}, angular=${msg.angular.z}`);
  }

  async startServo() {
    if (!this.startServoClient) {
      return { success: false, message: "Service client not available" };
    }
    try {
      const Trigger = rclnodejs.require("std_srvs/srv/Trigger");
      const request = new Trigger.Request();
      const response = await new Promise((resolve) => {
        this.startServoClient.sendRequest(request, resolve);
      });
      return { success: response?.success || false, message: response?.message || "Servo started successfully" };
    } catch (error) {
      console.error("Error calling start servo service:", error);
      return { success: false, message: error.message };
    }
  }

  async callMonitoringStart() {
    const Trigger = rclnodejs.require("std_srvs/srv/Trigger");
    const request = new Trigger.Request();
    return new Promise((resolve) => {
      this.monitoringStartClient.sendRequest(request, resolve);
    });
  }

  async callMonitoringStop() {
    const Trigger = rclnodejs.require("std_srvs/srv/Trigger");
    const request = new Trigger.Request();
    return new Promise((resolve) => {
      this.monitoringStopClient.sendRequest(request, resolve);
    });
  }
  // ── UI COMMANDS ──────────────────────────────────────────────

  publishUiCommand(command) {
    if (!this.uiCommandPublisher) { console.warn("UI command publisher not ready"); return; }
    const StringMsg = rclnodejs.require("std_msgs/msg/String");
    const msg = new StringMsg();
    msg.data = command;
    this.uiCommandPublisher.publish(msg);
  }

  // ── GENERIC TOPIC HELPERS (used by wsHandler) ─────────────────

  publishStringTopic(topicName, value) {
    const pub = this.node.createPublisher("std_msgs/msg/String", topicName);
    const StringMsg = rclnodejs.require("std_msgs/msg/String");
    const msg = new StringMsg();
    msg.data = value;
    pub.publish(msg);
    console.log(`Published ${topicName}: "${value}"`);
  }

  publishBoolTopic(topicName, value) {
    const pub = this.node.createPublisher("std_msgs/msg/Bool", topicName);
    const Bool = rclnodejs.require("std_msgs/msg/Bool");
    const msg = new Bool();
    msg.data = value;
    pub.publish(msg);
    console.log(`Published ${topicName}: ${value}`);
  }

  // ── ROBOT CONTROL ─────────────────────────────────────────────

  publishProcessControl(command) {
    if (!this.processControlPublisher) { console.warn("Process control publisher not ready"); return; }
    const StringMsg = rclnodejs.require("std_msgs/msg/String");
    const msg = new StringMsg();
    msg.data = command;
    this.processControlPublisher.publish(msg);
    console.log(`Published /control_process_control_bt: "${command}"`);
  }

  publishSpeedScale(value) {
    if (!this.speedScalePublisher) { console.warn("Speed scale publisher not ready"); return; }
    const Float64 = rclnodejs.require("std_msgs/msg/Float64");
    const msg = new Float64();
    msg.data = value;
    this.speedScalePublisher.publish(msg);
    console.log(`Published /dynamic_speed_scale: ${value}`);
  }

  publishCNCSelection(selection) {
    if (!this.cncSelectionPublisher) { console.warn("CNC selection publisher not ready"); return; }
    const StringMsg = rclnodejs.require("std_msgs/msg/String");
    const msg = new StringMsg();
    msg.data = selection;
    this.cncSelectionPublisher.publish(msg);
    console.log(`Published /select_cnc: "${selection}"`);
  }

  // ── SAFETY ───────────────────────────────────────────────────

  triggerEmergency() {
    const Msg = rclnodejs.require("nextup_joint_interfaces/msg/NextupEmergencyTrigger");
    const msg = new Msg();
    msg.emergencytrigger = true;
    this.emergencyPublisher.publish(msg);
    console.log("Emergency triggered");
  }

  resetFault() {
    const Bool = rclnodejs.require("std_msgs/msg/Bool");
    const msg = new Bool();
    msg.data = true;
    this.resetPublisher.publish(msg);
    console.log("Fault reset published");
  }

  // ── SHUTDOWN ─────────────────────────────────────────────────

  async shutdown() {
    if (this.node) {
      await this.node.destroy();
      console.log("ROS node destroyed");
    }
  }
}

export function getROSNode() {
  return rosNodeInstance;
}

export default async function createROSNode(wsServer) {
  if (rosNodeInstance) return rosNodeInstance;
  const instance = new ROSService();
  await instance.init(wsServer);
  rosNodeInstance = instance;
  return instance;
}