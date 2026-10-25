
"use strict";

/*
|--------------------------------------------------------------------------
| Foundev Super Admin — Project Management
| File: admin/js/admin-projects.js
|--------------------------------------------------------------------------
| GET/POST  ../backend/api/admin/projects.php
| POST      ../backend/api/admin/project-upload.php
|
| Maximum ZIP size: 400 MiB
|--------------------------------------------------------------------------
*/

const PROJECTS_API = "../backend/api/admin/projects.php";
const PROJECT_UPLOAD_API = "../backend/api/admin/project-upload.php";
const MAX_PROJECT_ZIP_BYTES = 400 * 1024 * 1024;
const PROJECT_UPLOAD_TIMEOUT = 30 * 60 * 1000;

let projectRecords = [];
let projectSearchTimer = null;
let projectRequestController = null;
let editingProject = false;
let previousProjectFocus = null;
let projectSubmitting = false;

/* ==========================================================================
   INITIALIZATION
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
    setProjectDate();
    bindProjectEvents();
    loadProjects();
});

function byId(id) {
    return document.getElementById(id);
}

function setText(id, value) {
    const element = byId(id);
    if (element) element.textContent = String(value ?? "");
}

function setProjectDate() {
    const element = byId("admin-current-date");
    if (!element) return;

    element.textContent = new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    }).format(new Date());
}

function bindProjectEvents() {
    byId("project-form")?.addEventListener("submit", submitProjectForm);

    byId("reset-project-form")?.addEventListener("click", () => {
        if (projectSubmitting) return;
        resetProjectForm();
    });

    byId("refresh-projects")?.addEventListener("click", () => {
        loadProjects();
    });

    byId("open-project-form")?.addEventListener("click", openNewProjectForm);

    byId("project-search")?.addEventListener("input", () => {
        clearTimeout(projectSearchTimer);
        projectSearchTimer = setTimeout(loadProjects, 300);
    });

    ["filter-domain", "filter-type", "filter-status"].forEach(id => {
        byId(id)?.addEventListener("change", loadProjects);
    });

    byId("project-file")?.addEventListener("change", updateFileSummary);

    byId("project-table-body")?.addEventListener(
        "click",
        handleProjectTableClick
    );

    byId("close-project-details")?.addEventListener(
        "click",
        closeProjectDetails
    );

    byId("close-project-details-footer")?.addEventListener(
        "click",
        closeProjectDetails
    );

    byId("project-detail-modal")?.addEventListener("click", event => {
        if (event.target.id === "project-detail-modal") {
            closeProjectDetails();
        }
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") closeProjectDetails();
    });
}

/* ==========================================================================
   API RESPONSE HANDLING
   ========================================================================== */

async function readProjectResponse(response) {
    if (response.status === 401) {
        window.location.replace("login.html");
        throw new Error("ADMIN_SESSION_EXPIRED");
    }

    const contentType = response.headers.get("content-type") || "";

    if (!contentType.toLowerCase().includes("application/json")) {
        const body = await response.text().catch(() => "");
        console.error("Non-JSON API response:", {
            status: response.status,
            url: response.url,
            body: body.slice(0, 1500)
        });

        throw new Error(
            `The server returned a non-JSON response (HTTP ${response.status}). ` +
            "Check the PHP endpoint and Apache/PHP error logs."
        );
    }

    let data;

    try {
        data = await response.json();
    } catch (error) {
        console.error("Invalid JSON response:", error);
        throw new Error("The server returned invalid JSON.");
    }

    if (data.authenticated === false) {
        window.location.replace("login.html");
        throw new Error("ADMIN_SESSION_EXPIRED");
    }

    return data;
}

async function apiGet(url, signal) {
    const response = await fetch(url, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        signal,
        headers: {
            Accept: "application/json"
        }
    });

    const data = await readProjectResponse(response);

    if (!response.ok || data.success !== true) {
        throw new Error(
            data.message || `Request failed with HTTP ${response.status}.`
        );
    }

    return data;
}

/* ==========================================================================
   LOAD PROJECT CATALOGUE
   ========================================================================== */

