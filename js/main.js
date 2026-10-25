/* =========================================================
   FOUNDEV — MAIN JAVASCRIPT
   Learn. Build. Launch.
========================================================= */

"use strict";

/* =========================================================
   01. DOM READY
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    initializeFooterYear();
    initializeMobileNavigation();
    initializeSmoothNavigation();
    initializeProjectFilters();
    initializeCardInteractions();
    initializeHeaderScroll();
});


/* =========================================================
   02. AUTOMATIC FOOTER YEAR
========================================================= */

function initializeFooterYear() {
    const yearElement = document.getElementById("current-year");

    if (!yearElement) return;

    yearElement.textContent = new Date().getFullYear();
}


/* =========================================================
   03. MOBILE NAVIGATION
   Adds a menu button dynamically, so no HTML changes
   are required for the initial implementation.
========================================================= */

function initializeMobileNavigation() {
    const header = document.querySelector(".site-header");
    const headerInner = document.querySelector(".header-inner");
    const navigation = document.querySelector(".main-nav");

    if (!header || !headerInner || !navigation) return;

    // Avoid creating duplicate menu buttons.
    if (headerInner.querySelector(".mobile-menu-toggle")) return;

    const menuButton = document.createElement("button");

    menuButton.type = "button";
    menuButton.className = "mobile-menu-toggle";
    menuButton.setAttribute("aria-label", "Open navigation menu");
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-controls", "foundev-main-navigation");

    menuButton.innerHTML = `
        <span></span>
        <span></span>
    `;

    navigation.id = "foundev-main-navigation";

    headerInner.appendChild(menuButton);

    const mobileQuery = window.matchMedia("(max-width: 700px)");

    function closeMenu() {
        header.classList.remove("menu-open");

        menuButton.setAttribute("aria-expanded", "false");
        menuButton.setAttribute("aria-label", "Open navigation menu");
    }

    function openMenu() {
        header.classList.add("menu-open");

        menuButton.setAttribute("aria-expanded", "true");
        menuButton.setAttribute("aria-label", "Close navigation menu");
    }

    menuButton.addEventListener("click", () => {
        const isOpen =
            menuButton.getAttribute("aria-expanded") === "true";

        if (isOpen) {
            closeMenu();
        } else {
            openMenu();
        }
    });

    // Close the menu after selecting a navigation link.
    navigation.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", closeMenu);
    });

    // Close when switching to desktop layout.
    mobileQuery.addEventListener("change", (event) => {
        if (!event.matches) {
            closeMenu();
        }
    });

    // Close on Escape.
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeMenu();
        }
    });

    // Close when clicking outside the header.
    document.addEventListener("click", (event) => {
        if (
            !header.contains(event.target) &&
            menuButton.getAttribute("aria-expanded") === "true"
        ) {
            closeMenu();
        }
    });
}


/* =========================================================
   04. SMOOTH NAVIGATION
   Handles links pointing to sections on the current page.
========================================================= */

function initializeSmoothNavigation() {
    const anchorLinks = document.querySelectorAll('a[href^="#"]');

    anchorLinks.forEach((link) => {
        link.addEventListener("click", (event) => {
            const href = link.getAttribute("href");

            if (!href || href === "#") return;

            const target = document.querySelector(href);

            if (!target) return;

            event.preventDefault();

            target.scrollIntoView({
                behavior: window.matchMedia(
                    "(prefers-reduced-motion: reduce)"
                ).matches ? "auto" : "smooth",
                block: "start"
            });

            // Preserve normal anchor-link behavior in the URL.
            if (window.location.hash !== href) {
                history.pushState(null, "", href);
            }
        });
    });
}


/* =========================================================
   05. PROJECT FILTERS
   The homepage category links navigate to projects.html.
   This adds active feedback to the current page's filters.
========================================================= */

function initializeProjectFilters() {
    const filters = document.querySelectorAll(".filter-link");

    if (!filters.length) return;

    const currentURL = new URL(window.location.href);
    const currentDomain = currentURL.searchParams.get("domain");

    filters.forEach((filter) => {
        const filterURL = new URL(
            filter.href,
            window.location.origin
        );

        const filterDomain = filterURL.searchParams.get("domain");

        const isActive = currentDomain
            ? filterDomain === currentDomain
            : !filterDomain;

        filter.classList.toggle("active", isActive);

        if (isActive) {
            filter.setAttribute("aria-current", "page");
        } else {
            filter.removeAttribute("aria-current");
        }
    });
}


/* =========================================================
   06. PROJECT CARD INTERACTIONS
   Enhances keyboard accessibility without making cards
   interfere with their existing links.
========================================================= */

function initializeCardInteractions() {
    const cards = document.querySelectorAll(".project-card");

    cards.forEach((card) => {
        const links = card.querySelectorAll("a");

        links.forEach((link) => {
            link.addEventListener("focus", () => {
                card.classList.add("is-focused");
            });

            link.addEventListener("blur", () => {
                if (!card.contains(document.activeElement)) {
                    card.classList.remove("is-focused");
                }
            });
        });
    });
}


/* =========================================================
   07. HEADER SCROLL STATE
   Adds a class after the page scrolls.
========================================================= */

function initializeHeaderScroll() {
    const header = document.querySelector(".site-header");

    if (!header) return;

    let ticking = false;

    function updateHeader() {
        header.classList.toggle(
            "is-scrolled",
            window.scrollY > 12
        );

        ticking = false;
    }

    window.addEventListener("scroll", () => {
        if (ticking) return;

        ticking = true;
        window.requestAnimationFrame(updateHeader);
    }, { passive: true });

    updateHeader();
}