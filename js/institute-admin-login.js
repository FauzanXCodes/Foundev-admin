
"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("institute-admin-login-form");
    const emailField = document.getElementById("institute-admin-email");
    const passwordField = document.getElementById("institute-admin-password");
    const submitButton = document.getElementById("institute-admin-login-submit");
    const message = document.getElementById("institute-admin-login-message");

    const year = document.querySelector("[data-current-year]");

    const LOGIN_API = "../backend/auth/institute-admin-login.php";

    // Works when Foundev is installed directly in the web root.
    // If your project is in /foundev/, include that prefix here.
    const DASHBOARD_PATH = "/institute-users/admin/dashboard.html";

    if (year) {
        year.textContent = new Date().getFullYear();
    }

    if (!form || !emailField || !passwordField || !submitButton || !message) {
        console.error(
            "[Foundev Institute Login] One or more required HTML elements are missing."
        );
        return;
    }

    function showMessage(text, type = "error") {
        message.textContent = text;
        message.className = "form-message";

        message.classList.add(
            type === "success"
                ? "institute-login-success"
                : "institute-login-error"
        );

        message.setAttribute("role", "alert");
        message.setAttribute("aria-live", "polite");
    }

    function setLoading(loading) {
        submitButton.disabled = loading;
        submitButton.textContent = loading
            ? "Signing in..."
            : "Sign in to institution portal";

        form.setAttribute("aria-busy", loading ? "true" : "false");
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (submitButton.disabled || !form.reportValidity()) {
            return;
        }

        const email = emailField.value.trim();
        const password = passwordField.value;
console.log("[Foundev Login Debug]", {
    passwordFieldFound: !!passwordField,
    passwordLength: password.length,
    email: emailField.value.trim()
});
        if (!email || !password) {
            showMessage("Enter your official email and password.");
            return;
        }

        setLoading(true);
        message.textContent = "";
        message.className = "form-message";

        try {
            const response = await fetch(LOGIN_API, {
                method: "POST",
                credentials: "same-origin",
                cache: "no-store",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify({ email, password })
            });

            let result;

            try {
                result = await response.json();
            } catch {
                throw new Error(
                    "The server returned an invalid response. Check the PHP error log."
                );
            }

            if (!response.ok || result.success !== true) {
                showMessage(
                    result.message || "Unable to sign in. Please try again."
                );
                return;
            }

            if (result.account_type !== "institute_admin") {
                showMessage("The server returned an unexpected account type.");
                return;
            }

            // Ensure the API and frontend agree on the destination.
            if (result.redirect !== DASHBOARD_PATH) {
                showMessage(
                    "Dashboard path mismatch. Check the redirect in the institute login PHP API."
                );
                console.error("Expected redirect:", DASHBOARD_PATH);
                console.error("API redirect:", result.redirect);
                return;
            }

            showMessage(
                result.message || "Login successful. Redirecting...",
                "success"
            );

            passwordField.value = "";
            window.location.assign(DASHBOARD_PATH);

        } catch (error) {
            console.error(
                "[Foundev Institute Login] Request failed:",
                error
            );

            showMessage(
                error instanceof TypeError
                    ? "Unable to connect to Foundev. Check your XAMPP server and try again."
                    : (error.message || "A server error occurred. Please try again.")
            );

        } finally {
            setLoading(false);
        }
    });
});