async function loadProjects() {
    if (projectRequestController) {
        projectRequestController.abort();
    }

    const controller = new AbortController();
    projectRequestController = controller;

    const tbody = byId("project-table-body");
    const refreshButton = byId("refresh-projects");
    const dataStatus = byId("project-data-status");

    if (refreshButton) refreshButton.disabled = true;
    if (dataStatus) dataStatus.textContent = "Loading catalogue";

    if (tbody && projectRecords.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7">
                    <div class="admin-empty-state">
                        <strong>Loading projects</strong>
                        <p>Retrieving the project catalogue.</p>
                    </div>
                </td>
            </tr>
        `;
    }

    const params = new URLSearchParams();
    const search = byId("project-search")?.value.trim() || "";
    const domain = byId("filter-domain")?.value || "";
    const type = byId("filter-type")?.value || "";
    const status = byId("filter-status")?.value || "";

    if (search) params.set("search", search);
    if (domain) params.set("domain", domain);
    if (type) params.set("type", type);
    if (status) params.set("status", status);

    const query = params.toString();
    const url = query ? `${PROJECTS_API}?${query}` : PROJECTS_API;

    try {
        const data = await apiGet(url, controller.signal);

        if (projectRequestController !== controller) return;

        projectRecords = Array.isArray(data.projects) ? data.projects : [];

        renderProjectMetrics(data.summary || {});
        renderProjectTable(projectRecords);

        if (data.admin?.full_name) {
            updateProjectAdminProfile(data.admin.full_name);
        }

        if (dataStatus) dataStatus.textContent = "Catalogue up to date";

        const count = projectRecords.length;
        setText(
            "project-result-count",
            `${count} project${count === 1 ? "" : "s"} displayed`
        );
    } catch (error) {
        if (error.name === "AbortError") return;
        if (error.message === "ADMIN_SESSION_EXPIRED") return;
        if (projectRequestController !== controller) return;

        console.error("Failed to load project catalogue:", error);

        if (dataStatus) dataStatus.textContent = "Unable to load data";

        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7">
                        <div class="admin-empty-state">
                            <strong>Could not load projects</strong>
                            <p>${escapeProjectText(error.message)}</p>
                        </div>
                    </td>
                </tr>
            `;
        }

        showProjectToast(error.message || "Unable to load projects.", "error");
    } finally {
        if (projectRequestController === controller) {
            projectRequestController = null;
            if (refreshButton) refreshButton.disabled = false;
        }
    }
}

function updateProjectAdminProfile(fullName) {
    const name = String(fullName || "Administrator").trim();
    setText("admin-user-name", name);

    const initials = name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part.charAt(0).toUpperCase())
        .join("");

    setText("admin-user-avatar", initials || "A");
}

/* ==========================================================================
   SUMMARY METRICS
   ========================================================================== */

function renderProjectMetrics(summary) {
    setText("metric-total", formatProjectNumber(summary.total));
    setText("metric-published", formatProjectNumber(summary.published));
    setText("metric-mini", formatProjectNumber(summary.mini));
    setText("metric-major", formatProjectNumber(summary.major));
}

/* ==========================================================================
   PROJECT TABLE
   ========================================================================== */

