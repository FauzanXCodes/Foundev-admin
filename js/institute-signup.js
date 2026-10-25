
"use strict";

document.addEventListener("DOMContentLoaded", initInstituteSignup);

const SIGNUP_API = "backend/api/institutes/signup.php";
const LOGIN_PAGE = "pages/institute-admin-login.html";

function setMessage(message, type = "") {
    const element = document.getElementById("message");

    if (!element) {
        return;
    }

    element.textContent = message;
    element.className = type;
}

async function parseResponse(response) {
    const responseText = await response.text();

    try {
        return JSON.parse(responseText);
    } catch {
        throw new Error(
            "The server returned an invalid response. Please check the PHP API."
        );
    }
}

async function initInstituteSignup() {
    const form = document.getElementById("signup-form");
    const institutionCard = document.getElementById("institution-card");
    const submitButton = document.getElementById("submit-button");

    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    // Never display the signup form without a valid-looking invitation token.
    if (!token || !/^[a-f0-9]{64}$/.test(token)) {
        setMessage(
            "This signup link is missing a valid invitation token. Please open the link from your invitation email.",
            "error"
        );
        return;
    }

    try {
        // The server, not JavaScript, determines whether the invitation is valid.
        const response = await fetch(
            `${SIGNUP_API}?token=${encodeURIComponent(token)}`,
            {
                method: "GET",
                credentials: "same-origin",
                cache: "no-store",
                headers: {
                    Accept: "application/json"
                }
            }
        );

        const data = await parseResponse(response);

        if (!response.ok || !data.success) {
            throw new Error(
                data.message || "This invitation cannot be used."
            );
        }

        document.getElementById("institution-name").textContent =
            data.institution || "Approved institution";

        document.getElementById("institution-email").textContent =
            data.email || "";

        institutionCard.hidden = false;
        form.hidden = false;

        setMessage(
            "Invitation verified. Complete the form below to create your account."
        );

        form.addEventListener("submit", async (event) => {
            event.preventDefault();

            if (!form.reportValidity() || submitButton.disabled) {
                return;
            }

            const fullName = document
                .getElementById("full-name")
                .value.trim();

            const password = document.getElementById("password").value;
            const confirmPassword = document.getElementById(
                "confirm-password"
            ).value;

            if (!fullName || fullName.length > 150) {
                setMessage(
                    "Enter a valid administrator name.",
                    "error"
                );
                return;
            }

            if (password.length < 12 || password.length > 72) {
                setMessage(
                    "Your password must contain 12–72 characters.",
                    "error"
                );
                return;
            }

            if (password !== confirmPassword) {
                setMessage(
                    "Your passwords do not match.",
                    "error"
                );
                return;
            }

            submitButton.disabled = true;
            submitButton.textContent = "Creating account…";
            setMessage("Creating your administrator account…");

            try {
                const signupResponse = await fetch(SIGNUP_API, {
                    method: "POST",
                    credentials: "same-origin",
                    cache: "no-store",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json"
                    },
                    body: JSON.stringify({
                        token,
                        full_name: fullName,
                        password,
                        confirm_password: confirmPassword
                    })
                });

                const result = await parseResponse(signupResponse);

                if (!signupResponse.ok || !result.success) {
                    throw new Error(
                        result.message || "Unable to create your account."
                    );
                }

                form.hidden = true;
                institutionCard.hidden = true;

                setMessage(
                    "Your administrator account has been created. Redirecting to sign in…",
                    "success"
                );

                window.setTimeout(() => {
                    window.location.replace(LOGIN_PAGE);
                }, 1200);

            } catch (error) {
                setMessage(
                    error.message || "Unable to create your account.",
                    "error"
                );
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = "Create administrator account";
            }
        });

    } catch (error) {
        setMessage(
            error.message || "Unable to verify your invitation.",
            "error"
        );
    }
}
