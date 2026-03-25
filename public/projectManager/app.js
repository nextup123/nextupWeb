const projectDetailsEl = document.getElementById("projectDetails");
const modal = document.getElementById("projectModal");
const projectListEl = document.getElementById("projectList");

// Confirm modal
const confirmModal = document.getElementById("confirmModal");
const confirmText = document.getElementById("confirmText");
const confirmYes = document.getElementById("confirmYes");
const confirmNo = document.getElementById("confirmNo");
const projectCount = document.getElementById("projectCount");
const defaultNewProject = document.querySelector(".default-project-btn");
const blankProjectBtn = document.querySelector(".blank-project-btn");
let pendingProjectSwitch = null;
const projectStates = {}; // { 'Blank 1': { state: 'DIRTY', reason: 'external_mutation' } }
const state = {
  projects: [],
  activeProject: null,
  sortBy: "name", // 👈 default
};

// =========================
// INIT
// =========================
init();

async function init() {
  await loadActiveProject();
  await loadProjects();
  // Ensure the active project's badge is correct after loading all projects
  const active = state.activeProject?.name;
  console.log(projectStates);
  if (active) {
    projectStates[active] = projectStates[active] || {
      project: active,
      state: state.activeProject.is_dirty ? "DIRTY" : "Active",
      reason: state.activeProject.is_dirty ? "unsaved_changes" : "manual_save",
    };
  }
  initSortControls(); // 👈 ADD THIS

  renderProjectList();
}

function initSortControls() {
  const buttons = document.querySelectorAll(".sort-btn");

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      // remove active from all
      buttons.forEach((b) => b.classList.remove("active"));

      // activate clicked
      btn.classList.add("active");

      // update state
      state.sortBy = btn.dataset.sort;

      // re-render
      renderProjectList();
    });
  });
}

// =========================
// LOAD ACTIVE PROJECT
// =========================
async function loadActiveProject() {
  try {
    const res = await api.readActiveProjectName();

    if (!res.ok || !res.data?.active_project) {
      state.activeProject = null;
      renderProject(null);
      return;
    }

    const activeName = res.data.active_project;
    const activeProjectData = await api.loadActive(activeName);

    if (!activeProjectData.ok)
      throw new Error("Failed to load active project data");

    state.activeProject = activeProjectData.data;

    // ✅ Force the active project state on page load 


    renderProject(state.activeProject);
  } catch (err) {
    console.error("Failed to load active project:", err);
    state.activeProject = null;
    renderProject(null);
  }
}
// =========================
// LOAD PROJECT LIST
// =========================
async function loadProjects() {
  try {
    const res = await api.list();
    state.projects = res.projects || res || [];
    const count = state.projects.length;
    projectCount.innerText = `${count} projects`;
  } catch (err) {
    console.error("Failed to load projects:", err);
    state.projects = [];
  }
}