function renderProjectTable(projects) {
    const tbody = byId("project-table-body");
    if (!tbody) return;

    if (!projects.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7">
                    <div class="admin-empty-state">
                        <strong>No projects found</strong>
                        <p>Try another search or add a new project.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = projects.map(project => {
        const id = Number(project.id);
        const title = project.title || "Untitled project";
        const description = project.description || "No description provided";
        const domain = project.domain || "Uncategorised";
        const type = normaliseProjectType(project.project_type);
        const status = normaliseProjectStatus(project.status);

        return `
            <tr>
                <td>
                    <span class="project-table-name">
                        ${escapeProjectText(title)}
                    </span>
                    <span class="project-table-secondary">
                        ${escapeProjectText(description)}
                    </span>
                </td>

                <td>
                    <span class="project-table-type">
                        ${type === "major" ? "Major project" : "Mini project"}
                    </span>
                    <span class="project-table-secondary">
                        ${escapeProjectText(domain)}
                    </span>
                </td>

                <td>${formatProjectCurrency(project.external_price)}</td>
                <td>${formatProjectCurrency(project.university_price)}</td>

                <td>
                    <span class="project-status-badge ${projectStatusClass(status)}">
                        ${escapeProjectText(status)}
                    </span>
                </td>

                <td>${escapeProjectText(formatProjectDate(project.created_at))}</td>

                <td>
                    <div class="project-row-actions">
                        <button type="button" data-action="view" data-id="${id}">
                            View
                        </button>

                        <button type="button" data-action="edit" data-id="${id}">
                            Edit
                        </button>

                        <button type="button" data-action="toggle" data-id="${id}">
                            ${status === "published" ? "Unpublish" : "Publish"}
                        </button>

                        <button type="button"
                                class="project-delete-button"
                                data-action="delete"
                                data-id="${id}">
                            Remove
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

function handleProjectTableClick(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const id = Number(button.dataset.id);
    const action = button.dataset.action;

    const project = projectRecords.find(item => Number(item.id) === id);

    if (!project) {
        showProjectToast("Project not found. Refresh the catalogue.", "error");
        return;
    }

    if (action === "view") showProjectDetails(project);
    if (action === "edit") editProject(project);
    if (action === "toggle") toggleProjectStatus(project);
    if (action === "delete") removeProject(project);
}

/* ==========================================================================
   CREATE / RESET FORM
   ========================================================================== */

function openNewProjectForm() {
    if (projectSubmitting) return;

    resetProjectForm();

    byId("project-form-section")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

    byId("project-name")?.focus();
}

function resetProjectForm() {
    if (projectSubmitting) return;

    const form = byId("project-form");
    if (!form) return;

    form.reset();
    editingProject = false;

    const idInput = byId("project-id");
    if (idInput) idInput.value = "";

    const fileInput = byId("project-file");
    if (fileInput) fileInput.required = true;

    setText("project-form-heading", "Add a project");
    setText("project-form-mode", "NEW PROJECT");
    setText("save-project-button", "Upload project");
    setText("project-file-summary", "No ZIP file selected.");

    const progress = byId("project-progress");
    if (progress) progress.hidden = true;

    setProgress(0);
}

/* ==========================================================================
   EDIT PROJECT
   ========================================================================== */

function editProject(project) {
    if (projectSubmitting) return;

    const form = byId("project-form");
    if (!form) return;

    form.reset();
    editingProject = true;

    byId("project-id").value = project.id;
    byId("project-name").value = project.title || "";
    byId("project-domain").value = project.domain || "";
    byId("project-description").value = project.description || "";
    byId("project-tech-stack").value = project.technologies || "";
    byId("external-price").value = project.external_price ?? "";
    byId("university-price").value = project.university_price ?? "";
    byId("project-status").value = normaliseProjectStatus(project.status);
    byId("project-featured").value = project.is_featured ? "1" : "0";

    const type = normaliseProjectType(project.project_type);
    const radio = form.querySelector(
        `input[name="project_type"][value="${type}"]`
    );
    if (radio) radio.checked = true;

    const fileInput = byId("project-file");
    if (fileInput) fileInput.required = false;

    setText(
        "project-file-summary",
        "Existing package will be kept unless you choose a replacement ZIP."
    );

    setText("project-form-heading", "Edit project");
    setText("project-form-mode", `EDITING #${project.id}`);
    setText("save-project-button", "Save changes");

    byId("project-form-section")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

    byId("project-name")?.focus();
}

/* ==========================================================================
   FORM SUBMISSION
   ========================================================================== */

async function submitProjectForm(event) {
    event.preventDefault();

    if (projectSubmitting) return;

    const form = event.currentTarget;
    if (!form.reportValidity()) return;

    const projectId = byId("project-id")?.value.trim() || "";
    const fileInput = byId("project-file");
    const file = fileInput?.files?.[0] || null;

    if (!projectId && !file) {
        showProjectToast("Select a ZIP package before uploading.", "error");
        fileInput?.focus();
        return;
    }

    if (file) {
        if (!file.name.toLowerCase().endsWith(".zip")) {
            showProjectToast("Only ZIP files are supported.", "error");
            return;
        }

        if (file.size > MAX_PROJECT_ZIP_BYTES) {
            showProjectToast(
                "The ZIP file exceeds the 400 MiB upload limit.",
                "error"
            );
            return;
        }
    }

    const externalPrice = Number(byId("external-price")?.value);
    const universityPrice = Number(byId("university-price")?.value);

    if (
        !Number.isFinite(externalPrice) ||
        !Number.isFinite(universityPrice) ||
        externalPrice < 0 ||
        universityPrice < 0
    ) {
        showProjectToast("Enter valid, non-negative prices.", "error");
        return;
    }

    const submitButton = byId("save-project-button");
    const progress = byId("project-progress");

    if (!submitButton) {
        showProjectToast("Could not find the form submit button.", "error");
        return;
    }

    projectSubmitting = true;
    const wasEditing = Boolean(projectId);

    submitButton.disabled = true;

    const resetButton = byId("reset-project-form");
    if (resetButton) resetButton.disabled = true;

    setText(
        "save-project-button",
        wasEditing ? "Saving changes…" : "Uploading project…"
    );

    if (progress) progress.hidden = false;

    setProgress(0);
    setText("project-progress-label", "Preparing upload…");

    try {
        const formData = new FormData(form);

        formData.set("action", wasEditing ? "update" : "create");

        if (wasEditing) {
            formData.set("id", projectId);
        } else {
            formData.delete("id");
        }

        console.info("[Foundev upload] Starting request", {
            endpoint: PROJECT_UPLOAD_API,
            action: wasEditing ? "update" : "create",
            fileName: file?.name || null,
            fileSize: file?.size || 0
        });

        const result = await sendProjectFormData(
            PROJECT_UPLOAD_API,
            formData,
            percent => {
                setProgress(percent);
                setText("project-progress-label", `Uploading… ${percent}%`);
            }
        );

        showProjectToast(
            result.message ||
                (wasEditing
                    ? "Project updated successfully."
                    : "Project uploaded successfully."),
            "success"
        );

        resetProjectForm();
        await loadProjects();

    } catch (error) {
        if (error.message !== "ADMIN_SESSION_EXPIRED") {
            console.error("[Foundev upload] Failed:", error);

            showProjectToast(
                error.message || "Project upload failed.",
                "error"
            );

            setText(
                "project-progress-label",
                error.message || "Upload failed."
            );
        }
    } finally {
        projectSubmitting = false;

        if (submitButton.isConnected) {
            submitButton.disabled = false;
            setText(
                "save-project-button",
                editingProject ? "Save changes" : "Upload project"
            );
        }

        if (resetButton) resetButton.disabled = false;
    }
}

/* ==========================================================================
   XHR UPLOAD WITH PROGRESS AND DIAGNOSTICS
   ========================================================================== */

function sendProjectFormData(url, formData, onProgress) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        let settled = false;

        const fail = message => {
            if (settled) return;
            settled = true;
            reject(new Error(message));
        };

        xhr.open("POST", url, true);
        xhr.withCredentials = true;
        xhr.timeout = PROJECT_UPLOAD_TIMEOUT;
        xhr.setRequestHeader("Accept", "application/json");

        xhr.upload.addEventListener("loadstart", () => {
            console.info("[Foundev upload] Browser started sending request.");
            setText("project-progress-label", "Connecting to server…");
        });

        xhr.upload.addEventListener("progress", event => {
            if (!event.lengthComputable) {
                setText("project-progress-label", "Uploading package…");
                return;
            }

            const percent = Math.min(
                100,
                Math.round((event.loaded / event.total) * 100)
            );

            if (typeof onProgress === "function") {
                onProgress(percent);
            }

            if (percent >= 100) {
                setText(
                    "project-progress-label",
                    "Upload sent. Waiting for server to process the ZIP…"
                );
            }
        });

        xhr.addEventListener("load", () => {
            if (settled) return;

            console.info("[Foundev upload] Server responded:", {
                status: xhr.status,
                response: xhr.responseText.slice(0, 2000)
            });

            let data;

            try {
                data = JSON.parse(xhr.responseText);
            } catch {
                fail(
                    `Server returned invalid JSON (HTTP ${xhr.status}). ` +
                    "Check the PHP error log and Network response."
                );
                return;
            }

            if (xhr.status === 401 || data.authenticated === false) {
                window.location.replace("login.html");
                fail("ADMIN_SESSION_EXPIRED");
                return;
            }

            if (xhr.status < 200 || xhr.status >= 300) {
                fail(
                    data.message ||
                    `Upload failed with HTTP ${xhr.status}.`
                );
                return;
            }

            if (data.success !== true) {
                fail(data.message || "The project could not be saved.");
                return;
            }

            settled = true;
            resolve(data);
        });

        xhr.addEventListener("error", () => {
            console.error("[Foundev upload] Network error.", {
                endpoint: url,
                readyState: xhr.readyState,
                status: xhr.status
            });

            fail(
                "Network error: the upload request could not complete. " +
                "Check DevTools Network, the service worker, and XAMPP."
            );
        });

        xhr.addEventListener("timeout", () => {
            console.error("[Foundev upload] Request timed out.");
            fail(
                "Upload timed out after 30 minutes. Check the server logs " +
                "and PHP execution limits."
            );
        });

        xhr.addEventListener("abort", () => {
            fail("Upload was cancelled.");
        });

        console.info("[Foundev upload] Sending FormData:", url);

        try {
            xhr.send(formData);
        } catch (error) {
            console.error("[Foundev upload] Could not send request:", error);
            fail("The browser could not start the upload: " + error.message);
        }
    });
}

