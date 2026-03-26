const api = {
  async list() {
    const r = await fetch("/api/projects/list");
    return r.json();
  },

  async load(name) {
    const r = await fetch("/api/projects/load", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    return { ok: r.ok, data: await r.json() };
  },

  async loadActive(projectName) {
    const r = await fetch("/api/projects/active-project", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectName }),
    });
    return { ok: r.ok, data: await r.json() };
  },

  async readActiveProjectName() {
    const r = await fetch("/api/projects/active");
    return { ok: r.ok, data: await r.json() };
  },

  async create(data) {
    const r = await fetch("/api/projects/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return r.json();
  },

  async save() {
    const r = await fetch("/api/projects/save", { method: "POST" });
    return r.json();
  },

  async overwrite(name) {
    const r = await fetch("/api/projects/overwrite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    return r.json();
  },

  async listVersions(name) {
    const r = await fetch(`/api/projects/versions/${encodeURIComponent(name)}`);
    return { ok: r.ok, data: await r.json() };
  },

  async restoreVersion(name, versionId) {
    const r = await fetch("/api/projects/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, versionId }),
    });
    return { ok: r.ok, data: await r.json() };
  },

  // SSE — returns the EventSource so caller can close() it
  connectSessionStream(onMessage) {
    const evtSource = new EventSource("/api/status/stream");

    evtSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        onMessage(parsed);
      } catch (err) {
        console.error("SSE parse error", err);
      }
    };

    evtSource.onerror = (err) => {
      console.warn("SSE error", err);
    };

    return evtSource;
  },

  async deleteProject(name) {
    const r = await fetch(`/api/projects/delete/${encodeURIComponent(name)}`, {
      method: "DELETE",
    });
    return r.json();
  },
};