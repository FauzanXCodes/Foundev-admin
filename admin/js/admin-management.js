
"use strict";

document.addEventListener("DOMContentLoaded", () => {
    if (document.querySelector('[data-mgmt-table]')) {
        const heading = document.querySelector(".admin-page-title");
        const isStudentsPage =
            heading?.textContent.trim().toLowerCase() === "students";

        if (isStudentsPage) {
            initStudentsDirectory();
        } else {
            initInstitutionsDirectory();
        }
    }
});

/* =========================================================
   STUDENTS DIRECTORY
========================================================= */

const STUDENTS_API = "../backend/api/admin/students.php";

let studentSearchTimer = null;
let studentRequestController = null;

async function initStudentsDirectory() {
    const search = document.getElementById("mgmt-search");

    search?.addEventListener("input", () => {
        clearTimeout(studentSearchTimer);

        studentSearchTimer = setTimeout(() => {
            loadStudents(search.value.trim());
        }, 300);
    });

    addManagementRefreshButton(() => {
        loadStudents(
            document.getElementById("mgmt-search")?.value.trim() || ""
        );
    });

    await loadStudents();
}

async function loadStudents(search = "") {
    if (studentRequestController) {
        studentRequestController.abort();
    }

    studentRequestController = new AbortController();

    const tbody = document.querySelector("[data-mgmt-table] tbody");
    const refresh = document.getElementById("mgmt-refresh");

    if (!tbody) return;

    if (refresh) {
        refresh.disabled = true;
        refresh.textContent = "Loading…";
    }

    renderManagementMessage(
        tbody,
        "Loading registered users",
        "Retrieving records from Foundev…"
    );

    try {
        const query = new URLSearchParams({ search });

        const response = await fetch(`${STUDENTS_API}?${query}`, {
            credentials: "same-origin",
            cache: "no-store",
            headers: { Accept: "application/json" },
            signal: studentRequestController.signal
        });

        const data = await readManagementJson(response);

        if (response.status === 401) {
            window.location.href = "login.html";
            return;
        }

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Could not load users.");
        }

        renderStudentRows(tbody, data.users || []);
        updateManagementSubtitle(
            `${formatManagementNumber(data.summary?.total || 0)} registered platform users`
        );
        updateManagementIdentity(data.admin?.full_name);

    } catch (error) {
        if (error.name === "AbortError") return;

        console.error("[Foundev Students]", error);

        renderManagementMessage(
            tbody,
            "Unable to load users",
            error.message || "Please try again."
        );

        showManagementToast(error.message || "Could not load users.", "error");
    } finally {
        if (refresh) {
            refresh.disabled = false;
            refresh.textContent = "Refresh";
        }
    }
}

function renderStudentRows(tbody, users) {
    tbody.replaceChildren();

    if (!users.length) {
        renderManagementMessage(
            tbody,
            "No users found",
            "Try searching with a different name or email address."
        );
        return;
    }

    users.forEach((user) => {
        const row = document.createElement("tr");

        const studentCell = document.createElement("td");
        const name = document.createElement("strong");
        name.textContent = user.full_name || "Unnamed user";

        const id = document.createElement("small");
        id.className = "management-secondary";
        id.textContent = `User ID: ${user.id}`;

        studentCell.append(name, document.createElement("br"), id);

        const emailCell = document.createElement("td");
        emailCell.textContent = user.email || "—";

        // The current users table has no institution foreign key.
        const institutionCell = document.createElement("td");
        institutionCell.textContent = "Not linked";

        const statusCell = document.createElement("td");
        const status = document.createElement("span");
        status.className =
            `admin-status-badge ${getUserStatusClass(user.account_status)}`;
        status.textContent = formatUserStatus(user.account_status);
        statusCell.appendChild(status);

        const registeredCell = document.createElement("td");
        registeredCell.textContent = formatManagementDate(user.created_at);

        const actionCell = document.createElement("td");
        const viewButton = document.createElement("button");
        viewButton.type = "button";
        viewButton.className = "admin-btn admin-btn-light";
        viewButton.textContent = "View details";
        viewButton.addEventListener("click", () => {
            showStudentDetails(user);
        });
        actionCell.appendChild(viewButton);

        row.append(
            studentCell,
            emailCell,
            institutionCell,
            statusCell,
            registeredCell,
            actionCell
        );

        tbody.appendChild(row);
    });
}