/* ==========================================================================
   FILE SUMMARY
   ========================================================================== */

function updateFileSummary() {
    const file = byId("project-file")?.files?.[0];

    if (!file) {
        setText(
            "project-file-summary",
            editingProject
                ? "Existing package will be kept unless you choose a replacement ZIP."
                : "No ZIP file selected."
        );
        return;
    }

    setText(
        "project-file-summary",
        `${file.name} — ${formatProjectBytes(file.size)} selected.`
    );

    if (file.size > MAX_PROJECT_ZIP_BYTES) {
        showProjectToast(
            "The selected ZIP exceeds the 400 MiB upload limit.",
            "error"
        );
    }
}

/* ==========================================================================
   PUBLISH / UNPUBLISH
   ========================================================================== */

async function toggleProjectStatus(project) {
    const currentStatus = normaliseProjectStatus(project.status);
    const action = currentStatus === "published" ? "unpublish" : "publish";

    const prompt = action === "publish"
        ? `Publish "${project.title}"? It may become available in the catalogue.`
        : `Unpublish "${project.title}"? It will be hidden from discovery.`;

    if (!window.confirm(prompt)) return;

    await sendProjectAction({
        action,
        id: Number(project.id)
    });
}

/* ==========================================================================
   DELETE PROJECT
   ========================================================================== */

