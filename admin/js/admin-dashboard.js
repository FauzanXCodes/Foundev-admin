
"use strict";

document.addEventListener("DOMContentLoaded", () => {
    initDashboard();
});

const DASHBOARD_API = "../backend/api/admin/dashboard.php";
const SESSION_API = "../backend/api/admin/session.php";
const LOGOUT_API = "../backend/api/admin/logout.php";

let dashboardRefreshTimer = null;
let dashboardRequestInProgress = false;

function initDashboard() {
    initCopyrightYear();
    initCurrentDate();
    initSidebar();
    initLogout();

    initAdminProfile();
    loadDashboardData();

    // Keep metrics updated without requiring a page reload.
    dashboardRefreshTimer = window.setInterval(() => {
        loadDashboardData({ silent: true });
    }, 60000);

    window.addEventListener("beforeunload", () => {
        if (dashboardRefreshTimer) {
            window.clearInterval(dashboardRefreshTimer);
        }
    });
}

/* ---------------------------------------------------------
   Copyright year
--------------------------------------------------------- */

function initCopyrightYear() {
    document.querySelectorAll("[data-current-year]").forEach((element) => {
        element.textContent = new Date().getFullYear();
    });
}

/* ---------------------------------------------------------
   Current date
--------------------------------------------------------- */

function initCurrentDate() {
    const element = document.getElementById("admin-current-date");
    if (!element) return;

    element.textContent = new Intl.DateTimeFormat("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric"
    }).format(new Date());
}

/* ---------------------------------------------------------
   Admin profile and session verification
--------------------------------------------------------- */

async function initAdminProfile() {
    const nameElement = document.getElementById("admin-user-name");
    const avatarElement = document.getElementById("admin-user-avatar");

    try {
        const response = await fetch(SESSION_API, {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
            headers: { Accept: "application/json" }
        });

        const result = await response.json().catch(() => ({}));

        if (
            response.status === 401 ||
            !response.ok ||
            !result.success ||
            !result.authenticated
        ) {
            window.location.replace("login.html");
            return;
        }

        const admin = result.admin || {};
        const fullName = String(admin.full_name || "Administrator").trim();

        if (nameElement) {
            nameElement.textContent = fullName;
        }

        if (avatarElement) {
            avatarElement.textContent = getInitials(fullName);
        }
    } catch (error) {
        console.error("Unable to verify administrator session.", error);

        showAdminToast(
            "Unable to verify your session. Check your connection and reload.",
            "error"
        );
    }
}

function getInitials(name) {
    return String(name || "Administrator")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join("") || "A";
}

/* ---------------------------------------------------------
   Load dashboard API
--------------------------------------------------------- */

async function loadDashboardData(options = {}) {
    const { silent = false } = options;

    if (dashboardRequestInProgress) return;
    dashboardRequestInProgress = true;

    try {
        const response = await fetch(DASHBOARD_API, {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
            headers: { Accept: "application/json" }
        });

        const result = await response.json().catch(() => ({}));

        if (response.status === 401) {
            window.location.replace("login.html");
            return;
        }

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Unable to load dashboard data.");
        }

        renderMetrics(result.metrics || {});
        renderRecentApplications(result.applications || []);
        renderRecentProjects(result.projects || []);
        renderRecentActivity(result.activity || []);
        updatePendingBadge(result.metrics?.pending ?? 0);
        updateDataStatus(result.generated_at);

        // Use the API's authenticated admin profile if available.
        if (result.admin?.full_name) {
            const name = String(result.admin.full_name).trim();
            const nameElement = document.getElementById("admin-user-name");
            const avatarElement = document.getElementById("admin-user-avatar");

            if (nameElement) nameElement.textContent = name;
            if (avatarElement) avatarElement.textContent = getInitials(name);
        }
    } catch (error) {
        console.error("Dashboard data request failed.", error);

        if (!silent) {
            showAdminToast(
                error.message || "Unable to load dashboard data.",
                "error"
            );
        }

        setDataStatus("Unable to connect");
    } finally {
        dashboardRequestInProgress = false;
    }
}

/* ---------------------------------------------------------
   Metrics
--------------------------------------------------------- */

function renderMetrics(metrics) {
    const metricMap = {
        "metric-students": metrics.students,
        "metric-institutions": metrics.institutions,
        "metric-pending": metrics.pending,
        "metric-approved": metrics.approved,
        "metric-projects": metrics.projects,
        "metric-ai-analyses": metrics.aiAnalyses
    };

    Object.entries(metricMap).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (!element) return;

        const number = Number(value);
        element.textContent = Number.isFinite(number)
            ? new Intl.NumberFormat("en-IN").format(number)
            : "—";
    });
}

