
"use strict";

document.addEventListener("DOMContentLoaded", () => {
    initApplicationsPage();
});

const APPLICATIONS_API = "../backend/api/admin/applications.php";

const applicationState = {
    page: 1,
    perPage: 10,
    search: "",
    status: "",
    type: "",
    totalPages: 1,
    selectedApplication: null,
    loading: false
};

let searchTimer = null;

async function initApplicationsPage() {
    bindApplicationEvents();
    await loadApplications();
}

function bindApplicationEvents() {
    document.getElementById("applications-refresh")
        ?.addEventListener("click", () => loadApplications());

document.getElementById("send-institution-invitation")
    ?.addEventListener("click", sendInstitutionInvitation);

    document.getElementById("applications-search")
        ?.addEventListener("input", (event) => {
            clearTimeout(searchTimer);

            searchTimer = setTimeout(() => {
                applicationState.search = event.target.value.trim();
                applicationState.page = 1;
                loadApplications();
            }, 300);
        });

    document.getElementById("applications-status")
        ?.addEventListener("change", (event) => {
            applicationState.status = event.target.value;
            applicationState.page = 1;
            loadApplications();
        });

    document.getElementById("applications-type")
        ?.addEventListener("change", (event) => {
            applicationState.type = event.target.value;
            applicationState.page = 1;
            loadApplications();
        });

    document.getElementById("applications-clear-filters")
        ?.addEventListener("click", clearApplicationFilters);

    document.getElementById("applications-prev")
        ?.addEventListener("click", () => {
            if (applicationState.page > 1) {
                applicationState.page--;
                loadApplications();
            }
        });

    document.getElementById("applications-next")
        ?.addEventListener("click", () => {
            if (applicationState.page < applicationState.totalPages) {
                applicationState.page++;
                loadApplications();
            }
        });

    document.getElementById("applications-table-body")
        ?.addEventListener("click", (event) => {
            const button = event.target.closest("[data-application-id]");
            if (!button) return;

            openApplicationDetails(button.dataset.applicationId);
        });

    document.getElementById("application-modal-close")
        ?.addEventListener("click", closeApplicationModal);

    document.getElementById("application-detail-modal")
        ?.addEventListener("click", (event) => {
            if (event.target.id === "application-detail-modal") {
                closeApplicationModal();
            }
        });

    document.querySelectorAll("[data-review-status]")
        .forEach((button) => {
            button.addEventListener("click", () => {
                updateApplicationStatus(button.dataset.reviewStatus, button);
            });
        });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeApplicationModal();
    });
}

async function loadApplications() {
    if (applicationState.loading) return;

    applicationState.loading = true;
    setRefreshLoading(true);

    const params = new URLSearchParams({
        page: String(applicationState.page),
        per_page: String(applicationState.perPage),
        search: applicationState.search,
        status: applicationState.status,
        type: applicationState.type
    });

    try {
        const response = await fetch(`${APPLICATIONS_API}?${params}`, {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
            headers: { "Accept": "application/json" }
        });

        const data = await readJsonResponse(response);

        if (response.status === 401) {
            window.location.href = "login.html";
            return;
        }

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Unable to load applications.");
        }

        renderSummary(data.summary || {});
        renderApplications(data.applications || []);
        renderPagination(data.pagination || {});
        updateApplicationsBadge(data.summary?.pending ?? 0);

        setApplicationsResultCount(data.pagination?.total ?? 0);
    } catch (error) {
        console.error("[Foundev Applications]", error);

        showApplicationsError(
            error.message || "Unable to load applications."
        );
        showAdminToast(
            error.message || "Unable to load applications.",
            "error"
        );
    } finally {
        applicationState.loading = false;
        setRefreshLoading(false);
    }
}

async function readJsonResponse(response) {
    const text = await response.text();

    try {
        return JSON.parse(text);
    } catch {
        throw new Error(
            response.ok
                ? "The server returned an invalid response."
                : `Server error (${response.status}). Check the PHP error log.`
        );
    }
}

function renderSummary(summary) {
    setText("summary-total", formatNumber(summary.total));
    setText("summary-pending", formatNumber(summary.pending));
    setText("summary-review", formatNumber(summary.under_review));
    setText("summary-approved", formatNumber(summary.approved));
}