// =========================
// RENDER ACTIVE PROJECT
// =========================
function renderProject(project) {
  if (!project) {
    projectDetailsEl.innerHTML = "<p>No active project</p>";
    return;
  }

  const fields = [
    ["Name", project.name],
    ["Owner", project.owner],
    ["Type", project.project_type],
    ["Created", formatDate(project.created_at)],
    ["Modified", formatDate(project.last_modified)],
  ];

  projectDetailsEl.innerHTML = `
    <div class="project-details-inline">
      ${fields
      .map(
        ([label, value]) => `
        <div class="field">
          <div class="label">${label}</div>
          <div class="value">${value || "-"}</div>
        </div>
      `,
      )
      .join("")}
    </div>
  `;
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// =========================
// RENDER PROJECT LIST (CLEAN + COMPACT)
// =========================
function renderProjectList() {
  projectListEl.innerHTML = "";

  if (!state.projects.length) {
    projectListEl.innerHTML = `
      <div class="empty-state">
        <p>No projects found</p>
      </div>
    `;
    return;
  }

  const sortedProjects = [...state.projects].sort((a, b) => {
    switch (state.sortBy) {
      case "name":
        return (a.name || "").localeCompare(b.name || "");

      case "date": // last_modified
        return new Date(b.last_modified || 0) - new Date(a.last_modified || 0);

      case "created":
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);

      default:
        return 0;
    }
  });

  sortedProjects.forEach((proj) => {
    const isActive =
      state.activeProject && proj.name === state.activeProject.name;

    const card = document.createElement("div");
    card.className = "project-card" + (isActive ? " active" : "");

    const name = proj.name || "Untitled";
    const owner = proj.owner || "Unknown";
    const type = proj.project_type || "Default";
    const created_at = formatStructuredDate(proj.created_at);
    const modified = formatStructuredDate(proj.last_modified);

    let badgeHTML = "";

    // Priority 1: DIRTY from SSE
    if (projectStates[proj.name]?.state === "DIRTY") {
      badgeHTML = `<div class="active-badge dirty">● Dirty</div>`;

      // Priority 2: Active project (green)
    } else if (isActive) {
      badgeHTML = `<div class="active-badge active">● Active</div>`;
    }

    card.innerHTML = `
      <div class="card-inner">

        <!-- HEADER -->
        <div class="card-header">
          <div class="project-name" title="${escapeHtml(name)}">
            ${escapeHtml(name)}
          </div>
          ${badgeHTML}
        </div>

        <!-- META (CLEAN INLINE) -->  
        <div class="project-metadata">
          <span>👤 ${escapeHtml(owner)}</span>
          <span>📦 ${escapeHtml(type)}</span>
        </div>

        <!-- DATE -->
        <div class="date-section">
          <span>${created_at}</span>
        </div>

        <!-- ACTIONS -->
        <div class="card-actions">
          <button class="action-btn primary set-default-btn" ${isActive ? 'disabled title="Cannot Load the active project"' : ''}>Load</button>
          <button class="action-btn copy-btn">Copy</button>
          <button class="action-btn danger delete-btn" ${isActive ? 'disabled title="Cannot delete the active project"' : ''}>Delete</button>
        </div>

      </div>
    `;

    card.querySelector(".delete-btn").addEventListener("click", async (e) => {
      e.stopPropagation();

      if (isActive) return;

      const confirmed = await showConfirm({
        title: "Delete Project",
        message: `Delete "${proj.name}" permanently? This cannot be undone.`,
      });

      if (!confirmed) return;

      try {
        await api.deleteProject(proj.name);

        showNotification(`"${proj.name}" deleted`, "success");

        await loadProjects();
        await loadActiveProject();
        renderProjectList();
      } catch (err) {
        console.error(err);
        showNotification("Delete failed", "error");
      }
    });

    // card.addEventListener("click", async (e) => {
    //   if (e.target.tagName === "BUTTON") return;

    //   const activeName = state.activeProject?.name;
    //   const isDirty = activeName && projectStates[activeName]?.state === "DIRTY";

    //   if (isDirty) {
    //     const choice = await showDirtySwitchConfirm(proj.name);
    //     if (!choice) return;

    //     if (choice === "save") {
    //       await api.save();
    //     }
    //     setAsDefaultProject(proj.name);
    //   } else {
    //     openConfirm(proj.name);
    //   }
    // });

    card.querySelector(".set-default-btn").addEventListener("click", async (e) => {
      e.stopPropagation();

      const activeName = state.activeProject?.name;
      const isDirty = activeName && projectStates[activeName]?.state === "DIRTY";

      if (isDirty) {
        const choice = await showDirtySwitchConfirm(proj.name);
        if (!choice) return;

        if (choice === "save") {
          await api.save();
          await setAsDefaultProject(proj.name); // save first, then load normally
        } else if (choice === "discard") {
          await api.overwrite(proj.name); // 👈 discard via overwrite endpoint
          await loadActiveProject();
          await loadProjects();
          renderProjectList();
        }
      } else {
        const confirmed = await showConfirm({
          title: "Set Active Project",
          message: `Make "${proj.name}" the active project?`,
        });
        if (!confirmed) return;
        setAsDefaultProject(proj.name);
      }
    });

    card.querySelector(".copy-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      openCopyProjectModal(proj);
    });

    projectListEl.appendChild(card);
  });
}

