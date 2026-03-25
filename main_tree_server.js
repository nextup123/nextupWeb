// ======================================================
// Imports & Constants
// ======================================================

import express from "express";
import cors from "cors";

import treeRoutes from "./routes/mainTreeRoutes.js";

const app = express();
const PORT = 3011;

// const TEMPLATE_PATH = '/home/nextup/user_config_files/control_logic_data/behaviour_trees/template_tree.xml';
// const DO_DI_TEMPLATE_PATH = '/home/nextup/user_config_files/control_logic_data/behaviour_trees/do_di_tree.xml';
// const NODES_JSON_PATH = '/home/nextup/user_config_files/control_logic_data/behaviour_trees/nodes.json';
// const RUNPATH_TEMPLATE_PATH = '/home/nextup/user_config_files/control_logic_data/behaviour_trees/run_path.xml';

app.use(express.json());
// app.use(express.static('public'));
app.use(cors());

// const UID_CACHE_PATH = path.join(__dirname, 'user_config', 'template_with_uids.json');

// Utility: Read & Write XML (ordered JSON + _uid support)

// Node type definitions endpoints
app.use("/", treeRoutes);

// START SERVER
app.listen(PORT, () =>
  console.log(`✅ Server running at http://localhost:${PORT}`),
);
