"use strict";

document.addEventListener("DOMContentLoaded", () => {
    initCopyrightYear();
    initEmailFormToggle();
    initPasswordToggles();
    initSignup();
    initOtpVerification();
    initResendOtp();
    initLogin();
});

// ==================================================
// SHARED HELPERS
// ==================================================

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

async function postForm(url, data) {
    const response = await fetch(url, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        body: JSON.stringify(data)
    });

    let result;

    try {
        result = await response.json();
    } catch {
        throw new Error("The server returned an invalid response.");
    }

    if (!response.ok || !result.success) {
        throw new Error(
            result.message || "Something went wrong. Please try again."
        );
    }

    return result;
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

// ==================================================
// EMAIL SIGNUP FORM TOGGLE
// ==================================================

function initEmailFormToggle() {
    const toggle = document.getElementById("email-toggle");
    const form = document.getElementById("email-signup-form");

    if (!toggle || !form) return;

    toggle.addEventListener("click", () => {
        const isExpanded = toggle.getAttribute("aria-expanded") === "true";

        toggle.setAttribute("aria-expanded", String(!isExpanded));
        form.hidden = isExpanded;

        const icon = toggle.querySelector("span");

        if (icon) {
            icon.textContent = isExpanded ? "+" : "−";
        }
    });
}

// ==================================================
// PASSWORD VISIBILITY
// ==================================================

function initPasswordToggles() {
    document.querySelectorAll("[data-password-toggle]").forEach((button) => {
        button.addEventListener("click", () => {
            const input = document.getElementById(
                button.dataset.passwordToggle
            );

            if (!input) return;

            const show = input.type === "password";

            input.type = show ? "text" : "password";
            button.textContent = show ? "Hide" : "Show";

            button.setAttribute(
                "aria-label",
                show ? "Hide password" : "Show password"
            );
        });
    });
}

// ==================================================
// SIGNUP
// ==================================================

function initSignup() {
    const form = document.getElementById("email-signup-form");

    if (!form) return;

    const message = document.getElementById("signup-message");
    const submit = form.querySelector('[type="submit"]');

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (submit?.dataset.loading === "true") return;
        if (!form.reportValidity()) return;

        const consent = form.querySelector('[name="terms"]');

        if (!consent || !consent.checked) {
            showMessage(
                message,
                "Please accept the Terms of Service and Privacy Policy.",
                "error"
            );
            return;
        }

        const fullName = form.elements.full_name.value.trim();
        const email = form.elements.email.value.trim();
        const password = form.elements.password.value;

        if (fullName.length < 2) {
            showMessage(message, "Please enter your full name.", "error");
            return;
        }

        if (password.length < 8) {
            showMessage(
                message,
                "Your password must be at least 8 characters.",
                "error"
            );
            return;
        }

        setButtonLoading(submit, true, "Creating account...");
        showMessage(message, "");

        try {
            const result = await postForm(
                "../backend/auth/signup.php",
                {
                    full_name: fullName,
                    email,
                    password,
                    terms: true
                }
            );

            sessionStorage.setItem("foundev_verification_email", email);

            showMessage(
                message,
                result.message || "Verification code sent. Redirecting...",
                "success"
            );

            window.location.assign("verify-email.html");
        } catch (error) {
            showMessage(message, error.message, "error");
        } finally {
            setButtonLoading(submit, false);
        }
    });
}

// ==================================================
// OTP VERIFICATION
// ==================================================

