(function initWorkspaceShared() {
	const Domain = window.NotchDomain;
	if (!Domain) return;

	const icons = {
		COPY_ICON:
			'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
		DELETE_ICON:
			'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V5h6v2M7 7l1 12h8l1-12"/></svg>',
		ADD_ICON:
			'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
		EDIT_ICON:
			'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m4 20 4.5-1 10-10-3.5-3.5-10 10zM13.8 6.7l3.5 3.5"/></svg>',
		OPEN_ICON:
			'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 5h5v5M19 5l-8 8"/><path d="M18 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
	};

	function uid(prefix) {
		if (window.crypto && typeof window.crypto.randomUUID === "function") {
			return `${prefix}-${window.crypto.randomUUID()}`;
		}
		return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
	}

	function loadJson(key, fallback) {
		try {
			const parsed = JSON.parse(localStorage.getItem(key));
			return parsed == null ? fallback : parsed;
		} catch (error) {
			return fallback;
		}
	}

	function saveJson(key, value) {
		try {
			localStorage.setItem(key, JSON.stringify(value));
			return true;
		} catch (error) {
			return false;
		}
	}

	function formatClock(ms) {
		const totalSeconds = Math.max(0, Math.floor(ms / 1000));
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
	}

	function formatShortDate(timestamp) {
		return new Intl.DateTimeFormat("en-US", {
			month: "numeric",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		}).format(new Date(timestamp));
	}

	function createIconButton(action, label, icon, danger = false) {
		const button = document.createElement("button");
		button.className = `icon-button${danger ? " danger" : ""}`;
		button.type = "button";
		button.dataset.action = action;
		button.setAttribute("aria-label", label);
		button.innerHTML = icon;
		return button;
	}

	// Feature modules (loaded after this file, before workspace.js) register into `parts`.
	window.NotchWorkspaceKit = {
		Domain,
		icons,
		uid,
		loadJson,
		saveJson,
		formatClock,
		formatShortDate,
		createIconButton,
		parts: {},
	};
})();