function updatePendingBadge(value) {
    const badge = document.getElementById("admin-pending-badge");
    if (!badge) return;

    const count = Math.max(0, Number(value) || 0);
    badge.textContent = new Intl.NumberFormat("en-IN").format(count);
    badge.hidden = count === 0;
    badge.setAttribute(
        "aria-label",
        `${count} pending institution applications`
    );
}

/* ---------------------------------------------------------
   Recent applications
--------------------------------------------------------- */

function renderRecentApplications(applications) {
    const tbody = document.getElementById("admin-recent-applications");
    if (!tbody) return;

    tbody.replaceChildren();

    if (!applications.length) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 4;

        const empty = document.createElement("div");
        empty.className = "admin-empty-state";

        const title = document.createElement("strong");
        title.textContent = "No applications yet";

        const description = document.createElement("p");
        description.textContent =
            "Submitted institution applications will appear here.";

        empty.append(title, description);
        cell.appendChild(empty);
        row.appendChild(cell);
        tbody.appendChild(row);
        return;
    }

    applications.forEach((application) => {
        const row = document.createElement("tr");

        const numberCell = document.createElement("td");
        numberCell.textContent = application.application_number || "—";

        const institutionCell = document.createElement("td");
        institutionCell.textContent =
            application.display_name ||
            application.official_name ||
            "Unnamed institution";

        const dateCell = document.createElement("td");
        dateCell.textContent = formatDate(application.activity_date);

        const statusCell = document.createElement("td");
        const status = document.createElement("span");
        status.className = `admin-status-badge ${getStatusClass(application.status)}`;
        status.textContent = formatStatus(application.status);
        statusCell.appendChild(status);

        row.append(numberCell, institutionCell, dateCell, statusCell);
        tbody.appendChild(row);
    });
}

/* ---------------------------------------------------------
   Recent projects
--------------------------------------------------------- */

function renderRecentProjects(projects) {
    const container = document.querySelector(".admin-project-empty");
    if (!container) return;

    container.replaceChildren();

    if (!projects.length) {
        const title = document.createElement("strong");
        title.textContent = "No projects yet";

        const description = document.createElement("p");
        description.textContent =
            "Projects created on Foundev will appear here.";

        const link = document.createElement("a");
        link.className = "admin-secondary-button";
        link.href = "projects.html";
        link.textContent = "Open projects";

        container.append(title, description, link);
        return;
    }

    const list = document.createElement("div");
    list.className = "admin-recent-project-list";

    projects.forEach((project) => {
        const item = document.createElement("div");
        item.className = "admin-recent-project-item";

        const copy = document.createElement("div");
        copy.className = "admin-recent-project-copy";

        const title = document.createElement("strong");
        title.textContent = project.title || "Untitled project";

        const meta = document.createElement("p");
        const creator = project.creator_name || "Unknown user";
        meta.textContent = `${creator} · ${formatDate(project.created_at)}`;

        const status = document.createElement("span");
        status.className = `admin-status-badge ${getStatusClass(project.status)}`;
        status.textContent = formatStatus(project.status);

        copy.append(title, meta);
        item.append(copy, status);
        list.appendChild(item);
    });

    const link = document.createElement("a");
    link.className = "admin-secondary-button";
    link.href = "projects.html";
    link.textContent = "View all projects";

    container.append(list, link);
}

/* ---------------------------------------------------------
   Recent activity
   This feed is derived from recent database records.
   It is not a dedicated audit log.
--------------------------------------------------------- */

function renderRecentActivity(activities) {
    const container = document.getElementById("admin-recent-activity");
    if (!container) return;

    container.replaceChildren();

    if (!activities.length) {
        const empty = document.createElement("div");
        empty.className = "admin-activity-empty";

        const title = document.createElement("strong");
        title.textContent = "No recent activity";

        const description = document.createElement("p");
        description.textContent =
            "New project and application activity will appear here.";

        empty.append(title, description);
        container.appendChild(empty);
        return;
    }

    activities.forEach((activity) => {
        const item = document.createElement("div");
        item.className = "admin-activity-item";

        const marker = document.createElement("span");
        marker.className = "admin-activity-marker";
        marker.setAttribute("aria-hidden", "true");
        marker.textContent = activity.type === "project" ? "P" : "I";

        const copy = document.createElement("div");
        copy.className = "admin-activity-copy";

        const title = document.createElement("strong");
        title.textContent = activity.title || "Platform activity";

        const description = document.createElement("p");
        description.textContent = activity.description || "";

        const meta = document.createElement("small");
        meta.textContent = [
            formatStatus(activity.status),
            formatDate(activity.date)
        ].filter(Boolean).join(" · ");

        copy.append(title, description, meta);
        item.append(marker, copy);
        container.appendChild(item);
    });
}