function renderApplications(applications) {
    const tbody = document.getElementById("applications-table-body");
    if (!tbody) return;

    tbody.replaceChildren();

    if (!applications.length) {
        tbody.appendChild(createEmptyRow(
            "No applications found",
            "Try changing your search or filters."
        ));
        return;
    }

    applications.forEach((application) => {
        const row = document.createElement("tr");

        const appCell = document.createElement("td");
        const appNumber = document.createElement("strong");
        appNumber.className = "application-number";
        appNumber.textContent = application.application_number || "—";

        const appType = document.createElement("small");
        appType.className = "application-type";
        appType.textContent = formatInstitutionType(application.institution_type);

        appCell.append(appNumber, document.createElement("br"), appType);

        const institutionCell = document.createElement("td");
        const institutionName = document.createElement("strong");
        institutionName.textContent =
            application.display_name ||
            application.official_name ||
            "Unnamed institution";

        const officialName = document.createElement("small");
        officialName.className = "application-secondary";
        officialName.textContent = application.official_name || "";

        institutionCell.append(institutionName, document.createElement("br"), officialName);

        const representativeCell = document.createElement("td");
        const repName = document.createElement("span");
        repName.textContent = application.representative_name || "—";

        const repEmail = document.createElement("small");
        repEmail.className = "application-secondary";
        repEmail.textContent = application.official_email || "No email";

        representativeCell.append(repName, document.createElement("br"), repEmail);

        const locationCell = document.createElement("td");
        locationCell.textContent = [
            application.city,
            application.state_region,
            application.country
        ].filter(Boolean).join(", ") || "—";

        const submittedCell = document.createElement("td");
        submittedCell.textContent = formatDate(
            application.submitted_at || application.created_at
        );

        const statusCell = document.createElement("td");
        const statusBadge = document.createElement("span");
        statusBadge.className =
            `admin-status-badge ${getStatusClass(application.status)}`;
        statusBadge.textContent = formatStatus(application.status);
        statusCell.appendChild(statusBadge);

        const actionCell = document.createElement("td");
        const viewButton = document.createElement("button");
        viewButton.type = "button";
        viewButton.className = "admin-btn admin-btn-light";
        viewButton.textContent = "Review";
        viewButton.dataset.applicationId = String(application.id);
        viewButton.setAttribute(
            "aria-label",
            `Review application ${application.application_number || ""}`
        );
        actionCell.appendChild(viewButton);

        row.append(
            appCell,
            institutionCell,
            representativeCell,
            locationCell,
            submittedCell,
            statusCell,
            actionCell
        );

        tbody.appendChild(row);
    });
}

function createEmptyRow(title, description) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 7;

    const empty = document.createElement("div");
    empty.className = "admin-empty-state";

    const heading = document.createElement("strong");
    heading.textContent = title;

    const paragraph = document.createElement("p");
    paragraph.textContent = description;

    empty.append(heading, paragraph);
    cell.appendChild(empty);
    row.appendChild(cell);

    return row;
}

function showApplicationsError(message) {
    const tbody = document.getElementById("applications-table-body");
    if (!tbody) return;

    tbody.replaceChildren();
    tbody.appendChild(createEmptyRow(
        "Unable to load applications",
        message
    ));
}

function renderPagination(pagination) {
    applicationState.page = Number(pagination.page || 1);
    applicationState.totalPages = Number(pagination.total_pages || 1);

    const total = Number(pagination.total || 0);
    const start = total === 0
        ? 0
        : ((applicationState.page - 1) * applicationState.perPage) + 1;
    const end = Math.min(
        applicationState.page * applicationState.perPage,
        total
    );

    setText(
        "applications-pagination-label",
        total === 0
            ? "0 applications"
            : `Showing ${start}–${end} of ${formatNumber(total)} applications`
    );

    setText(
        "applications-page-number",
        `Page ${applicationState.page} of ${applicationState.totalPages}`
    );

    const previous = document.getElementById("applications-prev");
    const next = document.getElementById("applications-next");

    if (previous) previous.disabled = applicationState.page <= 1;
    if (next) next.disabled = applicationState.page >= applicationState.totalPages;
}

function setApplicationsResultCount(total) {
    setText(
        "applications-result-count",
        `${formatNumber(total)} application${Number(total) === 1 ? "" : "s"} match your current filters`
    );
}

function updateApplicationsBadge(count) {
    const badge = document.getElementById("applications-nav-count");
    if (!badge) return;

    badge.textContent = formatNumber(count);
    badge.hidden = Number(count) === 0;
}

function clearApplicationFilters() {
    applicationState.page = 1;
    applicationState.search = "";
    applicationState.status = "";
    applicationState.type = "";

    const search = document.getElementById("applications-search");
    const status = document.getElementById("applications-status");
    const type = document.getElementById("applications-type");

    if (search) search.value = "";
    if (status) status.value = "";
    if (type) type.value = "";

    loadApplications();
}

