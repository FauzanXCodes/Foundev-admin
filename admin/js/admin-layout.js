
"use strict";

document.addEventListener("DOMContentLoaded", () => {
    initSidebarToggle();
    initCopyrightYear();
    initLogout();
    checkAdminSession();
});

/* =========================================================
   ADMIN SESSION PROTECTION
========================================================= */

async function checkAdminSession() {
    try {
        const response = await fetch("../backend/api/admin/session.php", {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
            headers: {
                Accept: "application/json"
            }
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok || !result.success || !result.authenticated) {
            window.location.replace("login.html");
            return;
        }

        updateAdminProfile(result.admin || {});
    } catch (error) {
        console.error("Admin session verification failed.", error);
        window.location.replace("login.html");
    }
}

/* =========================================================
   ADMIN PROFILE
========================================================= */

function updateAdminProfile(admin) {
    const nameElement = document.getElementById("admin-user-name");
    const avatarElement = document.getElementById("admin-user-avatar");

    const fullName = String(admin.full_name || "Administrator").trim();

    if (nameElement) {
        nameElement.textContent = fullName;
    }

    if (avatarElement) {
        const initials = fullName
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part.charAt(0).toUpperCase())
            .join("");

        avatarElement.textContent = initials || "A";
    }
}

/* =========================================================
   COPYRIGHT YEAR
========================================================= */

function initCopyrightYear() {
    document.querySelectorAll("[data-current-year]").forEach((element) => {
        element.textContent = new Date().getFullYear();
    });
}

/* =========================================================
   RESPONSIVE SIDEBAR
========================================================= */

function initSidebarToggle() {
    const toggle = document.getElementById("admin-sidebar-toggle");
    const sidebar = document.getElementById("admin-sidebar");
    const backdrop = document.getElementById("admin-sidebar-backdrop");

    if (!toggle || !sidebar) return;

    function openSidebar() {
        sidebar.classList.add("active");

        if (backdrop) {
            backdrop.classList.add("active");
        }

        toggle.setAttribute("aria-expanded", "true");
        toggle.setAttribute("aria-label", "Close navigation");

        document.body.classList.add("admin-sidebar-open");
        document.body.style.overflow = "hidden";
    }

    function closeSidebar() {
        sidebar.classList.remove("active");

        if (backdrop) {
            backdrop.classList.remove("active");
        }

        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Open navigation");

        document.body.classList.remove("admin-sidebar-open");
        document.body.style.overflow = "";
    }

    toggle.addEventListener("click", () => {
        if (sidebar.classList.contains("active")) {
            closeSidebar();
        } else {
            openSidebar();
        }
    });

    if (backdrop) {
        backdrop.addEventListener("click", closeSidebar);
    }

    sidebar.querySelectorAll(".admin-nav-link").forEach((link) => {
        link.addEventListener("click", () => {
            if (window.matchMedia("(max-width: 920px)").matches) {
                closeSidebar();
            }
        });
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeSidebar();
        }
    });

    window.addEventListener("resize", () => {
        if (window.innerWidth > 920) {
            closeSidebar();
        }
    });
}

/* =========================================================
   TOAST NOTIFICATIONS
========================================================= */

function showToast(message, type = "info") {
    const container = document.getElementById("admin-toast-container");

    if (!container) {
        console[type === "error" ? "error" : "info"](message);
        return;
    }

    const toast = document.createElement("div");
    toast.className = "admin-toast";

    if (type === "error") {
        toast.classList.add("toast-error");
    } else if (type === "success") {
        toast.classList.add("toast-success");
    }

    toast.setAttribute(
        "role",
        type === "error" ? "alert" : "status"
    );

    toast.textContent = message;
    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add("active");
    });

    window.setTimeout(() => {
        toast.classList.remove("active");

        window.setTimeout(() => {
            toast.remove();
        }, 250);
    }, 3000);
}

/* =========================================================
   ADMIN LOGOUT
========================================================= */

function initLogout() {
    const logoutButton = document.getElementById("admin-logout-btn");

    if (!logoutButton) return;

    logoutButton.addEventListener("click", async () => {
        if (logoutButton.dataset.loading === "true") return;

        const originalContent = logoutButton.innerHTML;

        logoutButton.dataset.loading = "true";
        logoutButton.disabled = true;
        logoutButton.textContent = "Signing out...";

        try {
            const response = await fetch("../backend/api/admin/logout.php", {
                method: "POST",
                credentials: "same-origin",
                cache: "no-store",
                headers: {
                    Accept: "application/json"
                }
            });

            const result = await response.json().catch(() => ({}));

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message || "Unable to sign out."
                );
            }

            window.location.replace("login.html");
        } catch (error) {
            showToast(
                error.message || "Failed to sign out. Please try again.",
                "error"
            );

            logoutButton.disabled = false;
            logoutButton.innerHTML = originalContent;

            delete logoutButton.dataset.loading;
        }
    });
}