// =========================
// FULL DATE FORMAT (FIXED)
// =========================
function formatStructuredDate(dateStr) {
  if (!dateStr) return "—";

  const date = new Date(dateStr);
  if (isNaN(date)) return "—";

  return date.toLocaleString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// =========================
// ACTIONS
// =========================
async function setAsDefaultProject(projectName) {
  try {
    const res = await api.load(projectName);

    if (!res.ok) throw new Error();

    showNotification(`"${projectName}" set as Active`, "success");

    // inside the iframe (project manager), dispatch UP to parent
    window.parent.dispatchEvent(new CustomEvent("activeProjectChanged", {
      detail: { name: projectName }
    }));

    await loadActiveProject();
    await loadProjects();
    renderProjectList();
  } catch {
    showNotification("Failed to set default", "error");
  }
}

async function copyProject(sourceProject, newName, owner) {
  try {
    const copyData = {
      name: newName,
      owner: owner || "Anonymous",
      description: sourceProject.description || "Copy",
      project_type: sourceProject.project_type || "General",
      created_at: new Date().toISOString(),
      last_modified: new Date().toISOString(),
    };
    const res = await api.create(copyData);
    if (!res || res.success === false) throw new Error();

    showNotification(`"${newName}" created`, "success");
    await loadProjects();
    renderProjectList();
  } catch {
    showNotification("Copy failed", "error");
  }
}

async function openCopyProjectModal(project) {
  const result = await showInput({
    title: `Duplicate "${project.name}"`,
    defaultValue: `${project.name} (copy)`,
    placeholder: "Enter new project name",
    defaultOwner: project.owner || "",
  });

  if (!result || !result.name) return;

  copyProject(project, result.name, result.owner);
}

// =========================
// CONFIRM SWITCH
// =========================
function openConfirm(name) {
  pendingProjectSwitch = name;
  confirmText.innerText = `Switch to "${name}"?`;
  confirmModal.classList.remove("hidden");
}

confirmYes.addEventListener("click", async () => {
  if (!pendingProjectSwitch) return;

  try {
    const res = await api.load(pendingProjectSwitch);
    if (!res.ok) throw new Error();

    confirmModal.classList.add("hidden");

    await loadActiveProject();
  } catch {
    console.error("Switch failed");
  } finally {
    pendingProjectSwitch = null;
  }
});

confirmNo.addEventListener("click", () => {
  confirmModal.classList.add("hidden");
  pendingProjectSwitch = null;
});

// =========================
// NOTIFICATION
// =========================
function showNotification(message, type = "info") {
  let toast = document.querySelector(".global-toast");

  if (!toast) {
    toast = document.createElement("div");
    toast.className = "global-toast";
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: ${type === "error" ? "#b91c1c" : "#0f172a"};
    color: white;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 13px;
    z-index: 9999;
  `;

  setTimeout(() => {
    toast.remove();
  }, 2500);
}

// =========================
// ESCAPE HTML
// =========================
function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// =========================
// CREATE PROJECT MODAL (ISOLATED)
// =========================
(function () {
  const modal = document.getElementById("createProjectModal");
  const openBtn = document.querySelector(".create-project-btn");

  const form = document.getElementById("createProjectForm");
  const cancelBtn = document.getElementById("closeModal");

  const nameInput = document.getElementById("projectName");
  const ownerInput = document.getElementById("projectOwner");
  const descInput = document.getElementById("projectDescription");
  const typeInput = document.getElementById("projectType");

  if (!modal) return;

  // OPEN
  openBtn?.addEventListener("click", () => {
    modal.classList.add("active");
  });

  // CLOSE (button)
  cancelBtn?.addEventListener("click", () => {
    modal.classList.remove("active");
  });

  // CLOSE (outside click)
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.classList.remove("active");
    }
  });

  // SUBMIT (correct way)
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = nameInput.value.trim();
    const owner = ownerInput.value.trim();
    const description = descInput.value.trim();
    const type = typeInput.value;

    if (!name) {
      alert("Project name required");
      return;
    }

    try {
      const payload = {
        name,
        owner: owner || "Anonymous",
        description,
        project_type: type,
        created_at: new Date().toISOString(),
        last_modified: new Date().toISOString(),
      };
      const res = await api.create(payload);

      if (!res || res.success === false) {
        throw new Error();
      }

      // RESET
      form.reset();

      modal.classList.remove("active");

      await loadProjects();
      renderProjectList();
    } catch (err) {
      console.error(err);
      alert("Failed to create project");
    }
  });
})();

// Confirmation Modal JS Code
const inputModal = document.getElementById("inputModal");
const inputTitle = document.getElementById("inputTitle");
const inputField = document.getElementById("inputField");
const inputOk = document.getElementById("inputOk");
const inputCancel = document.getElementById("inputCancel");
const inputOwnerField = document.getElementById("inputOwnerField");
const inputDescField = document.getElementById("inputDescField");

function showInput({ title = "Enter value", defaultValue = "", placeholder = "", defaultOwner = "", showDesc = false }) {
  return new Promise((resolve) => {
    inputTitle.innerText = title;
    inputField.value = defaultValue;
    inputField.placeholder = placeholder;
    inputOwnerField.value = defaultOwner;

    // Show/hide description field
    inputDescField.style.display = showDesc ? "block" : "none";
    inputDescField.value = "";

    inputModal.classList.add("active");
    setTimeout(() => inputField.focus(), 0);

    function cleanup(result) {
      inputModal.classList.remove("active");
      inputOk.removeEventListener("click", okHandler);
      inputCancel.removeEventListener("click", cancelHandler);
      resolve(result);
    }

    function okHandler() {
      cleanup({
        name: inputField.value.trim(),
        owner: inputOwnerField.value.trim(),
        description: inputDescField.value.trim(),
      });
    }

    function cancelHandler() { cleanup(null); }

    inputOk.addEventListener("click", okHandler);
    inputCancel.addEventListener("click", cancelHandler);
  });
}


const confirmDefaultModal = document.getElementById("confirmDefaultModal");
//Show confirm modal popup JS Code
function showConfirm({ title, message }) {
  return new Promise((resolve) => {
    confirmTitle.innerText = title;
    confirmMessage.innerText = message;

    confirmDefaultModal.classList.add("active");

    const ok = () => cleanup(true);
    const cancel = () => cleanup(false);

    function cleanup(result) {
      confirmDefaultModal.classList.remove("active");
      confirmOk.removeEventListener("click", ok);
      confirmCancel.removeEventListener("click", cancel);
      resolve(result);
    }

    confirmOk.addEventListener("click", ok);
    confirmCancel.addEventListener("click", cancel);
  });
}

// Save Project Button JS
const saveBtn = document.querySelector(".save-project-btn");

saveBtn.addEventListener("click", async (e) => {
  e.stopPropagation();

  const confirmed = await showConfirm({
    title: "Save Project",
    message: `Save Changes made to Active Project?`,
  });

  if (!confirmed) return;

  try {
    await api.save();

    showNotification(`Project Saved`, "success");

    await loadProjects();
    await loadActiveProject();
    renderProjectList();
  } catch (err) {
    console.error(err);
    showNotification("Saving Project failed", "error");
  }
});

//Create Deault Project Button JS
defaultNewProject?.addEventListener("click", async () => {
  const confirmed = await showConfirm({
    title: "Create Default Project",
    message: "Create a new project with default settings?",
  });

  if (!confirmed) return;

  createDefaultProject();
});

async function createDefaultProject() {
  try {
    const defaultName = `Default ${Date.now().toString().slice(-4)}`;

    const payload = {
      name: defaultName,
      owner: "Nextup",
      description: "Default template project",
      project_type: "standard",
      created_at: new Date().toISOString(),
      last_modified: new Date().toISOString(),
    };

    const res = await api.create(payload);

    if (!res || res.success === false) {
      throw new Error();
    }

    // 👉 Immediately make it active
    await api.load(defaultName);

    showNotification(`"${defaultName}" created`, "success");

    await loadProjects();
    await loadActiveProject();
    renderProjectList();
  } catch (err) {
    console.error(err);
    showNotification("Default project creation failed", "error");
  }
}

//Blank Project Creator JS
blankProjectBtn?.addEventListener("click", async () => {
  const confirmed = await showConfirm({
    title: "Create Blank Project",
    message: "Create an empty project with no defaults?",
  });

  if (!confirmed) return;

  createBlankProject();
});

//showDirtySwitchConfirm

function showDirtySwitchConfirm(targetName) {
  return new Promise((resolve) => {
    const modal = document.getElementById("confirmDefaultModal");
    const title = document.getElementById("confirmTitle");
    const message = document.getElementById("confirmMessage");
    const ok = document.getElementById("confirmOk");
    const cancel = document.getElementById("confirmCancel");

    title.innerText = "Unsaved Changes";
    message.innerText = `You have unsaved changes. What would you like to do before switching to "${targetName}"?`;

    ok.innerText = "Save & Load";
    cancel.innerText = "Discard & Load";

    // Add a Cancel button dynamically
    const cancelActionBtn = document.createElement("button");
    cancelActionBtn.innerText = "Cancel";
    cancelActionBtn.style.cssText = `
      padding: 0.4rem 0.8rem;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
      background: #f1f5f9;
      color: #1e293b;
      cursor: pointer;
      font-size: 0.85rem;
    `;
    ok.parentElement.prepend(cancelActionBtn); // insert before Discard & Save

    modal.classList.add("active");

    function cleanup(result) {
      modal.classList.remove("active");
      ok.innerText = "Confirm";
      cancel.innerText = "Cancel";
      ok.removeEventListener("click", saveHandler);
      cancel.removeEventListener("click", discardHandler);
      cancelActionBtn.removeEventListener("click", cancelHandler);
      cancelActionBtn.remove(); // clean up dynamic button
      resolve(result);
    }

    function saveHandler() { cleanup("save"); }
    function discardHandler() { cleanup("discard"); }
    function cancelHandler() { cleanup(null); }

    ok.addEventListener("click", saveHandler);
    cancel.addEventListener("click", discardHandler);
    cancelActionBtn.addEventListener("click", cancelHandler);
  });
}
//END: showDirtySwitchConfirm


async function createBlankProject() {
  try {
    const name = generateBlankName();

    const payload = {
      name,
      owner: "Nextup",
      description: "This is a Blank Project",
      project_type: "blank",
      created_at: new Date().toISOString(),
      last_modified: new Date().toISOString(),
    };

    const res = await api.create(payload);

    if (!res || res.success === false) throw new Error();

    // 👉 set active immediately
    await api.load(name);

    showNotification(`"${name}" created`, "success");

    await loadProjects();
    await loadActiveProject();
    renderProjectList();
  } catch (err) {
    console.error(err);
    showNotification("Blank project creation failed", "error");
  }
}

function generateBlankName() {
  let i = 1;
  let name;

  do {
    name = `Blank ${i}`;
    i++;
  } while (state.projects.some((p) => p.name === name));

  return name;
}

let evtSource = null;

function startSessionStream() {
  if (evtSource) {
    console.warn("SSE already running");
    return;
  }

  evtSource = new EventSource("/api/status/stream");

  evtSource.onopen = () => {
    console.log("✅ SSE connection opened");
  };

  evtSource.onmessage = (event) => {
    console.log("📦 RAW DATA :", event.data);

    try {
      const parsed = JSON.parse(event.data);
      console.log("✅ PARSED DATA:", parsed);

      if (parsed.project) {
        projectStates[parsed.project] = parsed;
        // Re-render the list to update badges
        renderProjectList();
      }
    } catch (err) {
      console.error("❌ JSON PARSE FAILED:", err);
    }
  };

  evtSource.onerror = (err) => {
    console.error("🚨 SSE ERROR:", err);
  };
}


//save as button - satyanshu 

const saveAsBtn = document.querySelector(".save-as-btn");

saveAsBtn.addEventListener("click", async () => {
  const result = await showInput({
    title: "Save As New Project",
    defaultValue: state.activeProject?.name ? `${state.activeProject.name}_1` : "",
    placeholder: "Enter project name...",
    defaultOwner: state.activeProject?.owner || "Nextup",
    showDesc: true, // 👈
  });

  if (!result || !result.name) return;

  try {
    const payload = {
      name: result.name,
      owner: result.owner || "Nextup",
      description: result.description || "",
      project_type: "standard",
      created_at: new Date().toISOString(),
      last_modified: new Date().toISOString(),
    };

    const res = await api.create(payload);
    if (!res || res.success === false) throw new Error();

    showNotification(`"${result.name}" saved as new project`, "success");

    await loadProjects();
    renderProjectList();
  } catch (err) {
    console.error(err);
    showNotification("Save As failed", "error");
  }
});

//end













// call ONCE
startSessionStream();