async function openApplicationDetails(id) {
    try {
        const params = new URLSearchParams({
            action: "detail",
            id: String(id)
        });

        const response = await fetch(`${APPLICATIONS_API}?${params}`, {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
            headers: { "Accept": "application/json" }
        });

        const data = await readJsonResponse(response);

        if (response.status === 401) {
            window.location.href = "login.html";
            return;
        }

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Unable to load application details.");
        }

        applicationState.selectedApplication = data.application;
        renderApplicationDetails(data.application);

        const modal = document.getElementById("application-detail-modal");
        if (modal) {
            modal.setAttribute("aria-hidden", "false");
            modal.classList.add("is-open");
            document.body.classList.add("admin-modal-open");
            document.getElementById("application-modal-close")?.focus();
        }
    } catch (error) {
        console.error("[Foundev Application Detail]", error);
        showAdminToast(error.message || "Unable to open application.", "error");
    }
}

function renderApplicationDetails(application) {
    setText("app-detail-number", application.application_number || "—");

    const grid = document.getElementById("application-detail-grid");
    if (!grid) return;

    grid.replaceChildren();

    const details = [
        ["Institution name", application.display_name || application.official_name],
        ["Official name", application.official_name],
        ["Institution type", formatInstitutionType(application.institution_type)],
        ["Registration number", application.registration_number],
        ["Website", application.website],
        ["Representative", application.representative_name],
        ["Designation", application.representative_designation],
        ["Official email", application.official_email],
        ["Phone", application.official_phone],
        ["Location", [
            application.address,
            application.city,
            application.state_region,
            application.postal_code,
            application.country
        ].filter(Boolean).join(", ")],
        ["Estimated students", application.estimated_student_count],
        ["Estimated mentors", application.estimated_mentor_count],
        ["Email verified", application.email_verified_at ? "Yes" : "Not verified"],
        ["Submitted", formatDate(application.submitted_at || application.created_at)],
        ["Last updated", formatDate(application.updated_at)],
        ["Status", formatStatus(application.status)],
        ["Departments / academic summary", application.department_summary]
    ];

    details.forEach(([label, value]) => {
        const item = document.createElement("div");
        item.className = "admin-detail-item";

        const term = document.createElement("span");
        term.className = "admin-detail-label";
        term.textContent = label;

        const description = document.createElement("div");
        description.className = "admin-detail-value";
        description.textContent = value || "—";

        item.append(term, description);
        grid.appendChild(item);
    });

    const notes = document.getElementById("review-notes");
    if (notes) notes.value = application.review_notes || "";

    const isFinal = ["approved", "rejected"].includes(application.status);

    document.querySelectorAll("[data-review-status]").forEach((button) => {
        button.disabled = isFinal;
        button.title = isFinal
            ? "This application has a final decision."
            : "";
    });
    
const invitationPanel = document.getElementById(
    "institution-invitation-panel"
);
const invitationEmail = document.getElementById("invitation-email");
const invitationStatus = document.getElementById("invitation-email-status");
const invitationButton = document.getElementById(
    "send-institution-invitation"
);

const canInvite = application.status === "approved";

if (invitationPanel) {
    invitationPanel.hidden = !canInvite;
}

if (invitationEmail) {
    invitationEmail.value = application.official_email || "";
}

if (invitationStatus) {
    invitationStatus.textContent = "";
}

if (invitationButton) {
    invitationButton.disabled = !canInvite;
}

}

async function updateApplicationStatus(status, button) {
    const application = applicationState.selectedApplication;
    if (!application) {
        showAdminToast("Select an application first.", "error");
        return;
    }

    const statusLabels = {
        under_review: "mark this application as under review",
        changes_requested: "request changes from this institution",
        approved: "approve this institution",
        rejected: "reject this application"
    };

    if (!statusLabels[status]) return;

    const notes = document.getElementById("review-notes")?.value.trim() || "";

    if (
        ["changes_requested", "rejected"].includes(status) &&
        !notes
    ) {
        showAdminToast(
            "Add review notes explaining why changes are needed or why the application is rejected.",
            "error"
        );
        document.getElementById("review-notes")?.focus();
        return;
    }

    const confirmed = window.confirm(
        `Are you sure you want to ${statusLabels[status]}?`
    );

    if (!confirmed) return;

    const originalText = button?.textContent;
    if (button) {
        button.disabled = true;
        button.textContent = "Saving…";
    }

    try {
        const response = await fetch(APPLICATIONS_API, {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({
                id: application.id,
                status,
                review_notes: notes
            })
        });

        const data = await readJsonResponse(response);

        if (response.status === 401) {
            window.location.href = "login.html";
            return;
        }

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Unable to update application.");
        }

        showAdminToast(data.message || "Application updated.", "success");
        closeApplicationModal();
        await loadApplications();
    } catch (error) {
        console.error("[Foundev Application Update]", error);
        showAdminToast(error.message || "Unable to update application.", "error");
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = originalText || "Save";
        }
    }
}

