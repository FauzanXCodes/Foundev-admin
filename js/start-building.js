
"use strict";

(() => {
  const $ = id => document.getElementById(id);
  const screens = [...document.querySelectorAll(".screen")];

  const sourceForm = $("sourceForm");
  const projectForm = $("projectForm");
  const setupForm = $("setupForm");
  const idea = $("projectIdea");
  const readmeFile = $("readmeFile");
  const codeFile = $("codeFile");
  const deadline = $("deadline");

  const MAX_README_SIZE = 2 * 1024 * 1024;
  const MAX_ZIP_SIZE = 25 * 1024 * 1024;

  let readmeText = "";
  let aiAnalysis = null;
  let projectDescription = "";
  let saving = false;
  let savedProjectId = null;

  function selected(name) {
    return document.querySelector(
      `input[name="${name}"]:checked`
    )?.value || "";
  }

  function showError(message) {
    $("formError").textContent = message;
    $("formError").hidden = !message;
  }

  function showAIError(message) {
    $("aiError").textContent = message;
    $("aiError").hidden = !message;
  }

  function showSetupError(message) {
    $("setupError").textContent = message;
    $("setupError").hidden = !message;
  }

  function showScreen(number) {
    screens.forEach(screen => {
      screen.hidden = Number(screen.dataset.screen) !== number;
    });

    const labels = {
      1: "STEP 01 OF 05",
      2: "STEP 02 OF 05",
      3: "STEP 03 OF 05",
      4: "STEP 04 OF 05",
      5: "STEP 05 OF 05"
    };

    const percentage = number * 20;

    $("stepLabel").textContent = labels[number];
    $("stepPercent").textContent = `${percentage}%`;
    $("progressBar").style.width = `${percentage}%`;

    const track = $("progressTrack");
    if (track) {
      track.setAttribute("aria-valuenow", String(percentage));
    }

    window.scrollTo({
      top: 0,
      behavior: window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches ? "auto" : "smooth"
    });
  }

  function setInputMode() {
    const mode = selected("sourceMethod");

    $("ideaPanel").hidden = mode !== "idea";
    $("readmePanel").hidden = mode !== "readme";
    $("codePanel").hidden = mode !== "code";

    $("inputIntro").textContent = {
      idea: "Describe your idea in your own words. No technical terms needed.",
      readme: "Choose your README file. Foundev will analyze its contents.",
      code: "Choose a ZIP of your existing project."
    }[mode];
  }

  sourceForm.addEventListener("change", event => {
    if (event.target.name === "sourceMethod") {
      setInputMode();
    }
  });

  sourceForm.addEventListener("submit", event => {
    event.preventDefault();
    setInputMode();
    showScreen(2);
  });

  idea.addEventListener("input", () => {
    $("ideaCount").textContent = `${idea.value.length} / 5000`;
  });

  readmeFile.addEventListener("change", async () => {
    readmeText = "";
    const file = readmeFile.files[0];

    $("readmeName").textContent = file
      ? file.name
      : "No file selected";

    if (!file) return;

    if (!/\.(md|markdown|txt)$/i.test(file.name)) {
      readmeFile.value = "";
      $("readmeName").textContent = "No file selected";
      showError("Choose a .md, .markdown, or .txt file.");
      return;
    }

    if (file.size > MAX_README_SIZE) {
      readmeFile.value = "";
      $("readmeName").textContent = "No file selected";
      showError("Your README must be 2 MB or smaller.");
      return;
    }

    try {
      readmeText = await file.text();

      if (!readmeText.trim()) {
        readmeText = "";
        showError("The selected README is empty.");
        return;
      }

      showError("");
    } catch {
      showError("Could not read the README. Please try again.");
    }
  });

  codeFile.addEventListener("change", () => {
    const file = codeFile.files[0];

    $("codeName").textContent = file
      ? file.name
      : "No file selected";

    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".zip")) {
      codeFile.value = "";
      $("codeName").textContent = "No file selected";
      showError("Choose a .zip archive.");
      return;
    }

    if (file.size > MAX_ZIP_SIZE) {
      codeFile.value = "";
      $("codeName").textContent = "No file selected";
      showError("Your ZIP must be 25 MB or smaller.");
      return;
    }

    showError("");
  });

  projectForm.addEventListener("submit", async event => {
    event.preventDefault();

    const mode = selected("sourceMethod");
    let description = "";

    if (mode === "idea") {
      description = idea.value.trim();

      if (description.length < 20) {
        showError("Describe your idea in at least 20 characters.");
        idea.focus();
        return;
      }
    } else if (mode === "readme") {
      if (!readmeFile.files[0] || !readmeText.trim()) {
        showError("Choose a valid, readable README first.");
        return;
      }

      description = readmeText.trim();

      const context = $("readmeContext").value.trim();
      if (context) {
        description += "\n\nAdditional student context:\n" + context;
      }

      if (description.length > 8000) {
        showError("Shorten your README and additional context to 8,000 characters.");
        return;
      }
    } else if (mode === "code") {
      if (!codeFile.files[0]) {
        showError("Choose your existing project ZIP first.");
        return;
      }

      showError(
        "ZIP analysis is not implemented yet. Use an idea or README for now."
      );
      return;
    }

    projectDescription = description;
    await analyzeProject(description);
  });

  async function analyzeProject(description) {
    aiAnalysis = null;

    $("aiLoading").hidden = false;
    $("aiOverview").hidden = true;
    $("confirmAI").disabled = true;
    $("confirmAI").textContent = "Analyzing...";
    showAIError("");
    showScreen(3);

    try {
      const response = await fetch(
        "../backend/ai/analyze-project.php",
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({ idea: description })
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success || !result.data) {
        throw new Error(
          result.message || "Project analysis failed. Please try again."
        );
      }

      aiAnalysis = result.data;
      renderAIOverview(aiAnalysis);

      $("aiOverview").hidden = false;
    } catch (error) {
      showAIError(
        error.message || "Could not analyze your project. Please try again."
      );
    } finally {
      $("aiLoading").hidden = true;
      $("confirmAI").disabled = !aiAnalysis;
      $("confirmAI").textContent = "Confirm & personalize →";
    }
  }

  function addTextList(elementId, values) {
    const list = $(elementId);
    list.replaceChildren();

    if (!Array.isArray(values) || values.length === 0) {
      const item = document.createElement("li");
      item.textContent = "No suggestions available.";
      list.append(item);
      return;
    }

    values.forEach(value => {
      const item = document.createElement("li");

      if (typeof value === "string") {
        item.textContent = value;
      } else if (value && typeof value === "object") {
        item.textContent = [
          value.technology || value.step || "",
          value.purpose || value.description || ""
        ].filter(Boolean).join(" — ");
      } else {
        item.textContent = String(value);
      }

      list.append(item);
    });
  }

  function renderAIOverview(data) {
    $("aiProjectTitle").textContent = data.project_title || "Untitled project";
    $("aiProjectDescription").textContent = data.overview || "";
    $("aiDomain").textContent = data.project_domain || "Undetermined";
    $("aiType").textContent = data.project_type || "Undetermined";
    $("aiComplexity").textContent = data.complexity || "Undetermined";
    $("aiProblem").textContent = data.problem_statement || "";

    addTextList("aiUsers", data.target_users);
    addTextList("aiFeatures", data.core_features);
    addTextList("aiTechnologies", data.suggested_tech_stack);
    addTextList("aiRoadmap", data.learning_roadmap);
    addTextList("aiAssumptions", data.assumptions);

    const domain = (data.project_domain || "").toLowerCase();
    const type = (data.project_type || "").toLowerCase();

    if (domain.includes("data science")) {
      $("projectType").value = "Data Science";
    } else if (
      domain.includes("artificial intelligence") ||
      domain.includes("machine learning") ||
      domain === "ai"
    ) {
      $("projectType").value = "AI / Machine learning";
    } else if (domain.includes("iot") || domain.includes("embedded")) {
      $("projectType").value = "IoT / Embedded systems";
    } else if (type.includes("mobile") || domain.includes("mobile")) {
      $("projectType").value = "Mobile app";
    } else if (type.includes("web") || domain.includes("web")) {
      $("projectType").value = "Website / Web app";
    } else {
      $("projectType").value = "Other";
    }
  }

  $("confirmAI").addEventListener("click", () => {
    if (!aiAnalysis) return;
    showScreen(4);
  });

  function getLocalToday() {
    const now = new Date();

    return [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0")
    ].join("-");
  }

  deadline.min = getLocalToday();
  deadline.value = getLocalToday();

  setupForm.addEventListener("submit", event => {
    event.preventDefault();
    showSetupError("");

    if (!deadline.value || deadline.value < getLocalToday()) {
      showSetupError("Choose today or a future deadline.");
      deadline.focus();
      return;
    }

    renderReview();
    showScreen(5);
  });

  function getProjectData() {
    return {
      starting_method: selected("sourceMethod"),
      project_description: projectDescription,
      readme_name: selected("sourceMethod") === "readme"
        ? readmeFile.files[0]?.name || ""
        : "",
      source_zip_name: selected("sourceMethod") === "code"
        ? codeFile.files[0]?.name || ""
        : "",
      existing_goal: selected("sourceMethod") === "code"
        ? $("existingGoal").value
        : "",
      project_type: $("projectType").value,
      skill_level: $("skillLevel").value,
      deadline: deadline.value,
      team_size: $("teamSize").value,
      environment: $("environment").value,
      purpose: $("purpose").value
    };
  }

  function renderReview() {
    const data = getProjectData();
    const review = $("projectReview");

    const methodLabels = {
      idea: "New idea",
      readme: "README upload",
      code: "Existing source-code ZIP"
    };

    const rows = [
      ["Project title", aiAnalysis?.project_title],
      ["AI overview", aiAnalysis?.overview],
      ["Project domain", aiAnalysis?.project_domain],
      ["AI project type", aiAnalysis?.project_type],
      ["Complexity", aiAnalysis?.complexity],
      ["Starting method", methodLabels[data.starting_method]],
      ["Original description", data.project_description],
      ["Project type preference", data.project_type],
      ["Coding experience", data.skill_level],
      ["Target deadline", data.deadline],
      ["Team size", data.team_size],
      ["Development environment", data.environment],
      ["Project purpose", data.purpose]
    ];

    review.replaceChildren();

    rows.forEach(([title, value]) => {
      if (!value) return;

      const item = document.createElement("article");
      item.className = "review-item";

      const heading = document.createElement("h2");
      heading.textContent = title;

      const paragraph = document.createElement("p");
      paragraph.textContent = value;

      item.append(heading, paragraph);
      review.append(item);
    });

    $("saveStatus").textContent =
      "Your project has not been saved yet.";
    $("saveDraft").disabled = false;
    $("saveDraft").textContent = "Confirm project";
  }

  async function saveProject() {
    if (saving) return;

    if (!aiAnalysis) {
      $("saveStatus").textContent = "Analyze your project before saving.";
      return;
    }

    saving = true;

    const button = $("saveDraft");
    button.disabled = true;
    button.textContent = "Saving project...";
    $("saveStatus").textContent = "";

    const data = getProjectData();

    const payload = {
      title: String(aiAnalysis.project_title || "Untitled project"),
      description: data.project_description,
      input_type: data.starting_method,
      project_type: data.project_type,
      skill_level: data.skill_level,
      deadline: data.deadline,
      team_size: data.team_size,
      environment: data.environment,
      purpose: data.purpose,
      analysis: aiAnalysis,
      model: "configured-gemini-model"
    };

    try {
      const response = await fetch(
        "../backend/ai/save-project.php",
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify(payload)
        }
      );

      let result;

      try {
        result = await response.json();
      } catch {
        throw new Error("The server returned an invalid response.");
      }

      if (!response.ok || !result.success || !result.project_id) {
        throw new Error(
          result.message || "Unable to save the project."
        );
      }

      savedProjectId = result.project_id;

      $("saveStatus").textContent =
        `Project saved successfully. Project ID: ${savedProjectId}`;

      button.textContent = "Project saved";
    } catch (error) {
      $("saveStatus").textContent =
        error.message || "Unable to save the project. Please retry.";

      button.disabled = false;
      button.textContent = "Retry saving project";
    } finally {
      saving = false;
    }
  }

  document.querySelectorAll("[data-back]").forEach(button => {
    button.addEventListener("click", () => {
      showScreen(Number(button.dataset.back));
    });
  });

  $("saveDraft").addEventListener("click", saveProject);

  setInputMode();
})();
