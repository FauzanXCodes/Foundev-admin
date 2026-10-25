"use strict";

document.addEventListener("DOMContentLoaded", () => {
    checkAdminSession().catch(() => {
        // Ignore
    });
    initSidebarToggle();
    initCopyrightYear();
    initLogout();
    setupCurrentYearElements();
});

async function checkAdminSession() {
    try {
        const response = await fetch("../backend/api/admin/session.php", {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
            headers: {
                Accept: "application/json",
            },
        });

        let result = {};
        try {
            result = await response.json();
        } catch (e) {
            result = {};
        }

        const isAuthenticated = response.ok && result.authenticated && result.success;
        if (!isAuthenticated) {
            window.location.replace("login.html");
        }
    } catch (error) {
        window.location.replace("login.html");
    }
}

function setupCurrentYearElements() {
    document.querySelectorAll("[data-current-year]").forEach((el) => {
        el.textContent = new Date().getFullYear();
    });
}

function initCopyrightYear() {
    setupCurrentYearElements();
}

function initSidebarToggle() {
    const toggle = document.getElementById("admin-sidebar-toggle");
    const sidebar = document.getElementById("admin-sidebar");
    const backdrop = document.getElementById("admin-sidebar-backdrop");

    if (!toggle || !sidebar) return;

    const closeSidebar = () => {
        sidebar.classList.remove("active");
        if (backdrop) {
            backdrop.classList.remove("active");
        }
        document.body.style.overflow = "";
    };

    const openSidebar = () => {
        sidebar.classList.add("active");
        if (backdrop) {
            backdrop.classList.add("active");
        }
        document.body.style.overflow = "hidden";
    };

    toggle.addEventListener("click", () => {
        const isActive = sidebar.classList.contains("active");
        if (isActive) {
            closeSidebar();
        } else {
            openSidebar();
        }
    });

    if (backdrop) {
        backdrop.addEventListener("click", closeSidebar);
    }

    window.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            closeSidebar();
        }
    });

    window.addEventListener("resize", () => {
        if (window.innerWidth > 920) {
            closeSidebar();
        }
    });
}

function showToast(message, type = "info") {
    const container = document.getElementById("admin-toast-container");
    if (!container) {
        console.warn(message);
        return;
    }

    const toast = document.createElement("div");
    toast.className = "admin-toast";
    if (type === "error") toast.classList.add("toast-error");
    if (type === "success") toast.classList.add("toast-success");
    toast.textContent = message;

    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add("active");
    });

    setTimeout(() => {
        toast.classList.remove("active");
        setTimeout(() => {
            toast.remove();
        }, 200);
    }, 2500);
}

async function initLogout() {
    const logoutBtn = document.getElementById("admin-logout-btn");
    if (!logoutBtn) return;

    logoutBtn.addEventListener("click", async () => {
        if (logoutBtn.dataset.loading === "true") return;

        const originalText = logoutBtn.innerHTML;
        logoutBtn.dataset.loading = "true";
        logoutBtn.disabled = true;
        logoutBtn.textContent = "Signing out...";

        try {
            const response = await fetch("../backend/api/admin/logout.php", {
                method: "POST",
                credentials: "same-origin",
                cache: "no-store",
                headers: {
                    Accept: "application/json",
                },
            });

            let result = { success: true };
            try {
                result = await response.json();
            } catch (e) {
                // Ignore
            }

            window.location.assign("login.html");
        } catch (error) {
            showToast("Failed to sign out. Please try again.", "error");
        } finally {
            logoutBtn.disabled = false;
            logoutBtn.innerHTML = originalText;
            delete logoutBtn.dataset.loading;
        }
    });
}