function showStudentDetails(user) {
    const modal = getManagementModal();
    modal.replaceChildren();

    const panel = document.createElement("section");
    panel.className = "management-detail-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "management-detail-title");

    const header = document.createElement("header");
    header.className = "management-detail-header";

    const title = document.createElement("h2");
    title.id = "management-detail-title";
    title.textContent = "User details";

    const close = document.createElement("button");
    close.type = "button";
    close.className = "admin-btn admin-btn-light";
    close.textContent = "Close";
    close.addEventListener("click", closeManagementModal);

    header.append(title, close);

    const details = document.createElement("div");
    details.className = "management-detail-grid";

    const items = [
        ["User ID", user.id],
        ["Full name", user.full_name],
        ["Email", user.email],
        ["Account status", formatUserStatus(user.account_status)],
        ["Email verified", user.email_verified ? "Yes" : "No"],
        ["Onboarding completed", user.has_completed_onboarding ? "Yes" : "No"],
        ["Registered", formatManagementDate(user.created_at)],
        ["Last updated", formatManagementDate(user.updated_at)]
    ];

    items.forEach(([label, value]) => {
        const item = document.createElement("div");
        item.className = "management-detail-item";

        const key = document.createElement("span");
        key.className = "management-detail-label";
        key.textContent = label;

        const content = document.createElement("strong");
        content.textContent = String(value ?? "—");

        item.append(key, content);
        details.appendChild(item);
    });

    panel.append(header, details);
    modal.appendChild(panel);
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("admin-modal-open");
    close.focus();
}

function getManagementModal() {
    let modal = document.getElementById("management-detail-modal");

    if (!modal) {
        modal = document.createElement("div");
        modal.id = "management-detail-modal";
        modal.className = "management-detail-backdrop";
        modal.hidden = true;
        modal.setAttribute("aria-hidden", "true");

        modal.addEventListener("click", (event) => {
            if (event.target === modal) closeManagementModal();
        });

        document.body.appendChild(modal);

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") closeManagementModal();
        });
    }

    return modal;
}

function closeManagementModal() {
    const modal = document.getElementById("management-detail-modal");
    if (!modal) return;

    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("admin-modal-open");
}

/* =========================================================
   INSTITUTIONS DIRECTORY
   Preserves the existing institutions page functionality.
========================================================= */

const INSTITUTIONS_API = "../backend/api/admin/institutions.php";

let institutionSearchTimer = null;
let institutionRequestController = null;

async function initInstitutionsDirectory() {
    const search = document.getElementById("mgmt-search");

    search?.addEventListener("input", () => {
        clearTimeout(institutionSearchTimer);

        institutionSearchTimer = setTimeout(() => {
            loadInstitutions(search.value.trim());
        }, 300);
    });

    addManagementRefreshButton(() => {
        loadInstitutions(
            document.getElementById("mgmt-search")?.value.trim() || ""
        );
    });

    await loadInstitutions();
}

async function loadInstitutions(search = "") {
    if (institutionRequestController) {
        institutionRequestController.abort();
    }

    institutionRequestController = new AbortController();

    const tbody = document.querySelector("[data-mgmt-table] tbody");
    const refresh = document.getElementById("mgmt-refresh");

    if (!tbody) return;

    if (refresh) {
        refresh.disabled = true;
        refresh.textContent = "Loading…";
    }

    renderManagementMessage(
        tbody,
        "Loading institutions",
        "Retrieving approved institution records…"
    );

    try {
        const query = new URLSearchParams({ search });

        const response = await fetch(`${INSTITUTIONS_API}?${query}`, {
            credentials: "same-origin",
            cache: "no-store",
            headers: { Accept: "application/json" },
            signal: institutionRequestController.signal
        });

        const data = await readManagementJson(response);

        if (response.status === 401) {
            window.location.href = "login.html";
            return;
        }

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Could not load institutions.");
        }

        renderInstitutionRows(tbody, data.institutions || []);
        updateManagementSubtitle(
            `${formatManagementNumber(data.count || 0)} approved application records`
        );
        updateManagementIdentity(data.admin?.full_name);

    } catch (error) {
        if (error.name === "AbortError") return;

        console.error("[Foundev Institutions]", error);

        renderManagementMessage(
            tbody,
            "Unable to load institutions",
            error.message || "Please try again."
        );

        showManagementToast(error.message || "Could not load institutions.", "error");
    } finally {
        if (refresh) {
            refresh.disabled = false;
            refresh.textContent = "Refresh";
        }
    }
}

