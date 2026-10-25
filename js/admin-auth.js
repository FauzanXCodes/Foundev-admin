"use strict";

document.addEventListener("DOMContentLoaded", () => {
    checkAdminSessionIfLoggedIn().catch(() => {});
    initAdminLogin();
    initPasswordToggles();
    initCopyrightYear();
});

async function checkAdminSessionIfLoggedIn() {
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
        if (isAuthenticated) {
            window.location.replace("dashboard.html");
        }
    } catch (error) {
        // Do nothing
    }
}

function initCopyrightYear() {
    document.querySelectorAll("[data-current-year]").forEach((element) => {
        element.textContent = new Date().getFullYear();
    });
}

function showMessage(element, message, type = "info") {
    if (!element) return;
    element.textContent = message;
    element.dataset.type = type;
}

function setButtonLoading(button, loading, loadingText = "Please wait...") {
    if (!button) return;

    if (loading) {
        if (button.dataset.loading === "true") return;
        button.dataset.originalText = button.innerHTML;
        button.dataset.loading = "true";
        button.disabled = true;
        button.textContent = loadingText;
    } else {
        button.disabled = false;
        if (button.dataset.originalText !== undefined) {
            button.innerHTML = button.dataset.originalText;
            delete button.dataset.originalText;
        }
        delete button.dataset.loading;
    }
}

function initPasswordToggles() {
    document.querySelectorAll("[data-password-toggle]").forEach((button) => {
        button.addEventListener("click", () => {
            const input = document.getElementById(button.dataset.passwordToggle);
            if (!input) return;
            const show = input.type === "password";
            input.type = show ? "text" : "password";
            button.textContent = show ? "Hide" : "Show";
            button.setAttribute("aria-label", show ? "Hide password" : "Show password");
        });
    });
}

async function postJson(url, data) {
    const response = await fetch(url, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        body: JSON.stringify(data),
    });

    let result;
    try {
        result = await response.json();
    } catch (e) {
        throw new Error("The server returned an invalid response.");
    }

    if (!response.ok || !result.success) {
        throw new Error(result.message || "Something went wrong. Please try again.");
    }

    return result;
}

function initAdminLogin() {
    const form = document.getElementById("admin-login-form");
    if (!form) return;

    const emailField = form.querySelector('[name="email"]');
    const passwordField = form.querySelector('[name="password"]');
    const message = document.getElementById("admin-login-message");
    const submit = form.querySelector('[type="submit"]');

    if (!emailField || !passwordField || !submit) return;

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (submit.dataset.loading === "true") return;
        if (!form.reportValidity()) return;

        const email = emailField.value.trim();
        const password = passwordField.value;

        if (!email || !password) {
            showMessage(message, "Please enter your email and password.", "error");
            return;
        }

        setButtonLoading(submit, true, "Signing in...");
        showMessage(message, "");

        try {
            const result = await postJson("../backend/api/admin/login.php", {
                email,
                password,
            });

            showMessage(message, result.message || "Login successful.", "success");
            window.location.assign("dashboard.html");
        } catch (error) {
            showMessage(message, error.message || "Login failed.", "error");
        } finally {
            setButtonLoading(submit, false);
        }
    });
}
