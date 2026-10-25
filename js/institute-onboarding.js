
"use strict";

document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("institute-application-form");
    if (!form) return;

    // ---------------------------------------------------------
    // 1. ELEMENTS AND CONFIGURATION
    // ---------------------------------------------------------

    const steps = Array.from(form.querySelectorAll(".form-step"));
    const totalSteps = steps.length;

    const stepCounter = document.getElementById("step-counter");
    const progressTrack = document.getElementById("progress-track");
    const progressBar = document.getElementById("progress-bar");

    const previousButton = document.getElementById("previous-button");
    const nextButton = document.getElementById("next-button");
    const submitButton = document.getElementById("submit-button");

    const formMessage = document.getElementById("form-message");
    const reviewSummary = document.getElementById("review-summary");

    const officialEmailField = document.getElementById("official_email");
    const verificationEmailPreview =
        document.getElementById("verification-email-preview");
    const verificationStatus = document.getElementById("verification-status");

    const sendOtpButton = document.getElementById("send-otp-button");
    const verifyOtpButton = document.getElementById("verify-otp-button");
    const resendOtpButton = document.getElementById("resend-otp-button");

    const otpEntryPanel = document.getElementById("otp-entry-panel");
    const otpInput = document.getElementById("email_otp");
    const otpError = document.getElementById("otp-error");
    const otpHint = document.getElementById("otp-hint");

    const consentCheckbox = document.getElementById("consent");
    const consentError = document.getElementById("consent-error");

    const API_BASE = "../backend/api/institutes";
    const SEND_OTP_URL = API_BASE + "/send-email-otp.php";
    const VERIFY_OTP_URL = API_BASE + "/verify-email-otp.php";
    const SUBMIT_URL = API_BASE + "/submit-application.php";

    // ---------------------------------------------------------
    // 2. STATE
    // ---------------------------------------------------------

    let currentStep = 0;
    let isSendingOtp = false;
    let isVerifyingOtp = false;
    let isSubmitting = false;
    let submissionSucceeded = false;

    let emailVerified = false;
    let verifiedEmail = "";
    let otpSentEmail = "";

    let resendAvailableAt = 0;
    let resendTimer = null;

    const originalSubmitText = submitButton
        ? submitButton.textContent.trim()
        : "Submit application";

    const requiredFieldsByStep = {
        0: ["institution_type", "official_name"],
        1: ["registration_number", "state_region", "city", "address"],
        2: [],
        3: [
            "representative_name",
            "representative_designation",
            "official_email",
            "official_phone"
        ],
        4: [],
        5: []
    };

    const reviewGroups = [
        {
            title: "Institution",
            fields: [
                ["Institution type", "institution_type"],
                ["Official name", "official_name"],
                ["Display name", "display_name"]
            ]
        },
        {
            title: "Registration and location",
            fields: [
                ["Registration number", "registration_number"],
                ["Website", "website"],
                ["Country", "country"],
                ["State / Region", "state_region"],
                ["City", "city"],
                ["Postal code", "postal_code"],
                ["Registered address", "address"]
            ]
        },
        {
            title: "Academic information",
            fields: [
                ["Estimated students", "estimated_student_count"],
                ["Estimated mentors", "estimated_mentor_count"],
                ["Departments / programmes", "department_summary"]
            ]
        },
        {
            title: "Representative",
            fields: [
                ["Representative name", "representative_name"],
                ["Designation", "representative_designation"],
                ["Official email", "official_email"],
                ["Phone", "official_phone"]
            ]
        }
    ];

    // ---------------------------------------------------------
    // 3. GENERAL HELPERS
    // ---------------------------------------------------------

    function getField(name) {
        return form.elements.namedItem(name);
    }

    function getFieldValue(name) {
        const field = getField(name);

        if (!field || !("value" in field)) return "";

        return String(field.value).trim();
    }

    function normalizeEmail(email) {
        return String(email || "").trim().toLowerCase();
    }

    function getCurrentEmail() {
        return normalizeEmail(getFieldValue("official_email"));
    }

    function getFieldLabel(field) {
        if (!field) return "This field";

        const label = form.querySelector('label[for="' + field.id + '"]');

        return label
            ? label.textContent.replace(/\s+/g, " ").replace(/\*/g, "").trim()
            : field.name || "This field";
    }

    function getErrorElement(field) {
        if (!field) return null;

        const container = field.closest(".field");

        return container
            ? container.querySelector(".field-error")
            : null;
    }

    function clearFieldError(field) {
        if (!field) return;

        field.removeAttribute("aria-invalid");

        const errorElement = getErrorElement(field);
        if (errorElement) errorElement.textContent = "";

        if (field.id === "consent" && consentError) {
            consentError.textContent = "";
        }
    }

    function setFieldError(field, message) {
        if (!field) return;

        field.setAttribute("aria-invalid", "true");

        const errorElement = getErrorElement(field);
        if (errorElement) errorElement.textContent = message;
    }

    function showMessage(message, type) {
        if (!formMessage) return;

        formMessage.textContent = message;
        formMessage.className = "form-message";

        if (type) formMessage.classList.add("is-" + type);
    }

    function clearMessage() {
        if (!formMessage) return;

        formMessage.textContent = "";
        formMessage.className = "form-message";
    }

    function setOtpError(message) {
        if (otpError) otpError.textContent = message || "";

        if (otpInput) {
            if (message) {
                otpInput.setAttribute("aria-invalid", "true");
            } else {
                otpInput.removeAttribute("aria-invalid");
            }
        }
    }

    function setButtonLoading(button, loading, loadingText, originalText) {
        if (!button) return;

        button.disabled = loading;
        button.textContent = loading ? loadingText : originalText;
    }

    // ---------------------------------------------------------
    // 4. API HELPER
    // ---------------------------------------------------------

    async function postJson(url, payload) {
        let response;

        try {
            response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                credentials: "same-origin",
                body: JSON.stringify(payload)
            });
        } catch (error) {
            throw new Error(
                "Unable to connect to Foundev. Check Apache and try again."
            );
        }

        let result;

        try {
            result = await response.json();
        } catch (error) {
            throw new Error(
                "The server returned an invalid response. Check the PHP endpoint."
            );
        }

        if (!response.ok || result.success !== true) {
            throw new Error(
                result.message || "The request could not be completed."
            );
        }

        return result;
    }

    // ---------------------------------------------------------
    // 5. VALIDATION
    // ---------------------------------------------------------

    function validateField(field) {
        if (!field || field.disabled) return true;

        clearFieldError(field);

        const value = String(field.value || "").trim();
        const label = getFieldLabel(field);

        if (field.required && field.type !== "checkbox" && !value) {
            setFieldError(field, label + " is required.");
            return false;
        }

        if (field.type === "checkbox" || !value) return true;

        if (field.type === "email") {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                setFieldError(field, "Enter a valid email address.");
                return false;
            }

            if (value.length > 254) {
                setFieldError(field, "The email address is too long.");
                return false;
            }
        }

        if (field.type === "url") {
            try {
                const parsedUrl = new URL(value);

                if (!["http:", "https:"].includes(parsedUrl.protocol)) {
                    throw new Error("Invalid URL scheme");
                }
            } catch (error) {
                setFieldError(
                    field,
                    "Enter a valid website URL starting with https://."
                );
                return false;
            }
        }

        if (
            field.id === "official_phone" &&
            !/^[+\d][\d\s().-]{5,28}$/.test(value)
        ) {
            setFieldError(field, "Enter a valid phone number.");
            return false;
        }

        if (field.id === "official_name" && value.length < 2) {
            setFieldError(field, "Enter the institution's full name.");
            return false;
        }

        if (field.id === "representative_name" && value.length < 2) {
            setFieldError(field, "Enter the representative's full name.");
            return false;
        }

        return true;
    }

    function validateCurrentStep() {
        clearMessage();

        let valid = true;
        let firstInvalidField = null;

        const currentFields = steps[currentStep].querySelectorAll(
            "input, select, textarea"
        );

        currentFields.forEach(function (field) {
            if (field.type === "checkbox" && field.id !== "consent") return;

            if (!validateField(field)) {
                valid = false;
                if (!firstInvalidField) firstInvalidField = field;
            }
        });

        (requiredFieldsByStep[currentStep] || []).forEach(function (name) {
            const field = getField(name);

            if (field && !validateField(field)) {
                valid = false;
                if (!firstInvalidField) firstInvalidField = field;
            }
        });

        if (currentStep === 4) {
            if (!emailVerified || verifiedEmail !== getCurrentEmail()) {
                showMessage(
                    "Please verify your official email before continuing.",
                    "error"
                );

                if (sendOtpButton) sendOtpButton.focus();

                return false;
            }
        }

        if (firstInvalidField) firstInvalidField.focus();

        return valid;
    }

    function validateAllRequiredFields() {
        for (let stepIndex = 0; stepIndex <= 3; stepIndex++) {
            for (const name of requiredFieldsByStep[stepIndex] || []) {
                const field = getField(name);

                if (field && !validateField(field)) {
                    showStep(stepIndex);
                    field.focus();

                    showMessage(
                        "Please correct the highlighted fields before continuing.",
                        "error"
                    );

                    return false;
                }
            }
        }

        // Also validate every required HTML field, including fields not
        // listed in requiredFieldsByStep.
        for (let stepIndex = 0; stepIndex <= 3; stepIndex++) {
            const requiredFields = steps[stepIndex].querySelectorAll(
                "input[required], select[required], textarea[required]"
            );

            for (const field of requiredFields) {
                if (!validateField(field)) {
                    showStep(stepIndex);
                    field.focus();

                    showMessage(
                        "Please complete the required fields.",
                        "error"
                    );

                    return false;
                }
            }
        }

        return true;
    }

    // ---------------------------------------------------------
    // 6. NAVIGATION AND PROGRESS
    // ---------------------------------------------------------

    function updateProgress() {
        const stepNumber = currentStep + 1;

        if (stepCounter) {
            stepCounter.textContent =
                String(stepNumber).padStart(2, "0") +
                " / " +
                String(totalSteps).padStart(2, "0");
        }

        if (progressBar) {
            progressBar.style.width =
                (stepNumber / totalSteps) * 100 + "%";
        }

        if (progressTrack) {
            progressTrack.setAttribute("aria-valuenow", String(stepNumber));
        }

        document.querySelectorAll("[data-label-step]").forEach(function (label) {
            const index = Number(label.getAttribute("data-label-step"));

            label.classList.toggle("active", index === currentStep);
            label.classList.toggle("completed", index < currentStep);
        });
    }

    function updateNavigationButtons() {
        if (previousButton) {
            previousButton.hidden = currentStep === 0;
            previousButton.disabled = isSubmitting || submissionSucceeded;
        }

        if (nextButton) {
            nextButton.hidden = currentStep === totalSteps - 1;
            nextButton.disabled = isSubmitting || submissionSucceeded;
        }

        if (submitButton) {
            submitButton.hidden = currentStep !== totalSteps - 1;
            submitButton.disabled = isSubmitting || submissionSucceeded;
        }
    }

    function showStep(stepIndex, options) {
        const settings = options || {};

        if (stepIndex < 0 || stepIndex >= totalSteps) return;

        currentStep = stepIndex;

        steps.forEach(function (step, index) {
            const active = index === currentStep;

            step.hidden = !active;
            step.classList.toggle("active", active);

            if (active) {
                step.setAttribute("aria-current", "step");
            } else {
                step.removeAttribute("aria-current");
            }
        });

        updateProgress();
        updateNavigationButtons();
        clearMessage();

        if (currentStep === 4) {
            updateVerificationPreview();
            updateVerificationStatus();
        }

        if (currentStep === 5) buildReviewSummary();

        if (settings.scroll !== false) {
            const card = document.querySelector(".application-card");

            if (card) {
                card.scrollIntoView({
                    behavior: window.matchMedia(
                        "(prefers-reduced-motion: reduce)"
                    ).matches ? "auto" : "smooth",
                    block: "start"
                });
            }
        }
    }

    if (nextButton) {
        nextButton.addEventListener("click", function () {
            if (!validateCurrentStep()) return;

            if (currentStep < totalSteps - 1) {
                showStep(currentStep + 1);
            }
        });
    }

    if (previousButton) {
        previousButton.addEventListener("click", function () {
            if (currentStep > 0 && !isSubmitting && !submissionSucceeded) {
                showStep(currentStep - 1);
            }
        });
    }

    // ---------------------------------------------------------
    // 7. EMAIL VERIFICATION
    // ---------------------------------------------------------

    function updateVerificationPreview() {
        if (!verificationEmailPreview) return;

        const email = getCurrentEmail();

        verificationEmailPreview.textContent = email
            ? "Verification address: " + email
            : "Enter your official email address in the previous step.";
    }

    function updateVerificationStatus() {
        if (!verificationStatus) return;

        const verifiedForCurrentEmail =
            emailVerified && verifiedEmail === getCurrentEmail();

        verificationStatus.classList.toggle(
            "is-verified",
            verifiedForCurrentEmail
        );

        verificationStatus.textContent = verifiedForCurrentEmail
            ? "Email verified"
            : "Not verified";
    }

    function clearResendTimer() {
        if (resendTimer !== null) {
            clearInterval(resendTimer);
            resendTimer = null;
        }
    }

    function updateResendButton() {
        if (!resendOtpButton) return;

        const secondsLeft = Math.max(
            0,
            Math.ceil((resendAvailableAt - Date.now()) / 1000)
        );

        if (secondsLeft > 0) {
            resendOtpButton.disabled = true;
            resendOtpButton.textContent = "Resend code in " + secondsLeft + "s";
        } else {
            resendOtpButton.disabled = isSendingOtp || isVerifyingOtp;
            resendOtpButton.textContent = "Resend code";
            clearResendTimer();
        }
    }

    function startResendCountdown(seconds) {
        clearResendTimer();

        resendAvailableAt = Date.now() + seconds * 1000;
        updateResendButton();

        resendTimer = setInterval(updateResendButton, 1000);
    }

    function resetOtpInterface() {
        clearResendTimer();

        emailVerified = false;
        verifiedEmail = "";
        otpSentEmail = "";
        resendAvailableAt = 0;

        if (otpInput) {
            otpInput.value = "";
            otpInput.disabled = false;
        }

        if (otpEntryPanel) otpEntryPanel.hidden = true;

        if (sendOtpButton) {
            sendOtpButton.hidden = false;
            sendOtpButton.disabled = false;
            sendOtpButton.textContent = "Send verification code";
        }

        if (verifyOtpButton) {
            verifyOtpButton.hidden = false;
            verifyOtpButton.disabled = false;
            verifyOtpButton.textContent = "Verify code";
        }

        if (resendOtpButton) {
            resendOtpButton.hidden = false;
            resendOtpButton.disabled = true;
            resendOtpButton.textContent = "Resend code";
        }

        if (otpHint) {
            otpHint.textContent = "Check your inbox and spam folder.";
        }

        setOtpError("");
        updateVerificationStatus();
        updateVerificationPreview();
    }

    async function sendOtp(isResend) {
        if (isSendingOtp || isVerifyingOtp || isSubmitting) return;

        clearMessage();
        setOtpError("");

        const email = getCurrentEmail();

        if (!email) {
            showStep(3);

            if (officialEmailField) {
                setFieldError(
                    officialEmailField,
                    "Enter your official email address."
                );
                officialEmailField.focus();
            }

            return;
        }

        if (!validateField(officialEmailField)) {
            showStep(3);
            if (officialEmailField) officialEmailField.focus();
            return;
        }

        if (isResend && Date.now() < resendAvailableAt) {
            updateResendButton();
            return;
        }

        isSendingOtp = true;

        if (sendOtpButton) {
            sendOtpButton.disabled = true;
            sendOtpButton.textContent = "Sending code...";
        }

        if (resendOtpButton) resendOtpButton.disabled = true;

        try {
            const result = await postJson(SEND_OTP_URL, { email: email });

            otpSentEmail = email;
            emailVerified = false;
            verifiedEmail = "";

            if (otpEntryPanel) otpEntryPanel.hidden = false;

            if (sendOtpButton) sendOtpButton.hidden = true;

            if (otpInput) {
                otpInput.disabled = false;
                otpInput.value = "";
                otpInput.focus();
            }

            if (verifyOtpButton) verifyOtpButton.hidden = false;
            if (resendOtpButton) resendOtpButton.hidden = false;

            if (otpHint) {
                otpHint.textContent = result.message ||
                    "A verification code was sent to " + email + ".";
            }

            startResendCountdown(Number(result.resend_after) || 60);
            updateVerificationStatus();

            showMessage(
                result.message || "Verification code sent. Check your inbox.",
                "success"
            );
        } catch (error) {
            showMessage(error.message, "error");

            if (sendOtpButton) {
                sendOtpButton.hidden = false;
                sendOtpButton.disabled = false;
                sendOtpButton.textContent = "Send verification code";
            }

            if (resendOtpButton) {
                resendOtpButton.disabled = Date.now() < resendAvailableAt;
            }
        } finally {
            isSendingOtp = false;

            if (resendAvailableAt > Date.now()) {
                updateResendButton();
            } else if (resendOtpButton && !emailVerified) {
                resendOtpButton.disabled = false;
            }
        }
    }

    if (sendOtpButton) {
        sendOtpButton.addEventListener("click", function () {
            sendOtp(false);
        });
    }

    if (resendOtpButton) {
        resendOtpButton.addEventListener("click", function () {
            sendOtp(true);
        });
    }

    async function verifyOtp() {
        if (isVerifyingOtp || isSendingOtp || isSubmitting) return;

        clearMessage();
        setOtpError("");

        const email = getCurrentEmail();
        const otp = String(otpInput ? otpInput.value : "").trim();

        if (!email || email !== otpSentEmail) {
            resetOtpInterface();

            showMessage(
                "Your email address has changed. Request a new verification code.",
                "error"
            );

            return;
        }

        if (!/^\d{6}$/.test(otp)) {
            setOtpError("Enter the six-digit code from your email.");
            if (otpInput) otpInput.focus();
            return;
        }

        isVerifyingOtp = true;

        setButtonLoading(
            verifyOtpButton,
            true,
            "Verifying...",
            "Verify code"
        );

        if (sendOtpButton) sendOtpButton.disabled = true;
        if (resendOtpButton) resendOtpButton.disabled = true;

        try {
            const result = await postJson(VERIFY_OTP_URL, {
                email: email,
                otp: otp
            });

            if (result.verified !== true) {
                throw new Error(
                    result.message || "Email verification was unsuccessful."
                );
            }

            emailVerified = true;
            verifiedEmail = email;

            if (otpInput) otpInput.disabled = true;
            if (verifyOtpButton) verifyOtpButton.hidden = true;
            if (resendOtpButton) resendOtpButton.hidden = true;
            if (sendOtpButton) sendOtpButton.hidden = true;

            clearResendTimer();
            updateVerificationStatus();
            buildReviewSummary();

            showMessage(
                result.message || "Official email verified successfully.",
                "success"
            );
        } catch (error) {
            setOtpError(error.message);
            showMessage(error.message, "error");

            if (otpInput) otpInput.focus();
        } finally {
            isVerifyingOtp = false;

            if (!emailVerified && verifyOtpButton) {
                verifyOtpButton.disabled = false;
                verifyOtpButton.textContent = "Verify code";
            }

            if (!emailVerified && resendAvailableAt > Date.now()) {
                updateResendButton();
            } else if (!emailVerified && resendOtpButton) {
                resendOtpButton.disabled = false;
            }

            if (!emailVerified && sendOtpButton) {
                sendOtpButton.disabled = false;
            }
        }
    }

    if (verifyOtpButton) {
        verifyOtpButton.addEventListener("click", verifyOtp);
    }

    if (otpInput) {
        otpInput.addEventListener("input", function () {
            otpInput.value = otpInput.value.replace(/\D/g, "").slice(0, 6);
            setOtpError("");
        });

        otpInput.addEventListener("keydown", function (event) {
            if (event.key === "Enter") {
                event.preventDefault();
                verifyOtp();
            }
        });
    }

    if (officialEmailField) {
        officialEmailField.addEventListener("input", function () {
            const email = getCurrentEmail();

            if (email !== verifiedEmail || email !== otpSentEmail) {
                resetOtpInterface();
            }

            updateVerificationPreview();
            updateVerificationStatus();
        });
    }

    // ---------------------------------------------------------
    // 8. REVIEW SUMMARY
    // ---------------------------------------------------------

    function getDisplayValue(fieldName) {
        const field = getField(fieldName);

        if (!field || !("value" in field)) return "";

        const value = String(field.value).trim();
        if (!value) return "Not provided";

        if (field.tagName === "SELECT") {
            const option = field.options[field.selectedIndex];
            return option ? option.textContent.trim() : value;
        }

        return value;
    }

    function buildReviewSummary() {
        if (!reviewSummary) return;

        reviewSummary.replaceChildren();

        reviewGroups.forEach(function (group) {
            const groupElement = document.createElement("section");
            groupElement.className = "review-group";

            const heading = document.createElement("h4");
            heading.textContent = group.title;

            const grid = document.createElement("div");
            grid.className = "review-grid";

            group.fields.forEach(function (item) {
                const itemElement = document.createElement("div");
                itemElement.className = "review-item";

                const label = document.createElement("span");
                label.className = "review-label";
                label.textContent = item[0];

                const value = document.createElement("span");
                value.className = "review-value";
                value.textContent = getDisplayValue(item[1]);

                itemElement.appendChild(label);
                itemElement.appendChild(value);
                grid.appendChild(itemElement);
            });

            groupElement.appendChild(heading);
            groupElement.appendChild(grid);
            reviewSummary.appendChild(groupElement);
        });

        const verificationGroup = document.createElement("section");
        verificationGroup.className = "review-group";

        const heading = document.createElement("h4");
        heading.textContent = "Email verification";

        const status = document.createElement("p");
        status.className = "review-value";
        status.textContent =
            emailVerified && verifiedEmail === getCurrentEmail()
                ? "Verified"
                : "Not verified";

        verificationGroup.appendChild(heading);
        verificationGroup.appendChild(status);
        reviewSummary.appendChild(verificationGroup);
    }

    // ---------------------------------------------------------
    // 9. CONSENT
    // ---------------------------------------------------------

    function validateConsent() {
        if (!consentCheckbox || !consentError) return false;

        if (!consentCheckbox.checked) {
            consentError.textContent =
                "Please confirm the information before submitting.";

            consentCheckbox.setAttribute("aria-invalid", "true");
            consentCheckbox.focus();

            return false;
        }

        consentError.textContent = "";
        consentCheckbox.removeAttribute("aria-invalid");

        return true;
    }

    if (consentCheckbox) {
        consentCheckbox.addEventListener("change", function () {
            if (consentError) consentError.textContent = "";
            consentCheckbox.removeAttribute("aria-invalid");
        });
    }

    // ---------------------------------------------------------
    // 10. COLLECT APPLICATION DATA
    // ---------------------------------------------------------

    function collectApplicationData() {
        const data = {};

        form.querySelectorAll(
            "input[name], select[name], textarea[name]"
        ).forEach(function (field) {
            if (field.name === "email_otp") return;

            if (field.name === "consent") {
                data.consent = field.checked;
                return;
            }

            if (field.type === "checkbox") {
                data[field.name] = field.checked;
                return;
            }

            data[field.name] = String(field.value || "").trim();
        });

        // Always send the normalized address that was verified.
        data.official_email = getCurrentEmail();

        // This is informational only. PHP independently verifies the email.
        data.email_verified =
            emailVerified && verifiedEmail === getCurrentEmail();

        return data;
    }

    // ---------------------------------------------------------
    // 11. SUBMIT APPLICATION TO PHP / MYSQL
    // ---------------------------------------------------------

    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        if (isSubmitting || submissionSucceeded) return;

        clearMessage();

        if (!validateAllRequiredFields()) return;

        if (!validateConsent()) {
            showMessage(
                "Please confirm the application information before submitting.",
                "error"
            );
            return;
        }

        if (
            !emailVerified ||
            !verifiedEmail ||
            verifiedEmail !== getCurrentEmail()
        ) {
            showStep(4);

            showMessage(
                "Verify the representative's official email before submitting.",
                "error"
            );

            return;
        }

        const applicationData = collectApplicationData();

        isSubmitting = true;
        updateNavigationButtons();

        setButtonLoading(
            submitButton,
            true,
            "Submitting application...",
            originalSubmitText
        );

        try {
            const result = await postJson(SUBMIT_URL, applicationData);

            submissionSucceeded = true;

            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = "Application submitted";
            }

            if (previousButton) previousButton.disabled = true;
            if (nextButton) nextButton.disabled = true;

            // Hide the outdated informational notice if it exists.
            const notices = form.querySelectorAll("*");

            notices.forEach(function (element) {
                if (
                    element.children.length === 0 &&
                    element.textContent.includes(
                        "The application has not been saved yet"
                    )
                ) {
                    const notice = element.closest(
                        ".form-notice, .notice, .info-box, .form-message"
                    );

                    if (notice) notice.hidden = true;
                }
            });

            const applicationNumber = result.application_number || "";

            showMessage(
                "Your institute partnership application has been submitted successfully." +
                (applicationNumber
                    ? " Your application number is " + applicationNumber + "."
                    : "") +
                " Foundev will review your application before activating an institute workspace.",
                "success"
            );

            // Keep the user on the review screen and preserve their details.
            if (reviewSummary && applicationNumber) {
                const confirmation = document.createElement("section");
                confirmation.className = "review-group";

                const heading = document.createElement("h4");
                heading.textContent = "Submission confirmation";

                const reference = document.createElement("p");
                reference.className = "review-value";
                reference.textContent = "Application number: " + applicationNumber;

                const status = document.createElement("p");
                status.className = "review-value";
                status.textContent = "Status: Submitted — awaiting Foundev review.";

                confirmation.appendChild(heading);
                confirmation.appendChild(reference);
                confirmation.appendChild(status);
                reviewSummary.appendChild(confirmation);
            }
        } catch (error) {
            showMessage(error.message, "error");

            // Preserve all entered values so the user can retry.
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = originalSubmitText;
            }
        } finally {
            isSubmitting = false;
            updateNavigationButtons();

            if (submissionSucceeded && submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = "Application submitted";
            }
        }
    });

    // ---------------------------------------------------------
    // 12. LIVE FIELD VALIDATION
    // ---------------------------------------------------------

    form.querySelectorAll("input, select, textarea").forEach(function (field) {
        field.addEventListener("input", function () {
            if (field.hasAttribute("aria-invalid")) {
                validateField(field);
            }
        });

        field.addEventListener("change", function () {
            if (field.hasAttribute("aria-invalid")) {
                validateField(field);
            }
        });
    });

    // ---------------------------------------------------------
    // 13. INITIALIZE
    // ---------------------------------------------------------

    updateVerificationPreview();
    updateVerificationStatus();
    updateProgress();
    updateNavigationButtons();
    showStep(0, { scroll: false });
});