function renderInstitutionRows(tbody, institutions) {
    tbody.replaceChildren();

    if (!institutions.length) {
        renderManagementMessage(
            tbody,
            "No approved institutions found",
            "Approved application records will appear here."
        );
        return;
    }

    institutions.forEach((institution) => {
        const row = document.createElement("tr");

        const nameCell = document.createElement("td");
        const name = document.createElement("strong");
        name.textContent = institution.name || "Unnamed institution";

        const reference = document.createElement("small");
        reference.className = "management-secondary";
        reference.textContent = institution.application_number || "—";
        nameCell.append(name, document.createElement("br"), reference);

        const typeCell = document.createElement("td");
        typeCell.textContent = formatUserStatus(institution.type);

        const locationCell = document.createElement("td");
        locationCell.textContent = [
            institution.city,
            institution.state_region,
            institution.country
        ].filter(Boolean).join(", ") || "—";

        const statusCell = document.createElement("td");
        const badge = document.createElement("span");
        badge.className = "admin-status-badge status-success";
        badge.textContent = "Approved application";
        statusCell.appendChild(badge);

        const dateCell = document.createElement("td");
        dateCell.textContent = formatManagementDate(institution.created_at);

        const actionCell = document.createElement("td");
        const button = document.createElement("button");
        button.type = "button";
        button.className = "admin-btn admin-btn-light";
        button.textContent = "View application";
        button.addEventListener("click", () => {
            window.location.href =
                `institute-applications.html?application=${encodeURIComponent(institution.id)}`;
        });
        actionCell.appendChild(button);

        row.append(nameCell, typeCell, locationCell, statusCell, dateCell, actionCell);
        tbody.appendChild(row);
    });
}

/* =========================================================
   SHARED HELPERS
========================================================= */

function addManagementRefreshButton(onClick) {
    const toolbar = document.querySelector(".admin-toolbar-group");
    if (!toolbar || document.getElementById("mgmt-refresh")) return;

    const button = document.createElement("button");
    button.id = "mgmt-refresh";
    button.type = "button";
    button.className = "admin-btn admin-btn-light";
    button.textContent = "Refresh";
    button.addEventListener("click", onClick);
    toolbar.appendChild(button);
}

async function readManagementJson(response) {
    const text = await response.text();

    try {
        return JSON.parse(text);
    } catch {
        throw new Error(
            response.ok
                ? "The server returned an invalid response."
                : `Server error (${response.status}). Check the PHP error log.`
        );
    }
}

function renderManagementMessage(tbody, title, description) {
    tbody.replaceChildren();

    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6;

    const empty = document.createElement("div");
    empty.className = "admin-empty-state";

    const heading = document.createElement("p");
    heading.className = "admin-empty-state-title";
    heading.textContent = title;

    const subtitle = document.createElement("p");
    subtitle.className = "admin-empty-state-subtitle";
    subtitle.textContent = description;

    empty.append(heading, subtitle);
    cell.appendChild(empty);
    row.appendChild(cell);
    tbody.appendChild(row);
}

function updateManagementSubtitle(text) {
    const subtitle = document.querySelector(".admin-card-subtitle");
    if (subtitle) subtitle.textContent = text;
}

function updateManagementIdentity(fullName) {
    if (!fullName) return;

    const name = document.querySelector(".admin-user-name");
    const avatar = document.querySelector(".admin-user-avatar");

    if (name) name.textContent = fullName;

    if (avatar) {
        avatar.textContent = fullName
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map(part => part[0])
            .join("")
            .toUpperCase();
    }
}

function formatManagementNumber(value) {
    return new Intl.NumberFormat("en-IN").format(Number(value || 0));
}

function formatManagementDate(value) {
    if (!value) return "—";

    const date = new Date(String(value).replace(" ", "T"));
    if (Number.isNaN(date.getTime())) return "—";

    return new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    }).format(date);
}

function formatUserStatus(value) {
    return String(value || "Unknown")
        .replaceAll("_", " ")
        .replace(/\b\w/g, letter => letter.toUpperCase());
}

function getUserStatusClass(status) {
    const classes = {
        active: "status-success",
        pending: "status-pending",
        suspended: "status-warning",
        disabled: "status-danger"
    };

    return classes[status] || "status-neutral";
}

function showManagementToast(message, type = "info") {
    const container = document.getElementById("admin-toast-container");

    if (!container) {
        console.log(`[Foundev Admin: ${type}]`, message);
        return;
    }

    const toast = document.createElement("div");
    toast.className = `admin-toast admin-toast-${type}`;
    toast.textContent = message;
    toast.setAttribute("role", type === "error" ? "alert" : "status");
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add("is-leaving");
        setTimeout(() => toast.remove(), 250);
    }, 3500);
}
