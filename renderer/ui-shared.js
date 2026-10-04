// Classic script, loaded first of the app modules: shared constants, DOM roots, workspace hydration, status toast, string helpers.
const STORAGE_KEY = "notch-todo-data";
const PRIORITIES = ["P0", "P1", "P2", "P3"];
const TODO_CATEGORY_KEY = "notch-todo-category-names-v1";
const TODO_CATEGORY_DEFAULTS = {
	P0: "Courses",
	P1: "Media & Writing",
	P2: "Vibe coding",
	P3: "Daily",
};

const app = document.getElementById("app");
const notch = document.getElementById("notch");
const panel = document.getElementById("panel");
const statusToast = document.getElementById("status-toast");
const statusToastMessage = document.getElementById("status-toast-message");
const statusToastAction = document.getElementById("status-toast-action");

function collectLocalStorageSnapshot() {
	const result = {};
	for (let index = 0; index < localStorage.length; index += 1) {
		const key = localStorage.key(index);
		if (key) result[key] = localStorage.getItem(key);
	}
	return result;
}

let workspaceReloadPending = false;
async function hydratePortableWorkspace() {
	if (!window.notchAPI?.loadWorkspaceData) return;
	try {
		const snapshot = await window.notchAPI.loadWorkspaceData();
		let imported = false;
		if (
			sessionStorage.getItem("notch-workspace-hydrated") !== "1" &&
			snapshot &&
			typeof snapshot === "object"
		) {
			Object.entries(snapshot).forEach(([key, value]) => {
				if (typeof value === "string" && localStorage.getItem(key) === null) {
					localStorage.setItem(key, value);
					imported = true;
				}
			});
			sessionStorage.setItem("notch-workspace-hydrated", "1");
		}
		if (imported) {
			// The current editors were initialized before the asynchronous import.
			// Their unload/visibility handlers must not overwrite recovered values.
			workspaceReloadPending = true;
			location.reload();
			return;
		}
		setInterval(
			() =>
				window.notchAPI
					.saveWorkspaceData(collectLocalStorageSnapshot())
					.catch(() => {}),
			2000,
		);
		// 恢复流程可能整页重载；只有确定不再重载后才接收外部导入。
		startTodoInbox();
	} catch (error) {}
}
// Do not interrupt parser-loaded workspace scripts with a recovery navigation.
if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", hydratePortableWorkspace, {
		once: true,
	});
} else {
	hydratePortableWorkspace();
}
window.notchAPI?.onWorkspaceChanged?.(() => {
	sessionStorage.removeItem("notch-workspace-hydrated");
	window.notchAPI
		.saveWorkspaceData(collectLocalStorageSnapshot())
		.finally(() => location.reload());
});

let statusToastTimer = null;
let statusToastHideTimer = null;
let statusToastActionHandler = null;
let statusToastExpireHandler = null;

function dismissStatusToast(commitPending = true) {
	if (statusToastTimer) clearTimeout(statusToastTimer);
	if (statusToastHideTimer) clearTimeout(statusToastHideTimer);
	statusToastTimer = null;
	statusToastHideTimer = null;
	const onExpire = statusToastExpireHandler;
	statusToastExpireHandler = null;
	statusToastActionHandler = null;
	const actionHadFocus = statusToastAction === document.activeElement;
	if (actionHadFocus) {
		const activeTabButton = document.querySelector(".tab.active");
		if (activeTabButton) activeTabButton.focus({ preventScroll: true });
	}
	if (statusToast) {
		statusToast.classList.remove("visible");
		statusToast.setAttribute("aria-hidden", "true");
	}
	if (statusToastAction) statusToastAction.hidden = true;
	statusToastHideTimer = setTimeout(() => {
		statusToastHideTimer = null;
		if (statusToast) statusToast.hidden = true;
		if (statusToastMessage) statusToastMessage.textContent = "";
	}, 180);
	if (commitPending && onExpire) onExpire();
}

function showStatusToast(message, options = {}) {
	dismissStatusToast(true);
	if (!statusToast || !statusToastMessage) return;
	const { actionLabel, onAction, onExpire, duration = 1800 } = options;
	if (statusToastHideTimer) clearTimeout(statusToastHideTimer);
	statusToastHideTimer = null;
	statusToast.hidden = false;
	statusToast.setAttribute("aria-hidden", "false");
	statusToastMessage.textContent = message;
	statusToastActionHandler = typeof onAction === "function" ? onAction : null;
	statusToastExpireHandler = typeof onExpire === "function" ? onExpire : null;
	if (statusToastAction && statusToastActionHandler) {
		statusToastAction.textContent = actionLabel || "Undo";
		statusToastAction.hidden = false;
	}
	statusToast.classList.add("visible");
	statusToastTimer = setTimeout(() => dismissStatusToast(true), duration);
}

if (statusToastAction) {
	statusToastAction.addEventListener("click", () => {
		const handler = statusToastActionHandler;
		dismissStatusToast(false);
		if (handler) handler();
	});
}

window.addEventListener("beforeunload", () => dismissStatusToast(true));

function generateId() {
	return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function checkSvg() {
	return '<svg viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}

function escapeHtml(str) {
	return String(str)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function pad2(n) {
	return n < 10 ? "0" + n : String(n);
}