function initOtpVerification() {
    const form = document.getElementById("otp-form");

    if (!form) return;

    const emailField = document.getElementById("otp-email");
    const emailDisplay = document.getElementById("verification-email");
    const otpInput = document.getElementById("otp-code");
    const message = document.getElementById("otp-message");
    const submit = form.querySelector('[type="submit"]');

    if (!emailField || !otpInput) return;

    const savedEmail = sessionStorage.getItem(
        "foundev_verification_email"
    );

    if (savedEmail) {
        emailField.value = savedEmail;

        if (emailDisplay) {
            emailDisplay.textContent = savedEmail;
        }
    }

    otpInput.addEventListener("input", () => {
        otpInput.value = otpInput.value.replace(/\D/g, "").slice(0, 6);
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (submit?.dataset.loading === "true") return;
        if (!form.reportValidity()) return;

        const email = emailField.value.trim();
        const otp = otpInput.value.trim();

        if (!email) {
            showMessage(
                message,
                "Your verification session is missing. Please return to signup or request a new code.",
                "error"
            );
            return;
        }

        if (!/^\d{6}$/.test(otp)) {
            showMessage(
                message,
                "Enter the six-digit verification code.",
                "error"
            );
            return;
        }

        setButtonLoading(submit, true, "Verifying...");
        showMessage(message, "");

        try {
            const result = await postForm(
                "../backend/auth/verify-otp.php",
                { email, otp }
            );

            sessionStorage.removeItem("foundev_verification_email");

            showMessage(
                message,
                result.message || "Email verified successfully.",
                "success"
            );

            window.location.assign(result.redirect || "login.html");
        } catch (error) {
            showMessage(message, error.message, "error");
        } finally {
            setButtonLoading(submit, false);
        }
    });
}

// ==================================================
// RESEND OTP
// ==================================================

function initResendOtp() {
    const button = document.getElementById("resend-otp");

    if (!button) return;

    const message = document.getElementById("resend-message");
    const emailField = document.getElementById("otp-email");

    if (!emailField) return;

    button.addEventListener("click", async () => {
        if (button.dataset.loading === "true") return;

        const email = emailField.value.trim();

        if (!email) {
            showMessage(
                message,
                "Your verification session is missing. Please return to signup.",
                "error"
            );
            return;
        }

        setButtonLoading(button, true, "Sending...");
        showMessage(message, "");

        try {
            const result = await postForm(
                "../backend/auth/send-otp.php",
                { email }
            );

            showMessage(
                message,
                result.message ||
                    "If the account can receive a code, it will be sent shortly.",
                "success"
            );
        } catch (error) {
            showMessage(message, error.message, "error");
        } finally {
            setButtonLoading(button, false);
        }
    });
}

// ==================================================
// LOGIN
// ==================================================



function initLogin() {
    const form = document.getElementById("login-form");

    if (!form) return;

    const emailField = form.querySelector('[name="email"]');
    const passwordField = form.querySelector('[name="password"]');
    const message = document.getElementById("login-message");
    const submit = form.querySelector('[type="submit"]');

    if (!emailField || !passwordField || !submit) return;

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (submit.dataset.loading === "true") return;
        if (!form.reportValidity()) return;

        const email = emailField.value.trim();
        const password = passwordField.value;

        if (!email || !password) {
            showMessage(
                message,
                "Enter your email address and password.",
                "error"
            );
            return;
        }

        setButtonLoading(submit, true, "Signing in...");
        showMessage(message, "");

        try {
            const response = await fetch(
                "../backend/auth/login.php",
                {
                    method: "POST",
                    credentials: "same-origin",
                    cache: "no-store",
                    headers: {
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    },
                    body: JSON.stringify({
                        email: email,
                        password: password
                    })
                }
            );

            const responseText = await response.text();

let result;

try {
    result = JSON.parse(responseText);
} catch (error) {
    console.error("Foundev login returned invalid JSON.");
    console.error("HTTP status:", response.status);
    console.error("Response body:", responseText);

    throw new Error(
        responseText.trim()
            ? "The server returned an invalid response. Check the browser console."
            : "The server returned an empty response. Check the PHP error log."
    );
}

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message || "Login failed. Please try again."
                );
            }

            showMessage(
                message,
                result.message || "Login successful.",
                "success"
            );

            window.location.assign(
                result.redirect || "../index.html"
            );

        } catch (error) {
            showMessage(
                message,
                error.message || "Login failed. Please try again.",
                "error"
            );
        } finally {
            setButtonLoading(submit, false);
        }
    });
}