async function removeProject(project) {
    const name = project.title || "this project";

    if (!window.confirm(
        `Delete "${name}" from the project catalogue? This action cannot be undone.`
    )) {
        return;
    }

    const confirmation = window.prompt(
        "Type DELETE to confirm removal."
    );

    if (confirmation !== "DELETE") {
        showProjectToast("Removal cancelled.", "info");
        return;
    }

    await sendProjectAction({
        action: "delete",
        id: Number(project.id)
    });
}

/* ==========================================================================
   JSON PROJECT ACTIONS
   ========================================================================== */

async function sendProjectAction(payload) {
    try {
        const response = await fetch(PROJECTS_API, {
            method: "POST",
            credentials: "same-origin",
            cache: "no-store",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json"
            },
            body: JSON.stringify(payload)
        });

        const data = await readProjectResponse(response);

        if (!response.ok || data.success !== true) {
            throw new Error(
                data.message || "The operation failed."
            );
        }

        showProjectToast(
            data.message || "Project updated successfully.",
            "success"
        );

        await loadProjects();

    } catch (error) {
        if (error.message !== "ADMIN_SESSION_EXPIRED") {
            console.error("Project action failed:", error);
            showProjectToast(error.message || "The operation failed.", "error");
        }
    }
}

/* ==========================================================================
   PROJECT DETAILS MODAL
   ========================================================================== */