/* ---------------------------------------------------------
   Status and date helpers
--------------------------------------------------------- */

function formatStatus(value) {
    const status = String(value || "unknown")
        .replace(/[_-]+/g, " ")
        .trim();

    return status.replace(/\b\w/g, (character) => character.toUpperCase());
}

function getStatusClass(value) {
    const status = String(value || "").toLowerCase();

    if (["approved", "completed", "active", "ready_to_build"].includes(status)) {
        return "status-success";
    }

    if (["submitted", "under_review", "pending", "analyzed"].includes(status)) {
        return "status-pending";
    }

    if (["rejected", "suspended", "disabled", "archived"].includes(status)) {
        return "status-danger";
    }

    if (status === "changes_requested") {
        return "status-warning";
    }

    return "status-neutral";
}

function formatDate(value) {
    if (!value) return "—";

    // MySQL DATETIME strings are interpreted as local display dates.
    const date = new Date(String(value).replace(" ", "T"));

    if (Number.isNaN(date.getTime())) return "—";

    return new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
    }).format(date);
}

function updateDataStatus(generatedAt) {
    let label = "Live data connected";

    if (generatedAt) {
        label += ` · Updated ${new Intl.DateTimeFormat("en-IN", {
            hour: "2-digit",
            minute: "2-digit"
        }).format(new Date(generatedAt))}`;
    }

    setDataStatus(label);
}

function setDataStatus(message) {
    const element = document.querySelector(".admin-data-label");

    if (element) {
        element.textContent = message;
    }
}

/* ---------------------------------------------------------
   Responsive sidebar
--------------------------------------------------------- */

function initSidebar() {
    const sidebar = document.getElementById("admin-sidebar");
    const toggle = document.getElementById("admin-sidebar-toggle");
    const backdrop = document.getElementById("admin-sidebar-backdrop");

    if (!sidebar || !toggle) return;

    function closeSidebar() {
        sidebar.classList.remove("active");

        if (backdrop) backdrop.classList.remove("active");

        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Open navigation");
        document.body.classList.remove("admin-sidebar-open");
    }

    function openSidebar() {
        sidebar.classList.add("active");

        if (backdrop) backdrop.classList.add("active");

        toggle.setAttribute("aria-expanded", "true");
        toggle.setAttribute("aria-label", "Close navigation");
        document.body.classList.add("admin-sidebar-open");
    }

    toggle.addEventListener("click", () => {
        sidebar.classList.contains("active")
            ? closeSidebar()
            : openSidebar();
    });

    if (backdrop) backdrop.addEventListener("click", closeSidebar);

    sidebar.querySelectorAll(".admin-nav-link").forEach((link) => {
        link.addEventListener("click", () => {
            if (window.matchMedia("(max-width: 920px)").matches) {
                closeSidebar();
            }
        });
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeSidebar();
    });

    window.addEventListener("resize", () => {
        if (!window.matchMedia("(max-width: 920px)").matches) {
            closeSidebar();
        }
    });
}

/* ---------------------------------------------------------
   Logout
--------------------------------------------------------- */

function initLogout() {
    const logoutButton = document.getElementById("admin-logout-btn");
    if (!logoutButton) return;

    logoutButton.addEventListener("click", async () => {
        if (logoutButton.disabled) return;

        const originalText = logoutButton.innerHTML;
        logoutButton.disabled = true;
        logoutButton.textContent = "Signing out...";

        try {
            const response = await fetch(LOGOUT_API, {
                method: "POST",
                credentials: "same-origin",
                cache: "no-store",
                headers: { Accept: "application/json" }
            });

            const result = await response.json().catch(() => ({}));

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Unable to sign out.");
            }

            window.location.replace("login.html");
        } catch (error) {
            showAdminToast(
                error.message || "Unable to sign out. Please try again.",
                "error"
            );

            logoutButton.disabled = false;
            logoutButton.innerHTML = originalText;
        }
    });
}

/* ---------------------------------------------------------
   Toast notifications
--------------------------------------------------------- */

function showAdminToast(message, type = "info") {
    const container = document.getElementById("admin-toast-container");

    if (!container) {
        console[type === "error" ? "error" : "info"](message);
        return;
    }

    const toast = document.createElement("div");
    toast.className = "admin-toast active";

    if (type === "error") toast.classList.add("toast-error");
    if (type === "success") toast.classList.add("toast-success");

    toast.setAttribute("role", type === "error" ? "alert" : "status");
    toast.textContent = message;

    container.appendChild(toast);

    window.setTimeout(() => {
        toast.classList.remove("active");

        window.setTimeout(() => toast.remove(), 250);
    }, 4000);
}