function closeApplicationModal() {
    const modal = document.getElementById("application-detail-modal");
    if (!modal) return;

    modal.setAttribute("aria-hidden", "true");
    modal.classList.remove("is-open");
    document.body.classList.remove("admin-modal-open");
    applicationState.selectedApplication = null;
}

function setRefreshLoading(loading) {
    const button = document.getElementById("applications-refresh");
    if (!button) return;

    button.disabled = loading;
    button.textContent = loading ? "Refreshing…" : "Refresh";
}

function formatNumber(value) {
    return new Intl.NumberFormat("en-IN").format(Number(value || 0));
}

function formatInstitutionType(value) {
    const labels = {
        college: "College",
        university: "University",
        school: "School",
        training_institute: "Training institute",
        other: "Other"
    };

    return labels[value] || formatStatus(value);
}

function formatStatus(value) {
    const labels = {
        draft: "Draft",
        submitted: "Pending",
        under_review: "Under review",
        changes_requested: "Changes requested",
        approved: "Approved",
        rejected: "Rejected"
    };

    return labels[value] || String(value || "Unknown")
        .replaceAll("_", " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getStatusClass(status) {
    const classes = {
        submitted: "status-pending",
        under_review: "status-warning",
        changes_requested: "status-warning",
        approved: "status-success",
        rejected: "status-danger"
    };

    return classes[status] || "status-neutral";
}

function formatDate(value) {
    if (!value) return "—";

    const date = new Date(String(value).replace(" ", "T"));

    if (Number.isNaN(date.getTime())) return "—";

    return new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    }).format(date);
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value ?? "—";
}

function showAdminToast(message, type = "info") {
    const container = document.getElementById("admin-toast-container");

    if (!container) {
        console.log(`[Foundev Admin: ${type}]`, message);
        return;
    }

    const toast = document.createElement("div");
    toast.className = `admin-toast admin-toast-${type}`;
    toast.setAttribute("role", type === "error" ? "alert" : "status");
    toast.textContent = message;

    container.appendChild(toast);

    window.setTimeout(() => {
        toast.classList.add("is-leaving");
        window.setTimeout(() => toast.remove(), 250);
    }, 3500);
}

async function sendInstitutionInvitation() {
    const application = applicationState.selectedApplication;

    if (!application || application.status !== "approved") {
        showAdminToast("Approve the institution first.", "error");
        return;
    }

    const emailInput = document.getElementById("invitation-email");
    const statusElement = document.getElementById("invitation-email-status");
    const button = document.getElementById("send-institution-invitation");

    const email = emailInput?.value.trim() || "";

    if (!email || !emailInput.checkValidity()) {
        emailInput?.reportValidity();
        return;
    }

    if (
        email.toLowerCase() !==
        String(application.official_email || "").trim().toLowerCase()
    ) {
        showAdminToast(
            "Use the institution's verified official email address.",
            "error"
        );
        return;
    }

    if (!window.confirm(`Send an invitation email to ${email}?`)) {
        return;
    }

    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = "Sending…";

    if (statusElement) {
        statusElement.textContent = "Sending invitation…";
    }

    try {
        const response = await fetch(
            "../backend/api/institutes/send-invitation.php",
            {
                method: "POST",
                credentials: "same-origin",
                cache: "no-store",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify({
                    application_id: application.id,
                    email
                })
            }
        );

        const data = await readJsonResponse(response);

        if (response.status === 401) {
            window.location.href = "login.html";
            return;
        }

        if (!response.ok || !data.success) {
            throw new Error(
                data.message || "Unable to send the invitation."
            );
        }

        const message = data.message || "Invitation accepted by the email service.";

        if (statusElement) {
            statusElement.textContent = message;
        }

        showAdminToast(message, "success");
    } catch (error) {
        console.error("[Foundev Invitation]", error);

        if (statusElement) {
            statusElement.textContent =
                error.message || "Unable to send invitation.";
        }

        showAdminToast(
            error.message || "Unable to send invitation.",
            "error"
        );
    } finally {
        button.disabled = false;
        button.textContent = originalText;
    }
}
