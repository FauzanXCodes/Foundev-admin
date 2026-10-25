
/* =========================================================
   FOUNDEV — INSTITUTE STUDENT SIGNUP & EMAIL OTP
   File: js/institute-student-signup.js

   API:
   ../backend/api/institute-students/institutions.php
   ../backend/api/institute-students/signup.php

   Expected signup API actions:
   1. start
   2. verify_otp
   3. resend_otp
   ========================================================= */

"use strict";

document.addEventListener("DOMContentLoaded", initializeStudentSignup);

function initializeStudentSignup() {
    const $ = (id) => document.getElementById(id);

    // Signup elements
    const form = $("student-signup-form");
    const signupButton = $("student-signup-submit");
    const alertBox = $("signup-alert");

    // OTP elements
    const otpSection = $("student-otp-section");
    const otpForm = $("student-otp-form");
    const otpInput = $("student-email-otp");
    const otpVerifyButton = $("student-otp-verify");
    const otpResendButton = $("student-otp-resend");
    const otpBackButton = $("student-otp-back");
    const otpEmailDisplay = $("otp-email-display");

    if (!form) {
        console.error(
            "Foundev: student-signup-form was not found."
        );
        return;
    }

    /*
     * This assumes the page is located at:
     * /pages/institute-student-signup.html
     *
     * And backend is located at:
     * /backend/api/institute-students/
     */
    const API_BASE = "../backend/api/institute-students/";

    const API = {
        institutions: API_BASE + "institutions.php",
        signup: API_BASE + "signup.php"
    };

    const fields = {
        name: $("student-name"),
        email: $("student-email"),
        institution: $("student-institution"),
        rollNumber: $("student-roll-number"),
        course: $("student-course"),
        academicYear: $("student-year"),
        password: $("student-password"),
        confirmPassword: $("student-confirm-password"),
        terms: $("student-terms")
    };

    const state = {
        registrationToken: null,
        email: null,
        busy: false,
        resendAvailableAt: 0,
        resendTimer: null
    };


    /* =====================================================
       1. ALERTS
       ===================================================== */

    function showAlert(message, type = "error") {
        if (!alertBox) {
            console[type === "error" ? "error" : "log"](message);
            return;
        }

        alertBox.textContent = message;
        alertBox.className = `auth-alert auth-alert-${type}`;
        alertBox.hidden = false;

        alertBox.setAttribute("role", "alert");
        alertBox.setAttribute("aria-live", "polite");
    }

    function clearAlert() {
        if (!alertBox) return;

        alertBox.textContent = "";
        alertBox.hidden = true;
        alertBox.className = "auth-alert";
    }


    /* =====================================================
       2. BUTTON LOADING STATES
       ===================================================== */

    function setLoading(button, loading, loadingText = "Please wait...") {
        if (!button) return;

        if (loading) {
            if (!button.dataset.originalText) {
                button.dataset.originalText =
                    button.textContent.trim();
            }

            button.disabled = true;
            button.classList.add("is-loading");
            button.setAttribute("aria-busy", "true");
            button.textContent = loadingText;
        } else {
            button.classList.remove("is-loading");
            button.removeAttribute("aria-busy");

            button.textContent =
                button.dataset.originalText ||
                button.textContent;

            /*
             * The resend button must remain disabled
             * until its cooldown finishes.
             */
            if (button !== otpResendButton) {
                button.disabled = false;
            } else {
                button.disabled =
                    Date.now() < state.resendAvailableAt;
            }
        }
    }


    /* =====================================================
       3. API REQUEST HELPER
       ===================================================== */

    async function requestJson(url, options = {}) {
        let response;

        try {
            response = await fetch(url, {
                credentials: "same-origin",
                cache: "no-store",
                ...options,
                headers: {
                    Accept: "application/json",
                    ...(options.body
                        ? {
                            "Content-Type": "application/json"
                        }
                        : {}),
                    ...(options.headers || {})
                }
            });
        } catch (error) {
            console.error("Network error:", error);

            throw new Error(
                "Unable to connect to the server. Check that XAMPP is running."
            );
        }

        const responseText = await response.text();

        let data;

        try {
            data = responseText
                ? JSON.parse(responseText)
                : {};
        } catch (error) {
            console.error(
                "Invalid JSON received from PHP:",
                responseText
            );

            throw new Error(
                "The server returned an invalid response. Check the PHP error log."
            );
        }

        if (!response.ok || data.success === false) {
            throw new Error(
                data.message ||
                data.error ||
                `Request failed with HTTP ${response.status}.`
            );
        }

        return data;
    }


    /* =====================================================
       4. LOAD INSTITUTIONS
       ===================================================== */

    async function loadInstitutions() {
        const select = fields.institution;

        if (!select) return;

        select.disabled = true;
        select.innerHTML =
            '<option value="">Loading institutions...</option>';

        try {
            const data = await requestJson(API.institutions, {
                method: "GET"
            });

            if (!Array.isArray(data.institutions)) {
                throw new Error(
                    "The institutions API returned an unexpected response."
                );
            }

            select.replaceChildren();

            const placeholder = document.createElement("option");
            placeholder.value = "";
            placeholder.textContent = "Select your institution";
            placeholder.disabled = true;
            placeholder.selected = true;

            select.appendChild(placeholder);

            data.institutions.forEach((institution) => {
                if (
                    institution.id === undefined ||
                    institution.id === null ||
                    !institution.name
                ) {
                    return;
                }

                const option = document.createElement("option");

                option.value = String(institution.id);
                option.textContent = String(institution.name);

                select.appendChild(option);
            });

            if (select.options.length === 1) {
                placeholder.textContent =
                    "No institutions available";

                showAlert(
                    "No institutions are currently available for signup. Please contact Foundev support.",
                    "warning"
                );
            }
        } catch (error) {
            console.error("Institution loading failed:", error);

            select.innerHTML =
                '<option value="">Unable to load institutions</option>';

            showAlert(
                error.message ||
                "Unable to load institutions. Please refresh the page."
            );
        } finally {
            select.disabled = false;
        }
    }


    /* =====================================================
       5. PASSWORD VISIBILITY
       ===================================================== */

    document
        .querySelectorAll("[data-toggle-password]")
        .forEach((button) => {
            button.addEventListener("click", () => {
                const input = $(
                    button.getAttribute("data-toggle-password")
                );

                if (!input) return;

                const show = input.type === "password";

                input.type = show ? "text" : "password";
                button.textContent = show ? "Hide" : "Show";

                button.setAttribute(
                    "aria-label",
                    show ? "Hide password" : "Show password"
                );

                button.setAttribute(
                    "aria-pressed",
                    String(show)
                );
            });
        });


    /* =====================================================
       6. FIELD VALIDATION
       ===================================================== */

    function clearFieldErrors() {
        Object.values(fields).forEach((field) => {
            if (field) {
                field.removeAttribute("aria-invalid");
            }
        });

        if (otpInput) {
            otpInput.removeAttribute("aria-invalid");
        }
    }

    function fieldError(field, message) {
        showAlert(message);

        if (field) {
            field.setAttribute("aria-invalid", "true");
            field.focus();
        }

        return false;
    }

    function validateSignup() {
        clearFieldErrors();

        const name = fields.name.value.trim();
        const email = fields.email.value.trim().toLowerCase();
        const institutionId = fields.institution.value;
        const rollNumber = fields.rollNumber.value.trim();
        const course = fields.course.value.trim();
        const academicYear = fields.academicYear.value;
        const password = fields.password.value;
        const confirmPassword = fields.confirmPassword.value;

        if (name.length < 2 || name.length > 120) {
            fieldError(
                fields.name,
                "Enter your full name using 2 to 120 characters."
            );
            return null;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            fieldError(
                fields.email,
                "Enter a valid email address."
            );
            return null;
        }

        if (!institutionId) {
            fieldError(
                fields.institution,
                "Please select your institution."
            );
            return null;
        }

        if (!rollNumber || rollNumber.length > 60) {
            fieldError(
                fields.rollNumber,
                "Enter a valid roll number."
            );
            return null;
        }

        if (!course || course.length > 120) {
            fieldError(
                fields.course,
                "Enter your course or branch."
            );
            return null;
        }

        if (!academicYear) {
            fieldError(
                fields.academicYear,
                "Please select your academic year."
            );
            return null;
        }

        if (password.length < 8 || password.length > 128) {
            fieldError(
                fields.password,
                "Your password must contain 8 to 128 characters."
            );
            return null;
        }

        if (password !== confirmPassword) {
            fieldError(
                fields.confirmPassword,
                "Your passwords do not match."
            );
            return null;
        }

        if (!fields.terms.checked) {
            fieldError(
                fields.terms,
                "Please accept the Terms and Privacy Policy."
            );
            return null;
        }

        return {
            student_name: name,
            email,
            institution_id: institutionId,
            roll_number: rollNumber,
            course,
            academic_year: academicYear,
            password,
            confirm_password: confirmPassword,
            accept_terms: true
        };
    }


    /* =====================================================
       7. START SIGNUP AND SEND OTP
       ===================================================== */

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (state.busy) return;

        clearAlert();

        const payload = validateSignup();

        if (!payload) return;

        state.busy = true;

        setLoading(
            signupButton,
            true,
            "Sending verification code..."
        );

        try {
            const data = await requestJson(API.signup, {
                method: "POST",
                body: JSON.stringify({
                    action: "start",
                    ...payload
                })
            });

            if (!data.registration_token) {
                throw new Error(
                    "The server did not return a registration token. Check signup.php."
                );
            }

            state.registrationToken =
                data.registration_token;

            state.email = payload.email;

            if (otpEmailDisplay) {
                otpEmailDisplay.textContent = state.email;
            }

            // Switch from signup form to OTP form.
            form.hidden = true;
            otpSection.hidden = false;

            const authSwitch = $("auth-switch");

            if (authSwitch) {
                authSwitch.hidden = true;
            }

            clearAlert();

            showAlert(
                data.message ||
                "A verification code has been sent to your email.",
                "success"
            );

            otpInput.value = "";
            otpInput.disabled = false;

            if (otpVerifyButton) {
                otpVerifyButton.disabled = false;
            }

            startResendCooldown(
                Number(data.resend_after) || 60
            );

            otpInput.focus();

        } catch (error) {
            console.error("Signup failed:", error);

            showAlert(
                error.message ||
                "Unable to start signup. Please try again."
            );
        } finally {
            state.busy = false;
            setLoading(signupButton, false);
        }
    });


    /* =====================================================
       8. OTP INPUT
       ===================================================== */

    if (otpInput) {
        otpInput.addEventListener("input", () => {
            // This implementation expects a six-digit numeric OTP.
            otpInput.value = otpInput.value
                .replace(/\D/g, "")
                .slice(0, 6);

            otpInput.removeAttribute("aria-invalid");
        });
    }


    /* =====================================================
       9. VERIFY OTP
       ===================================================== */

    otpForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (state.busy) return;

        clearAlert();

        if (!state.registrationToken) {
            showAlert(
                "Your registration session is missing. Please start signup again."
            );
            return;
        }

        const otp = otpInput.value.trim();

        if (!/^\d{6}$/.test(otp)) {
            fieldError(
                otpInput,
                "Enter the complete 6-digit code sent to your email."
            );
            return;
        }

        state.busy = true;

        setLoading(
            otpVerifyButton,
            true,
            "Verifying code..."
        );

        try {
            const data = await requestJson(API.signup, {
                method: "POST",
                body: JSON.stringify({
                    action: "verify_otp",
                    registration_token: state.registrationToken,
                    otp
                })
            });

            stopResendCooldown();

            state.registrationToken = null;

            otpSection.hidden = true;
            form.hidden = true;

            const authSwitch = $("auth-switch");

            if (authSwitch) {
                authSwitch.hidden = true;
            }

            showAlert(
                data.message ||
                "Your email has been verified and your registration is complete.",
                "success"
            );

            // Provide a link to the existing student login page.
            const loginLink = document.createElement("a");

            loginLink.href = "institute-student-login.html";
            loginLink.textContent = "Go to student login";
            loginLink.className = "auth-success-link";

            alertBox.append(
                document.createElement("br"),
                loginLink
            );

        } catch (error) {
            console.error("OTP verification failed:", error);

            showAlert(
                error.message ||
                "OTP verification failed. Please try again."
            );

            otpInput.setAttribute("aria-invalid", "true");
            otpInput.focus();
            otpInput.select();

        } finally {
            state.busy = false;
            setLoading(otpVerifyButton, false);
        }
    });


    /* =====================================================
       10. OTP RESEND COOLDOWN
       ===================================================== */

    function stopResendCooldown() {
        if (state.resendTimer) {
            clearInterval(state.resendTimer);
            state.resendTimer = null;
        }

        state.resendAvailableAt = 0;

        if (otpResendButton) {
            otpResendButton.disabled = true;
            otpResendButton.textContent =
                "Resend verification code";
        }
    }

    function startResendCooldown(seconds) {
        if (!otpResendButton) return;

        if (state.resendTimer) {
            clearInterval(state.resendTimer);
            state.resendTimer = null;
        }

        const duration = Math.max(
            0,
            Number(seconds) || 0
        );

        state.resendAvailableAt =
            Date.now() + duration * 1000;

        function updateCooldown() {
            const remaining = Math.max(
                0,
                Math.ceil(
                    (state.resendAvailableAt - Date.now()) / 1000
                )
            );

            if (remaining > 0) {
                otpResendButton.disabled = true;

                otpResendButton.textContent =
                    `Resend code in ${remaining}s`;
            } else {
                otpResendButton.disabled = false;

                otpResendButton.textContent =
                    "Resend verification code";

                if (state.resendTimer) {
                    clearInterval(state.resendTimer);
                    state.resendTimer = null;
                }
            }
        }

        updateCooldown();

        if (duration > 0) {
            state.resendTimer =
                setInterval(updateCooldown, 1000);
        }
    }


    /* =====================================================
       11. RESEND OTP
       ===================================================== */

    otpResendButton.addEventListener("click", async () => {
        if (state.busy) return;

        if (!state.registrationToken) {
            showAlert(
                "Your registration session has expired. Please start signup again."
            );
            return;
        }

        if (Date.now() < state.resendAvailableAt) {
            return;
        }

        state.busy = true;
        clearAlert();

        setLoading(
            otpResendButton,
            true,
            "Sending new code..."
        );

        try {
            const data = await requestJson(API.signup, {
                method: "POST",
                body: JSON.stringify({
                    action: "resend_otp",
                    registration_token: state.registrationToken
                })
            });

            showAlert(
                data.message ||
                "A new verification code has been sent to your email.",
                "success"
            );

            otpInput.value = "";
            otpInput.focus();

            startResendCooldown(
                Number(data.resend_after) || 60
            );

        } catch (error) {
            console.error("OTP resend failed:", error);

            showAlert(
                error.message ||
                "Unable to resend the verification code."
            );

        } finally {
            state.busy = false;

            /*
             * Restore the button label without bypassing
             * the resend cooldown.
             */
            setLoading(otpResendButton, false);
        }
    });


    /* =====================================================
       12. BACK TO SIGNUP
       ===================================================== */

    otpBackButton.addEventListener("click", () => {
        if (state.busy) return;

        stopResendCooldown();

        state.registrationToken = null;
        state.email = null;

        otpSection.hidden = true;
        form.hidden = false;

        const authSwitch = $("auth-switch");

        if (authSwitch) {
            authSwitch.hidden = false;
        }

        clearAlert();

        otpInput.value = "";
        otpInput.removeAttribute("aria-invalid");

        fields.email.focus();

        /*
         * The server should expire unfinished registrations
         * according to its own OTP expiration rules.
         */
    });


    /* =====================================================
       13. CLEAR FIELD ERRORS
       ===================================================== */

    Object.values(fields).forEach((field) => {
        if (!field) return;

        const eventName =
            field.tagName === "SELECT" ||
            field.type === "checkbox"
                ? "change"
                : "input";

        field.addEventListener(eventName, () => {
            field.removeAttribute("aria-invalid");
        });
    });


    /* =====================================================
       14. INITIALIZE
       ===================================================== */

    loadInstitutions();

    console.log(
        "Foundev student signup and OTP verification initialized."
    );
}
