import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const TREE_LAYOUT_DIR = path.join(__dirname, "../routes/tree_layout");

export const pointPlanningFilePath = {
  POINTS_YAML_FILE:
    "/home/nextup/user_config_files/planning_data/points/points.yaml",
  POINTS_BACKUP_YAML_FILE: "points_backup.yaml",
};

export const pathPlanningFilePath = {
  PATH_PLAN_TREE_XML_FILE:
    "/home/nextup/user_config_files/planning_data/planning_trees/path_plan_tree.xml",
  PATH_PLAN_TREE_XML_BACKUP_FILE:
    "/home/nextup/user_config_files/planning_data/planning_trees/path_plan_tree_backup.xml",
  PATHS_YAML_FILE:
    "/home/nextup/user_config_files/planning_data/paths/paths.yaml",
};

export const ioFilePath = {
  DO_DI_TREE_XML_FILE:
    "/home/nextup/user_config_files/control_logic_data/behaviour_trees/do_di_tree.xml",
  DO_DI_TREE_XML_BACKUP_FILE:
    "/home/nextup/user_config_files/control_logic_data/behaviour_trees/backup/do_di_tree_backup.xml",
};
export const BACKUP_DIR =
  "/home/nextup/user_config_files/planning_data/points/backup";

export const ERROR_LOGS_PATH =
  "/home/nextup/user_config_files/error_container/error_logs.yaml";

export const DESCRIPTION_PATH =
  "/home/nextup/user_config_files/error_container/description_error.txt";

export const COMMANDS_PATH =
  "/home/nextup/user_config_files/error_container/commands.json";

export const OPEN_TERMINAL_PATH =
  "/home/nextup/user_config_files/error_container/always_on_top_terminal.sh";

export const XML_BASE_DIR =
  "/home/nextup/user_config_files/control_logic_data/behaviour_trees";

export const LAYOUTS_DIR = path.join(__dirname, "../config/layouts");

export const MAPPED_DATA_PATH =
  "/home/nextup/user_config_files/planning_data/articles/mapped_data.yaml";

export const TEMPLATE_PATH =
  "/home/nextup/user_config_files/control_logic_data/behaviour_trees/template_tree.xml";
export const NODES_JSON_PATH =
  "/home/nextup/user_config_files/control_logic_data/behaviour_trees/nodes.json";
export const RUNPATH_TEMPLATE_PATH =
  "/home/nextup/user_config_files/control_logic_data/behaviour_trees/run_path.xml";
