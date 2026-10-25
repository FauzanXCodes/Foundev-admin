
/* =========================================================
   FOUNDEV — STUDENT LOGIN
   File: js/institute-student-login.js

   Expected endpoint:
   ../backend/api/institute-students/login.php
   ========================================================= */

"use strict";

document.addEventListener("DOMContentLoaded", initializeStudentLogin);

function initializeStudentLogin() {
    const $ = (id) => document.getElementById(id);

    const form = $("student-login-form");
    const emailInput = $("student-email");
    const passwordInput = $("student-password");
    const rememberEmail = $("remember-email");
    const submitButton = $("student-login-submit");
    const alertBox = $("login-alert");

    if (!form || !emailInput || !passwordInput || !submitButton) {
        console.error("Foundev login: required HTML elements are missing.");
        return;
    }

    const LOGIN_API = "../backend/api/institute-students/login.php";

    let submitting = false;

    /* -----------------------------------------
       Alert messages
       ----------------------------------------- */

    function showAlert(message, type = "error") {
        alertBox.textContent = message;
        alertBox.className = `auth-alert auth-alert-${type}`;
        alertBox.hidden = false;
        alertBox.setAttribute("role", "alert");
        alertBox.setAttribute("aria-live", "polite");
    }

    function clearAlert() {
        alertBox.textContent = "";
        alertBox.className = "auth-alert";
        alertBox.hidden = true;
    }

    /* -----------------------------------------
       Button loading state
       ----------------------------------------- */

    function setLoading(isLoading) {
        if (isLoading) {
            submitButton.dataset.originalText =
                submitButton.textContent.trim();

            submitButton.disabled = true;
            submitButton.classList.add("is-loading");
            submitButton.setAttribute("aria-busy", "true");
            submitButton.textContent = "Signing in...";
        } else {
            submitButton.disabled = false;
            submitButton.classList.remove("is-loading");
            submitButton.removeAttribute("aria-busy");

            submitButton.innerHTML =
                '<span>Log in to student workspace</span>' +
                '<span aria-hidden="true">→</span>';
        }
    }

    /* -----------------------------------------
       Email validation
       ----------------------------------------- */

    function validEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    /* -----------------------------------------
       Password visibility
       ----------------------------------------- */

    document.querySelectorAll("[data-toggle-password]").forEach((button) => {
        button.addEventListener("click", () => {
            const input = $(button.dataset.togglePassword);

            if (!input) return;

            const shouldShow = input.type === "password";

            input.type = shouldShow ? "text" : "password";
            button.textContent = shouldShow ? "Hide" : "Show";

            button.setAttribute(
                "aria-label",
                shouldShow ? "Hide password" : "Show password"
            );

            button.setAttribute(
                "aria-pressed",
                String(shouldShow)
            );
        });
    });

    /* -----------------------------------------
       Remember email
       ----------------------------------------- */

    /*
     * This intentionally remembers only the email,
     * never the password.
     */

    try {
        const savedEmail = localStorage.getItem("foundev_student_email");

        if (savedEmail) {
            emailInput.value = savedEmail;

            if (rememberEmail) {
                rememberEmail.checked = true;
            }
        }
    } catch (error) {
        console.warn("Browser storage is unavailable.");
    }

    /* -----------------------------------------
       API request
       ----------------------------------------- */

    async function postLogin(payload) {
        let response;

        try {
            response = await fetch(LOGIN_API, {
                method: "POST",
                credentials: "same-origin",
                cache: "no-store",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify(payload)
            });
        } catch (error) {
            throw new Error(
                "Unable to connect to Foundev. Check that your server is running."
            );
        }

        const responseText = await response.text();

        let data;

        try {
            data = responseText ? JSON.parse(responseText) : {};
        } catch (error) {
            console.error("Invalid login API response:", responseText);

            throw new Error(
                "The server returned an invalid response. Check the PHP error log."
            );
        }

        if (!response.ok || data.success !== true) {
            throw new Error(
                data.message ||
                data.error ||
                "Login failed. Check your email and password."
            );
        }

        return data;
    }

    /* -----------------------------------------
       Submit login
       ----------------------------------------- */

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (submitting) return;

        clearAlert();

        const email = emailInput.value.trim().toLowerCase();
        const password = passwordInput.value;

        emailInput.removeAttribute("aria-invalid");
        passwordInput.removeAttribute("aria-invalid");

        if (!email || !validEmail(email)) {
            showAlert("Please enter a valid email address.");
            emailInput.setAttribute("aria-invalid", "true");
            emailInput.focus();
            return;
        }

        if (!password) {
            showAlert("Please enter your password.");
            passwordInput.setAttribute("aria-invalid", "true");
            passwordInput.focus();
            return;
        }

        submitting = true;
        setLoading(true);

        try {
            const data = await postLogin({
                email,
                password
            });

            /*
             * Store the email only if the student selected
             * "Remember my email on this device".
             */
            try {
                if (rememberEmail && rememberEmail.checked) {
                    localStorage.setItem("foundev_student_email", email);
                } else {
                    localStorage.removeItem("foundev_student_email");
                }
            } catch (error) {
                console.warn("Could not save the email preference.");
            }

            showAlert(
                data.message || "Login successful. Redirecting...",
                "success"
            );

            /*
             * The redirect must come from a trusted,
             * same-origin destination supplied by your API.
             */
            const redirect = data.redirect;

            if (redirect) {
                const destination = new URL(redirect, window.location.href);

                if (destination.origin !== window.location.origin) {
                    throw new Error("The server returned an invalid redirect.");
                }

                window.location.assign(destination.href);
            } else {
                /*
                 * Change this fallback to the actual student
                 * dashboard path in your project.
                 */
                window.location.assign(
                    "../pages/institute-student-dashboard.html"
                );
            }

        } catch (error) {
            console.error("Student login failed:", error);

            showAlert(
                error.message ||
                "Unable to log in. Please try again."
            );
        } finally {
            submitting = false;
            setLoading(false);
        }
    });

    emailInput.addEventListener("input", () => {
        emailInput.removeAttribute("aria-invalid");
    });

    passwordInput.addEventListener("input", () => {
        passwordInput.removeAttribute("aria-invalid");
    });

    console.log("Foundev student login initialized.");
}