function showProjectDetails(project) {
    const modal = byId("project-detail-modal");
    const content = byId("project-detail-content");

    if (!modal || !content) return;

    previousProjectFocus = document.activeElement;

    const details = [
        ["Project ID", project.id],
        ["Project name", project.title],
        ["Project type", normaliseProjectType(project.project_type)],
        ["Domain", project.domain],
        ["Description", project.description],
        ["Technology stack", project.technologies || "Not specified"],
        ["External student price", formatProjectCurrency(project.external_price)],
        ["University student price", formatProjectCurrency(project.university_price)],
        ["Publication status", normaliseProjectStatus(project.status)],
        ["Featured", project.is_featured ? "Yes" : "No"],
        ["Created", formatProjectDate(project.created_at)],
        ["Updated", formatProjectDate(project.updated_at)]
    ];

    content.innerHTML = details.map(([label, value]) => `
        <div class="project-detail-item">
            <span>${escapeProjectText(label)}</span>
            <strong>${escapeProjectText(String(value ?? "—"))}</strong>
        </div>
    `).join("");

    modal.classList.add("active");
    document.body.style.overflow = "hidden";
    byId("close-project-details")?.focus();
}

function closeProjectDetails() {
    const modal = byId("project-detail-modal");

    if (!modal?.classList.contains("active")) return;

    modal.classList.remove("active");
    document.body.style.overflow = "";

    if (previousProjectFocus instanceof HTMLElement) {
        previousProjectFocus.focus();
    }
}

/* ==========================================================================
   PROGRESS BAR
   ========================================================================== */

function setProgress(percent) {
    const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
    const fill = byId("project-progress-fill");

    if (fill) {
        fill.style.width = `${safePercent}%`;
    }

    const progress = byId("project-progress");
    if (progress) {
        progress.setAttribute("aria-valuemin", "0");
        progress.setAttribute("aria-valuemax", "100");
        progress.setAttribute("aria-valuenow", String(safePercent));
    }
}

/* ==========================================================================
   FORMAT HELPERS
   ========================================================================== */

function normaliseProjectType(value) {
    return String(value || "mini").toLowerCase() === "major"
        ? "major"
        : "mini";
}

function normaliseProjectStatus(value) {
    const status = String(value || "draft").toLowerCase();

    return ["published", "draft", "unpublished"].includes(status)
        ? status
        : "draft";
}

function projectStatusClass(status) {
    if (status === "published") return "project-status-published";
    if (status === "draft") return "project-status-draft";
    return "project-status-unpublished";
}

function formatProjectCurrency(value) {
    if (value === null || value === undefined || value === "") {
        return "—";
    }

    const amount = Number(value);
    if (!Number.isFinite(amount)) return "—";

    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2
    }).format(amount);
}

function formatProjectDate(value) {
    if (!value) return "—";

    const date = new Date(String(value).replace(" ", "T"));
    if (Number.isNaN(date.getTime())) return "—";

    return new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    }).format(date);
}

function formatProjectNumber(value) {
    const number = Number(value);

    return Number.isFinite(number)
        ? new Intl.NumberFormat("en-IN").format(number)
        : "0";
}

function formatProjectBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) return "0 B";

    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unit = 0;

    while (size >= 1024 && unit < units.length - 1) {
        size /= 1024;
        unit++;
    }

    return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

/* ==========================================================================
   HTML ESCAPING
   ========================================================================== */

function escapeProjectText(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}

/* ==========================================================================
   TOAST NOTIFICATIONS
   ========================================================================== */

function showProjectToast(message, type = "info") {
    if (typeof showToast === "function") {
        showToast(message, type);
        return;
    }

    const container = byId("admin-toast-container");

    if (!container) {
        console[type === "error" ? "error" : "log"](message);
        return;
    }

    const toast = document.createElement("div");
    toast.className = "admin-toast active";

    if (type === "error") {
        toast.classList.add("toast-error");
    } else if (type === "success") {
        toast.classList.add("toast-success");
    }

    toast.setAttribute("role", type === "error" ? "alert" : "status");
    toast.textContent = message;
    container.appendChild(toast);

    window.setTimeout(() => {
        toast.classList.remove("active");

        window.setTimeout(() => {
            toast.remove();
        }, 250);
    }, 5000);
}
