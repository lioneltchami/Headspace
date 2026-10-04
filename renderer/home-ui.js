// ============ Home · Pomodoro ============
const pomodoroToggle = document.getElementById("pomodoro-toggle");
const pomodoroReset = document.getElementById("pomodoro-reset");
const homePomodoro = document.getElementById("home-pomodoro");
const pomodoroEndTime = document.getElementById("pomodoro-end-time");
const pomodoroInputs = [
	document.getElementById("pomodoro-minutes"),
	document.getElementById("pomodoro-seconds"),
];
const POMODORO_DURATION_KEY = "dynamic-panel-pomodoro-duration-v3";
let savedPomodoroParts = (() => {
	try {
		const value = JSON.parse(
			localStorage.getItem(POMODORO_DURATION_KEY) || "null",
		);
		if (Array.isArray(value) && value.length === 3) {
			return [
				Math.max(
					0,
					Math.min(60, (Number(value[0]) || 0) * 60 + (Number(value[1]) || 0)),
				),
				Math.max(0, Math.min(60, Number(value[2]) || 0)),
			];
		}
		if (Array.isArray(value) && value.length === 2) {
			return value.map((part) => Math.max(0, Math.min(60, Number(part) || 0)));
		}
	} catch (error) {}
	return [5, 0];
})();
let pomodoroConfiguredSeconds =
	savedPomodoroParts[0] * 60 + savedPomodoroParts[1];
let pomodoroRemaining = pomodoroConfiguredSeconds;
let pomodoroRunning = false;
let pomodoroStarted = false;
let pomodoroTimer = null;

function secondsToParts(seconds) {
	const safe = Math.max(0, Math.floor(seconds));
	return [Math.min(60, Math.floor(safe / 60)), safe % 60];
}

function setPomodoroInputs(parts) {
	pomodoroInputs.forEach((input, index) => {
		if (!input) return;
		input.value = String(parts[index]).padStart(2, "0");
		input.readOnly = pomodoroRunning;
	});
}

function formatPomodoroEndTime(seconds) {
	const target = new Date(Date.now() + Math.max(0, seconds) * 1000);
	return `${pad2(target.getHours())}:${pad2(target.getMinutes())}`;
}

function renderPomodoro() {
	setPomodoroInputs(
		pomodoroStarted ? secondsToParts(pomodoroRemaining) : savedPomodoroParts,
	);
	if (pomodoroEndTime) {
		pomodoroEndTime.textContent = formatPomodoroEndTime(
			pomodoroStarted ? pomodoroRemaining : pomodoroConfiguredSeconds,
		);
	}
	const remainingRatio = pomodoroStarted
		? pomodoroRemaining / Math.max(1, pomodoroConfiguredSeconds)
		: 1;
	homePomodoro?.style.setProperty(
		"--pomodoro-progress",
		String(Math.max(0, Math.min(1, remainingRatio))),
	);
	if (pomodoroToggle) {
		pomodoroToggle.innerHTML = pomodoroRunning
			? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7h3v10H8zM14 7h3v10h-3z" /></svg>'
			: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 7 8 5-8 5z" /></svg>';
		pomodoroToggle.setAttribute(
			"aria-label",
			pomodoroRunning ? "Pause pomodoro" : "Start pomodoro",
		);
	}
	if (pomodoroReset) pomodoroReset.hidden = !pomodoroStarted;
	homePomodoro?.setAttribute(
		"data-state",
		pomodoroRunning ? "running" : pomodoroStarted ? "paused" : "idle",
	);
}

function commitPomodoroInputs() {
	if (pomodoroRunning) return;
	savedPomodoroParts = pomodoroInputs.map((input) =>
		Math.max(0, Math.min(60, Number.parseInt(input?.value || "0", 10) || 0)),
	);
	pomodoroConfiguredSeconds =
		savedPomodoroParts[0] * 60 + savedPomodoroParts[1];
	pomodoroRemaining = pomodoroConfiguredSeconds;
	pomodoroStarted = false;
	localStorage.setItem(
		POMODORO_DURATION_KEY,
		JSON.stringify(savedPomodoroParts),
	);
	renderPomodoro();
}

pomodoroInputs.forEach((input) => {
	if (!input) return;
	input.addEventListener("focus", () => input.select());
	input.addEventListener("input", () => {
		input.value = input.value.replace(/\D/g, "").slice(0, 2);
	});
	input.addEventListener("blur", commitPomodoroInputs);
	input.addEventListener("keydown", (event) => {
		if (event.key === "Enter") {
			event.preventDefault();
			commitPomodoroInputs();
			input.blur();
		}
	});
	input.addEventListener(
		"wheel",
		(event) => {
			if (pomodoroRunning) return;
			event.preventDefault();
			const current = Number.parseInt(input.value || "0", 10) || 0;
			input.value = String(
				Math.max(0, Math.min(60, current + (event.deltaY < 0 ? 1 : -1))),
			).padStart(2, "0");
			commitPomodoroInputs();
			input.focus({ preventScroll: true });
			input.select();
		},
		{ passive: false },
	);
});

pomodoroToggle?.addEventListener("click", () => {
	if (!pomodoroStarted) {
		commitPomodoroInputs();
		if (pomodoroConfiguredSeconds <= 0) {
			showStatusToast("Set a countdown first");
			return;
		}
		pomodoroStarted = true;
		pomodoroRemaining = pomodoroConfiguredSeconds;
	}
	pomodoroRunning = !pomodoroRunning;
	clearInterval(pomodoroTimer);
	pomodoroTimer = null;
	if (pomodoroRunning) {
		pomodoroTimer = setInterval(() => {
			pomodoroRemaining -= 1;
			if (pomodoroRemaining <= 0) {
				const completedMinutes = Math.max(
					1,
					Math.round(pomodoroConfiguredSeconds / 60),
				);
				pomodoroRemaining = pomodoroConfiguredSeconds;
				pomodoroRunning = false;
				pomodoroStarted = false;
				clearInterval(pomodoroTimer);
				pomodoroTimer = null;
				showStatusToast(`${completedMinutes}-minute focus session done`);
				window.notchAPI?.notifyPomodoro?.(completedMinutes).catch(() => {});
			}
			renderPomodoro();
		}, 1000);
	}
	renderPomodoro();
});

pomodoroReset?.addEventListener("click", () => {
	clearInterval(pomodoroTimer);
	pomodoroTimer = null;
	pomodoroRunning = false;
	pomodoroStarted = false;
	pomodoroRemaining = pomodoroConfiguredSeconds;
	renderPomodoro();
});
renderPomodoro();

// ============ Home · 自适应 Bento 布局（长按换位 + Mini/S/M/L组件） ============
const HOME_ORDER_KEY = "notch-home-order-v3";
const HOME_SIZES_KEY = "notch-home-widget-sizes-v2";
const HOME_HIDDEN_MODULES_KEY = "notch-home-hidden-modules-v1";
const HOME_MODULE_REGISTRY = [
	"music",
	"pomodoro",
	"recorder",
	"windows",
	"mirror",
	"note",
	"commands",
];
const unavailableHomeModules = window.NotchPlatform.capabilities(
	window.notchAPI?.platform || "darwin",
).unavailableHomeModules;
const effectiveHomeHidden = (hidden) =>
	window.NotchPlatform.effectiveHiddenModules(
		hidden,
		HOME_MODULE_REGISTRY,
		unavailableHomeModules,
	);
const HOME_ORDER_DEFAULTS = [
	"music",
	"pomodoro",
	"windows",
	"recorder",
	"mirror",
	"note",
	"commands",
];
const HOME_SIZE_DEFAULTS = {
	music: "medium",
	windows: "large",
	recorder: "small",
	mirror: "medium",
	note: "medium",
	commands: "mini",
	pomodoro: "mini",
};
const HOME_SIZE_LABELS = { mini: "Mini", small: "S", medium: "M", large: "L" };
const homeBento = document.getElementById("home-bento");
const homeTiles = homeBento
	? Array.from(homeBento.querySelectorAll("[data-home-module]"))
	: [];

function loadHomeOrder() {
	try {
		const rawSaved = JSON.parse(localStorage.getItem(HOME_ORDER_KEY) || "null");
		const saved = Array.isArray(rawSaved)
			? rawSaved.map((id) => (id === "character" ? "music" : id))
			: rawSaved;
		if (
			Array.isArray(saved) &&
			saved.length === HOME_ORDER_DEFAULTS.length &&
			new Set(saved).size === HOME_ORDER_DEFAULTS.length &&
			saved.every((id) => HOME_ORDER_DEFAULTS.includes(id))
		)
			return saved;

		// 从旧固定槽位布局平滑迁移；原时钟 / 人物位置由Music组件接管。
		const legacy = JSON.parse(
			localStorage.getItem("notch-home-layout-v2") || "null",
		);
		const legacySlots = [
			"tall-left",
			"small-top",
			"medium-top",
			"square-top",
			"tall-right",
			"wide-bottom",
		];
		if (legacy && typeof legacy === "object") {
			const migrated = Object.entries(legacy)
				.sort((a, b) => legacySlots.indexOf(a[1]) - legacySlots.indexOf(b[1]))
				.map(([id]) => (id === "clock" || id === "character" ? "music" : id))
				.filter((id) => HOME_ORDER_DEFAULTS.includes(id));
			if (
				migrated.length === HOME_ORDER_DEFAULTS.length &&
				new Set(migrated).size === migrated.length
			) {
				return migrated;
			}
		}
	} catch (error) {
		// 使用默认顺序。
	}
	return [...HOME_ORDER_DEFAULTS];
}

function loadHomeSizes() {
	try {
		return window.NotchDomain.normalizeHomeWidgetSizes(
			JSON.parse(localStorage.getItem(HOME_SIZES_KEY) || "null"),
			HOME_SIZE_DEFAULTS,
			"",
			48,
		);
	} catch (error) {
		return { ...HOME_SIZE_DEFAULTS };
	}
}

function loadHiddenHomeModules() {
	try {
		const rawText = localStorage.getItem(HOME_HIDDEN_MODULES_KEY);
		if (rawText === null) return { hiddenIds: [], needsRepair: false };
		const parsed = JSON.parse(rawText);
		const hiddenIds = window.NotchDomain.normalizeHiddenHomeModules(
			parsed,
			HOME_MODULE_REGISTRY,
		);
		return {
			hiddenIds,
			needsRepair: JSON.stringify(parsed) !== JSON.stringify(hiddenIds),
		};
	} catch (error) {
		return { hiddenIds: [], needsRepair: true };
	}
}

const homeOrder = loadHomeOrder();
let homeSizes = loadHomeSizes();
const loadedHomeVisibility = loadHiddenHomeModules();
let hiddenHomeModules = loadedHomeVisibility.hiddenIds;
let homeVisibilityPersisted = true;
let homeLayoutReadOnly = false;
let homeLayoutMotionGeneration = 0;
let homeLayoutMotionAnimations = [];
const HOME_LAYOUT_MOTION_MS = 560;
const HOME_LAYOUT_MOTION_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

function saveHomeLayout() {
	try {
		localStorage.setItem(HOME_ORDER_KEY, JSON.stringify(homeOrder));
		localStorage.setItem(HOME_SIZES_KEY, JSON.stringify(homeSizes));
	} catch (error) {
		// LocalStorage 不可用时仍保留当前会话内的布局。
	}
}

function saveHiddenHomeModules() {
	try {
		localStorage.setItem(
			HOME_HIDDEN_MODULES_KEY,
			JSON.stringify(hiddenHomeModules),
		);
		homeVisibilityPersisted = true;
		return true;
	} catch (error) {
		homeVisibilityPersisted = false;
		return false;
	}
}

if (loadedHomeVisibility.needsRepair) saveHiddenHomeModules();

function resolveValidatedHomeLayout(
	hiddenIds,
	order = homeOrder,
	sizes = homeSizes,
) {
	hiddenIds = effectiveHomeHidden(hiddenIds);
	const visibleIds = HOME_MODULE_REGISTRY.filter(
		(id) => !hiddenIds.includes(id),
	);
	const layout = window.NotchDomain.resolveHomeWidgetLayout(
		order,
		sizes,
		hiddenIds,
		12,
		4,
	);
	return window.NotchDomain.validateHomeWidgetLayout(layout, visibleIds, 12, 4)
		? layout
		: null;
}

function cancelHomeLayoutMotion() {
	homeLayoutMotionGeneration += 1;
	homeLayoutMotionAnimations.forEach((animation) => animation.cancel());
	homeLayoutMotionAnimations = [];
	homeBento?.classList.remove("layout-motion-active");
}

function captureHomeLayoutVisualState() {
	if (!homeBento) return null;
	const surface = homeBento.getBoundingClientRect();
	if (!surface.width || !surface.height) return null;
	const tiles = new Map();
	homeTiles.forEach((tile) => {
		if (tile.hidden) return;
		const rect = tile.getBoundingClientRect();
		if (!rect.width || !rect.height) return;
		tiles.set(tile.dataset.homeModule, {
			rect: {
				left: rect.left,
				top: rect.top,
				width: rect.width,
				height: rect.height,
			},
		});
	});
	return { surface: { left: surface.left, top: surface.top }, tiles };
}

function animateCommittedHomeLayout(reason, beforeState) {
	if (
		!homeBento ||
		!beforeState ||
		reason === "initial" ||
		reason === "rollback" ||
		window.matchMedia("(prefers-reduced-motion: reduce)").matches
	)
		return;
	const generation = homeLayoutMotionGeneration;
	const finalTiles = new Map();
	homeTiles.forEach((tile) => {
		if (tile.hidden) return;
		const rect = tile.getBoundingClientRect();
		if (rect.width && rect.height)
			finalTiles.set(tile.dataset.homeModule, { tile, rect });
	});
	homeBento.classList.add("layout-motion-active");

	finalTiles.forEach(({ tile, rect }, moduleId) => {
		const previous = beforeState.tiles.get(moduleId);
		const dx = previous ? previous.rect.left - rect.left : 0;
		const dy = previous ? previous.rect.top - rect.top : 0;
		const scaleX = previous ? previous.rect.width / Math.max(1, rect.width) : 1;
		const scaleY = previous
			? previous.rect.height / Math.max(1, rect.height)
			: 1;
		const moved = Math.abs(dx) >= 0.5 || Math.abs(dy) >= 0.5;
		const resized =
			Math.abs(scaleX - 1) >= 0.01 || Math.abs(scaleY - 1) >= 0.01;
		if (previous && !moved && !resized) return;
		const animation = tile.animate(
			previous
				? [
						{
							opacity: 1,
							transform: `translate(${dx}px, ${dy}px) scale(${scaleX}, ${scaleY})`,
						},
						{ opacity: 1, transform: "translate(0, 0) scale(1, 1)" },
					]
				: [
						{ opacity: 0.72, transform: "translateY(8px) scale(0.98)" },
						{ opacity: 1, transform: "translateY(0) scale(1)" },
					],
			{ duration: HOME_LAYOUT_MOTION_MS, easing: HOME_LAYOUT_MOTION_EASING },
		);
		homeLayoutMotionAnimations.push(animation);
	});

	Promise.allSettled(
		homeLayoutMotionAnimations.map((animation) => animation.finished),
	).then(() => {
		if (generation !== homeLayoutMotionGeneration) return;
		homeLayoutMotionAnimations = [];
		homeBento.classList.remove("layout-motion-active");
	});
}

function applyHomeLayout(layout, { reason = "initial" } = {}) {
	if (!homeBento || !layout)
		throw new Error("A validated homepage layout is required.");
	cancelHomeLayoutMotion();
	const beforeState =
		reason === "initial" || reason === "rollback"
			? null
			: captureHomeLayoutVisualState();
	const automaticLayout =
		!homeLayoutReadOnly && effectiveHomeHidden(hiddenHomeModules).length > 0;
	homeBento.dataset.layoutMode = homeLayoutReadOnly
		? "safe"
		: automaticLayout
			? "automatic"
			: "preferred";
	homeTiles.forEach((tile) => {
		const moduleId = tile.dataset.homeModule;
		const orderIndex = Math.max(0, homeOrder.indexOf(moduleId));
		const size = homeSizes[moduleId] || HOME_SIZE_DEFAULTS[moduleId];
		const placement = layout.placements[moduleId];
		tile.style.order = String(orderIndex);
		tile.dataset.widgetSize = size;
		tile.style.setProperty("--bento-index", String(orderIndex));
		tile.hidden = !placement;
		tile.setAttribute("aria-hidden", String(!placement));
		if (placement) {
			tile.dataset.layoutVariant = layout.variants[moduleId];
			tile.dataset.layoutColumn = String(placement.column);
			tile.dataset.layoutRow = String(placement.row);
			tile.dataset.layoutWidth = String(placement.width);
			tile.dataset.layoutHeight = String(placement.height);
			tile.style.gridColumn = `${placement.column + 1} / span ${placement.width}`;
			tile.style.gridRow = `${placement.row + 1} / span ${placement.height}`;
		} else {
			delete tile.dataset.layoutVariant;
			delete tile.dataset.layoutColumn;
			delete tile.dataset.layoutRow;
			delete tile.dataset.layoutWidth;
			delete tile.dataset.layoutHeight;
			tile.style.removeProperty("grid-column");
			tile.style.removeProperty("grid-row");
		}
		const sizeButton = tile.querySelector("[data-widget-size-cycle]");
		if (sizeButton) {
			sizeButton.dataset.currentSize = size;
			sizeButton.setAttribute(
				"aria-label",
				`${HOME_SIZE_LABELS[size]} widget — click to resize`,
			);
			sizeButton.title = `Widget size: ${HOME_SIZE_LABELS[size]}`;
			sizeButton.hidden = automaticLayout || homeLayoutReadOnly;
			sizeButton.disabled = automaticLayout || homeLayoutReadOnly;
			sizeButton.tabIndex = automaticLayout || homeLayoutReadOnly ? -1 : 0;
		}
	});
	animateCommittedHomeLayout(reason, beforeState);
}

homeTiles.forEach((tile) => {
	const sizeButton = document.createElement("button");
	sizeButton.type = "button";
	sizeButton.className = "widget-size-control motion-icon";
	sizeButton.dataset.widgetSizeCycle = tile.dataset.homeModule;
	sizeButton.innerHTML =
		'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/></svg>';
	tile.appendChild(sizeButton);
});

const homeModuleIds = new Set(homeTiles.map((tile) => tile.dataset.homeModule));
if (
	homeTiles.length !== HOME_MODULE_REGISTRY.length ||
	homeModuleIds.size !== HOME_MODULE_REGISTRY.length ||
	!HOME_MODULE_REGISTRY.every((id) => homeModuleIds.has(id))
) {
	throw new Error(
		"Homepage module registry does not match the rendered tiles.",
	);
}

let initialHomeLayout = resolveValidatedHomeLayout(hiddenHomeModules);
if (!initialHomeLayout) {
	initialHomeLayout = resolveValidatedHomeLayout(
		[],
		HOME_ORDER_DEFAULTS,
		HOME_SIZE_DEFAULTS,
	);
	homeLayoutReadOnly = true;
	console.error("Homepage layout validation failed; using read-only defaults.");
}
if (!initialHomeLayout)
	throw new Error("Default homepage layout validation failed.");
applyHomeLayout(initialHomeLayout, { reason: "initial" });

function visibilitySnapshot() {
	const effectiveHiddenIds = effectiveHomeHidden(
		homeLayoutReadOnly ? [] : hiddenHomeModules,
	);
	return {
		hiddenIds: [...effectiveHiddenIds],
		visibleIds: HOME_MODULE_REGISTRY.filter(
			(id) => !effectiveHiddenIds.includes(id),
		),
		storedHiddenIds: [...hiddenHomeModules],
		automaticLayout: !homeLayoutReadOnly && effectiveHiddenIds.length > 0,
		unavailableIds: [...unavailableHomeModules],
		readOnly: homeLayoutReadOnly,
		persisted: homeVisibilityPersisted,
	};
}

function setHomeModuleVisible(moduleId, visible) {
	const current = [...hiddenHomeModules];
	if (unavailableHomeModules.includes(moduleId))
		return {
			ok: false,
			changed: false,
			error: "unsupported",
			hiddenIds: current,
			persisted: homeVisibilityPersisted,
		};
	const currentlyVisible = visibilitySnapshot().visibleIds;
	if (
		!visible &&
		currentlyVisible.includes(moduleId) &&
		currentlyVisible.length === 1
	) {
		return {
			ok: false,
			changed: false,
			error: "at_least_one_required",
			hiddenIds: current,
			persisted: homeVisibilityPersisted,
		};
	}
	if (homeLayoutReadOnly) {
		return {
			ok: false,
			changed: false,
			error: "layout_read_only",
			hiddenIds: current,
			persisted: homeVisibilityPersisted,
		};
	}
	const next = window.NotchDomain.updateHomeModuleVisibility(
		current,
		HOME_MODULE_REGISTRY,
		moduleId,
		visible,
	);
	if (!next.ok)
		return { ...next, changed: false, persisted: homeVisibilityPersisted };
	const changed = JSON.stringify(next.hiddenIds) !== JSON.stringify(current);
	if (!changed) {
		return {
			ok: true,
			changed: false,
			hiddenIds: current,
			persisted: homeVisibilityPersisted,
		};
	}
	if (
		moduleId === "recorder" &&
		visible === false &&
		window.NotchWorkspace?.isRecordingActive?.()
	) {
		return {
			ok: false,
			changed: false,
			error: "recording_active",
			hiddenIds: current,
			persisted: homeVisibilityPersisted,
		};
	}
	const layout = resolveValidatedHomeLayout(next.hiddenIds);
	const currentLayout = resolveValidatedHomeLayout(current);
	if (!layout || !currentLayout) {
		return {
			ok: false,
			changed: false,
			error: "layout_invalid",
			hiddenIds: current,
			persisted: homeVisibilityPersisted,
		};
	}
	if (moduleId === "mirror" && visible === false) stopMirror();
	try {
		const activeElement = document.activeElement;
		const changingTile = homeTiles.find(
			(tile) => tile.dataset.homeModule === moduleId,
		);
		if (visible === false && changingTile?.contains(activeElement))
			activeElement.blur();
		hiddenHomeModules = next.hiddenIds;
		applyHomeLayout(layout, { reason: "visibility" });
	} catch (error) {
		hiddenHomeModules = current;
		try {
			applyHomeLayout(currentLayout, { reason: "rollback" });
		} catch (rollbackError) {}
		return {
			ok: false,
			changed: false,
			error: "dom_apply_failed",
			hiddenIds: current,
			persisted: homeVisibilityPersisted,
		};
	}
	const persisted = saveHiddenHomeModules();
	const detail = visibilitySnapshot();
	document.dispatchEvent(
		new CustomEvent("notch:home-modules-changed", { detail }),
	);
	return {
		ok: true,
		changed: true,
		hiddenIds: [...hiddenHomeModules],
		persisted,
	};
}

window.NotchHome = Object.freeze({
	getVisibility: visibilitySnapshot,
	isVisible: (moduleId) =>
		visibilitySnapshot().visibleIds.includes(String(moduleId || "")),
	setModuleVisible: setHomeModuleVisible,
});

document.dispatchEvent(
	new CustomEvent("notch:home-modules-changed", {
		detail: visibilitySnapshot(),
	}),
);
if (homeLayoutReadOnly)
	document.dispatchEvent(new CustomEvent("notch:home-layout-error"));

if (homeBento) {
	let pendingLongPress = null;
	let dragState = null;
	let suppressHomeClickUntil = 0;

	const clearDropTarget = () => {
		homeTiles
			.filter((tile) => !tile.hidden)
			.forEach((tile) => tile.classList.remove("layout-drop-target"));
	};

	const finishHomeDrag = (event, cancelled = false) => {
		if (pendingLongPress) clearTimeout(pendingLongPress.timer);
		pendingLongPress = null;
		if (!dragState) return;
		const { tile, target, pointerId } = dragState;
		if (tile.hasPointerCapture?.(pointerId))
			tile.releasePointerCapture(pointerId);
		tile.classList.remove("is-dragging", "hit-test-off");
		tile.style.removeProperty("--home-drag-x");
		tile.style.removeProperty("--home-drag-y");
		homeBento.classList.remove("layout-dragging");
		clearDropTarget();
		if (!cancelled && target && target !== tile) {
			const sourceId = tile.dataset.homeModule;
			const targetId = target.dataset.homeModule;
			const sourceIndex = homeOrder.indexOf(sourceId);
			const targetIndex = homeOrder.indexOf(targetId);
			[homeOrder[sourceIndex], homeOrder[targetIndex]] = [
				homeOrder[targetIndex],
				homeOrder[sourceIndex],
			];
			const layout = resolveValidatedHomeLayout(hiddenHomeModules);
			if (layout) {
				applyHomeLayout(layout, { reason: "reorder" });
				saveHomeLayout();
				showStatusToast("Home layout updated");
			} else {
				[homeOrder[sourceIndex], homeOrder[targetIndex]] = [
					homeOrder[targetIndex],
					homeOrder[sourceIndex],
				];
				showStatusToast("Layout not updated — try again");
			}
		}
		dragState = null;
		suppressHomeClickUntil = Date.now() + 260;
	};

	homeBento.addEventListener("pointerdown", (event) => {
		if (event.button !== 0 || event.isPrimary === false) return;
		const tile = event.target.closest("[data-home-module]");
		if (
			!tile ||
			tile.hidden ||
			event.target.closest(
				"button, input, textarea, select, a, audio, [contenteditable]",
			)
		)
			return;
		const startX = event.clientX;
		const startY = event.clientY;
		pendingLongPress = {
			tile,
			startX,
			startY,
			pointerId: event.pointerId,
			timer: setTimeout(() => {
				if (!pendingLongPress) return;
				tile.setPointerCapture?.(event.pointerId);
				homeBento.classList.add("layout-dragging");
				tile.classList.add("is-dragging");
				dragState = {
					tile,
					target: null,
					pointerId: event.pointerId,
					startX,
					startY,
				};
				pendingLongPress = null;
				if (navigator.vibrate) navigator.vibrate(18);
			}, 420),
		};
	});

	homeBento.addEventListener("click", (event) => {
		const sizeButton = event.target.closest("[data-widget-size-cycle]");
		if (!sizeButton) return;
		event.preventDefault();
		event.stopPropagation();
		if (effectiveHomeHidden(hiddenHomeModules).length > 0 || homeLayoutReadOnly)
			return;
		const moduleId = sizeButton.dataset.widgetSizeCycle;
		const sequence = ["mini", "small", "medium", "large"];
		const current = homeSizes[moduleId] || HOME_SIZE_DEFAULTS[moduleId];
		const requested =
			sequence[(sequence.indexOf(current) + 1) % sequence.length];
		homeSizes = window.NotchDomain.normalizeHomeWidgetSizes(
			{
				...homeSizes,
				[moduleId]: requested,
			},
			HOME_SIZE_DEFAULTS,
			moduleId,
			48,
		);
		const layout = resolveValidatedHomeLayout(hiddenHomeModules);
		if (layout) {
			applyHomeLayout(layout, { reason: "size" });
			saveHomeLayout();
			showStatusToast(
				`${HOME_SIZE_LABELS[homeSizes[moduleId]]} widget · others adjusted`,
			);
		}
	});

	homeBento.addEventListener("pointermove", (event) => {
		if (pendingLongPress) {
			const moved = Math.hypot(
				event.clientX - pendingLongPress.startX,
				event.clientY - pendingLongPress.startY,
			);
			if (moved > 8) {
				clearTimeout(pendingLongPress.timer);
				pendingLongPress = null;
			}
			return;
		}
		if (!dragState || dragState.pointerId !== event.pointerId) return;
		event.preventDefault();
		const { tile, startX, startY } = dragState;
		tile.style.setProperty("--home-drag-x", `${event.clientX - startX}px`);
		tile.style.setProperty("--home-drag-y", `${event.clientY - startY}px`);
		tile.classList.add("hit-test-off");
		const hovered = document
			.elementFromPoint(event.clientX, event.clientY)
			?.closest("[data-home-module]");
		tile.classList.remove("hit-test-off");
		clearDropTarget();
		dragState.target =
			hovered &&
			!hovered.hidden &&
			hovered !== tile &&
			homeBento.contains(hovered)
				? hovered
				: null;
		dragState.target?.classList.add("layout-drop-target");
	});

	homeBento.addEventListener("pointerup", (event) => finishHomeDrag(event));
	homeBento.addEventListener("pointercancel", (event) =>
		finishHomeDrag(event, true),
	);
	homeBento.addEventListener("pointerleave", () => {
		if (!dragState && pendingLongPress) {
			clearTimeout(pendingLongPress.timer);
			pendingLongPress = null;
		}
	});
	homeBento.addEventListener(
		"click",
		(event) => {
			if (Date.now() >= suppressHomeClickUntil) return;
			event.preventDefault();
			event.stopImmediatePropagation();
		},
		true,
	);
}

// ============ 距离感应 Dock 悬浮 ============
function bindDockSurface(surface, selector, maxScale = 1.14) {
	if (!surface) return;
	let frame = null;
	const reset = () => {
		surface.querySelectorAll(selector).forEach((item) => {
			item.style.removeProperty("--dock-scale");
			item.style.removeProperty("--dock-lift");
			item.style.removeProperty("--dock-glow");
		});
	};
	surface.addEventListener("pointermove", (event) => {
		if (frame) cancelAnimationFrame(frame);
		frame = requestAnimationFrame(() => {
			frame = null;
			surface.querySelectorAll(selector).forEach((item) => {
				const rect = item.getBoundingClientRect();
				const centerX = rect.left + rect.width / 2;
				const centerY = rect.top + rect.height / 2;
				const distance = Math.hypot(
					event.clientX - centerX,
					event.clientY - centerY,
				);
				const radius = Math.max(72, Math.min(150, rect.width * 2.2));
				const strength = Math.max(0, 1 - distance / radius) ** 2;
				item.style.setProperty(
					"--dock-scale",
					(1 + (maxScale - 1) * strength).toFixed(3),
				);
				item.style.setProperty(
					"--dock-lift",
					`${(-5 * strength).toFixed(2)}px`,
				);
				item.style.setProperty("--dock-glow", strength.toFixed(3));
			});
		});
	});
	surface.addEventListener("pointerleave", reset);
}

[["#window-list", ".window-item", 1.12]].forEach(
	([surfaceSelector, itemSelector, scale]) => {
		document.querySelectorAll(surfaceSelector).forEach((surface) => {
			bindDockSurface(surface, itemSelector, scale);
		});
	},
);

// ============ Home · 人像镜面（局部水波折射） ============
const homeMirror = document.querySelector(".home-mirror");
const mirrorStage = document.getElementById("mirror-stage");
const mirrorPhotos = Array.from(document.querySelectorAll(".mirror-photo"));

function applyMirrorCover(dataUrl) {
	if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) return;
	mirrorPhotos.forEach((image) => {
		image.src = dataUrl;
	});
}

if (window.notchAPI && typeof window.notchAPI.getMirrorImage === "function") {
	window.notchAPI
		.getMirrorImage()
		.then(applyMirrorCover)
		.catch(() => {});
}
if (
	window.notchAPI &&
	typeof window.notchAPI.onMirrorImageChanged === "function"
) {
	window.notchAPI.onMirrorImageChanged(applyMirrorCover);
}
const mirrorVideo = document.getElementById("mirror-video");
const mirrorDisplacement = document.getElementById("mirror-displacement");
const mirrorWaterCanvas = document.getElementById("mirror-water-canvas");
const mirrorPixelReveal = document.getElementById("mirror-pixel-reveal");
let mirrorLiquidFrame = null;
let mirrorLiquidScale = 0;
let mirrorLastPoint = null;
let mirrorWaterFrame = null;
let mirrorLastTrailAt = 0;
let mirrorWaterRipples = [];
let mirrorStream = null;
let mirrorStarting = false;
let mirrorSession = 0;
let mirrorZoom = 1;
// 虚拟摄像头宿主没开时 getUserMedia 照样成功但永远不出帧，play() 会一直挂起。
const MIRROR_FIRST_FRAME_TIMEOUT_MS = 3000;

function replayMirrorPixelReveal() {
	if (!mirrorPixelReveal || !homeMirror || activeTab !== "home") return;
	if (!mirrorPixelReveal.childElementCount) {
		const fragment = document.createDocumentFragment();
		for (let index = 0; index < 80; index++) {
			const pixel = document.createElement("i");
			const row = Math.floor(index / 10);
			const column = index % 10;
			pixel.style.setProperty(
				"--pixel-delay",
				`${row * 24 + column * 13 + ((row + column) % 3) * 17}ms`,
			);
			fragment.appendChild(pixel);
		}
		mirrorPixelReveal.appendChild(fragment);
	}
	mirrorPixelReveal.classList.remove("revealing");
	void mirrorPixelReveal.offsetWidth;
	mirrorPixelReveal.classList.add("revealing");
	setTimeout(() => mirrorPixelReveal.classList.remove("revealing"), 1120);
}

function resizeMirrorWaterCanvas() {
	if (!mirrorWaterCanvas || !mirrorStage) return null;
	const bounds = mirrorStage.getBoundingClientRect();
	const dpr = Math.min(2, window.devicePixelRatio || 1);
	const width = Math.max(1, Math.round(bounds.width * dpr));
	const height = Math.max(1, Math.round(bounds.height * dpr));
	if (
		mirrorWaterCanvas.width !== width ||
		mirrorWaterCanvas.height !== height
	) {
		mirrorWaterCanvas.width = width;
		mirrorWaterCanvas.height = height;
	}
	return { bounds, dpr };
}

function animateMirrorWater(now) {
	const metrics = resizeMirrorWaterCanvas();
	const context = mirrorWaterCanvas?.getContext("2d");
	if (!metrics || !context) {
		mirrorWaterFrame = null;
		return;
	}
	context.clearRect(0, 0, mirrorWaterCanvas.width, mirrorWaterCanvas.height);
	mirrorWaterRipples = mirrorWaterRipples.filter(
		(ripple) => now - ripple.startedAt < 1250,
	);
	context.save();
	context.scale(metrics.dpr, metrics.dpr);
	context.globalCompositeOperation = "screen";
	mirrorWaterRipples.forEach((ripple) => {
		const progress = Math.min(1, (now - ripple.startedAt) / 1250);
		const eased = 1 - (1 - progress) ** 3;
		for (let ring = 0; ring < 3; ring++) {
			const radius = 6 + eased * (34 + ripple.speed * 1.8) + ring * 7;
			context.beginPath();
			context.arc(ripple.x, ripple.y, radius, 0, Math.PI * 2);
			context.strokeStyle = `rgba(190, 222, 255, ${Math.max(0, (1 - progress) * (0.17 - ring * 0.035))})`;
			context.lineWidth = Math.max(0.65, 1.55 - progress);
			context.stroke();
		}
	});
	context.restore();
	if (mirrorWaterRipples.length)
		mirrorWaterFrame = requestAnimationFrame(animateMirrorWater);
	else mirrorWaterFrame = null;
}

function addMirrorWaterRipple(x, y, speed) {
	mirrorWaterRipples.push({
		x,
		y,
		speed: Math.min(18, speed),
		startedAt: performance.now(),
	});
	if (mirrorWaterRipples.length > 18) mirrorWaterRipples.shift();
	if (!mirrorWaterFrame)
		mirrorWaterFrame = requestAnimationFrame(animateMirrorWater);
}

function setMirrorZoom(value) {
	mirrorZoom = value;
	mirrorStage?.style.setProperty("--mirror-zoom", String(mirrorZoom));
}

function stopMirror() {
	mirrorSession += 1;
	if (mirrorStream) {
		mirrorStream.getTracks().forEach((track) => track.stop());
		mirrorStream = null;
	}
	if (mirrorVideo) {
		mirrorVideo.pause();
		mirrorVideo.srcObject = null;
	}
	mirrorStarting = false;
	setMirrorZoom(1);
	if (mirrorLiquidFrame) cancelAnimationFrame(mirrorLiquidFrame);
	mirrorLiquidFrame = null;
	mirrorLiquidScale = 0;
	mirrorLastPoint = null;
	mirrorWaterRipples = [];
	if (mirrorWaterFrame) cancelAnimationFrame(mirrorWaterFrame);
	mirrorWaterFrame = null;
	const waterContext = mirrorWaterCanvas?.getContext("2d");
	waterContext?.clearRect(
		0,
		0,
		mirrorWaterCanvas.width,
		mirrorWaterCanvas.height,
	);
	mirrorDisplacement?.setAttribute("scale", "0");
	homeMirror?.classList.remove(
		"live",
		"camera-starting",
		"liquid-active",
		"ripple-active",
	);
	mirrorStage?.setAttribute("aria-label", "Open live mirror");
	mirrorStage?.setAttribute("aria-pressed", "false");
	mirrorStage?.removeAttribute("aria-busy");
}

function isMirrorSessionActive(session) {
	return (
		session === mirrorSession &&
		mirrorStarting &&
		isExpanded &&
		activeTab === "home"
	);
}

// 在Mirror上试一个摄像头，首帧超时就释放它，交给下一个候选。
async function openMirrorCamera(deviceId, session) {
	let stream;
	try {
		stream = await navigator.mediaDevices.getUserMedia({
			audio: false,
			video: {
				...(deviceId
					? { deviceId: { exact: deviceId } }
					: { facingMode: "user" }),
				width: { ideal: 1280 },
				height: { ideal: 1280 },
			},
		});
	} catch (error) {
		if (error?.name === "NotAllowedError") throw error;
		return false;
	}
	if (!isMirrorSessionActive(session)) {
		stream.getTracks().forEach((track) => track.stop());
		return false;
	}
	mirrorStream = stream;
	mirrorVideo.srcObject = stream;
	let timer;
	const playing = await Promise.race([
		mirrorVideo.play().then(() => true),
		new Promise((resolve) => {
			timer = setTimeout(resolve, MIRROR_FIRST_FRAME_TIMEOUT_MS, false);
		}),
	]).finally(() => clearTimeout(timer));
	if (playing) return true;
	stream.getTracks().forEach((track) => track.stop());
	if (mirrorStream === stream) {
		mirrorStream = null;
		mirrorVideo.srcObject = null;
	}
	return false;
}

async function startMirror() {
	if (mirrorStarting || mirrorStream || !mirrorVideo) return;
	const session = ++mirrorSession;
	let activated = false;
	mirrorStarting = true;
	homeMirror?.classList.add("camera-starting");
	mirrorStage?.setAttribute("aria-busy", "true");
	try {
		const permitted =
			!window.notchAPI || typeof window.notchAPI.ensureCamera !== "function"
				? true
				: await window.notchAPI.ensureCamera();
		if (!permitted) throw new Error("camera_permission_denied");
		if (!isMirrorSessionActive(session)) return;
		const devices = await navigator.mediaDevices
			.enumerateDevices()
			.catch(() => []);
		const candidates = window.NotchDomain.rankMirrorCameras(devices);
		let live = false;
		for (const deviceId of candidates.length ? candidates : [null]) {
			if (!isMirrorSessionActive(session)) return;
			live = await openMirrorCamera(deviceId, session);
			if (live) break;
		}
		if (!isMirrorSessionActive(session)) return;
		if (!live) throw new Error("camera_no_frames");
		setMirrorZoom(1);
		homeMirror?.classList.remove("liquid-active");
		homeMirror?.classList.add("live");
		mirrorStage?.setAttribute("aria-label", "Close live mirror");
		mirrorStage?.setAttribute("aria-pressed", "true");
		activated = true;
	} catch (error) {
		// 会话号变了说明用户已收起 / 切走 / 再点关闭，被打断的 play() 不算失败。
		if (session !== mirrorSession) return;
		stopMirror();
		const denied =
			error &&
			(error.name === "NotAllowedError" ||
				error.message === "camera_permission_denied");
		showStatusToast(
			denied
				? "Camera permission required for Mirror"
				: "Can’t open the camera right now",
		);
	} finally {
		if (session === mirrorSession) {
			mirrorStarting = false;
			homeMirror?.classList.remove("camera-starting");
			mirrorStage?.removeAttribute("aria-busy");
			// M途离开Home却没走 stopMirror 时，不能把已打开的摄像头留在后台。
			if (!activated && mirrorStream) stopMirror();
		}
	}
}

function animateMirrorLiquid() {
	// 慢衰减保留轨迹长尾，Canvas 同时绘制传播M的同心波。
	mirrorLiquidScale += (0 - mirrorLiquidScale) * 0.035;
	mirrorDisplacement?.setAttribute("scale", mirrorLiquidScale.toFixed(2));
	if (mirrorLiquidScale > 0.35) {
		mirrorLiquidFrame = requestAnimationFrame(animateMirrorLiquid);
	} else {
		mirrorLiquidFrame = null;
	}
}

if (mirrorStage) {
	mirrorStage.addEventListener("pointerenter", () => {
		if (!mirrorStream) homeMirror?.classList.add("liquid-active");
	});
	mirrorStage.addEventListener("pointermove", (event) => {
		if (mirrorStream) return;
		const bounds = mirrorStage.getBoundingClientRect();
		const x = Math.max(
			0,
			Math.min(1, (event.clientX - bounds.left) / bounds.width),
		);
		const y = Math.max(
			0,
			Math.min(1, (event.clientY - bounds.top) / bounds.height),
		);
		const speed = mirrorLastPoint
			? Math.hypot(
					event.clientX - mirrorLastPoint.x,
					event.clientY - mirrorLastPoint.y,
				)
			: 0;
		mirrorLastPoint = { x: event.clientX, y: event.clientY };
		mirrorStage.style.setProperty("--liquid-x", `${(x * 100).toFixed(2)}%`);
		mirrorStage.style.setProperty("--liquid-y", `${(y * 100).toFixed(2)}%`);
		mirrorStage.style.setProperty(
			"--liquid-shift-x",
			`${((0.5 - x) * 10).toFixed(2)}px`,
		);
		mirrorStage.style.setProperty(
			"--liquid-shift-y",
			`${((0.5 - y) * 10).toFixed(2)}px`,
		);
		mirrorLiquidScale = Math.min(
			38,
			Math.max(mirrorLiquidScale, 14 + speed * 0.85),
		);
		if (event.timeStamp - mirrorLastTrailAt > 42 && speed > 1.5) {
			mirrorLastTrailAt = event.timeStamp;
			addMirrorWaterRipple(
				event.clientX - bounds.left,
				event.clientY - bounds.top,
				speed,
			);
		}
		if (!mirrorLiquidFrame)
			mirrorLiquidFrame = requestAnimationFrame(animateMirrorLiquid);
	});
	mirrorStage.addEventListener("pointerleave", () => {
		mirrorLastPoint = null;
		homeMirror?.classList.remove("liquid-active");
	});
	mirrorStage.addEventListener(
		"wheel",
		(event) => {
			if (
				!window.NotchDomain.shouldHandleMirrorPinch({
					live: Boolean(mirrorStream),
					ctrlKey: event.ctrlKey,
				})
			)
				return;
			event.preventDefault();
			setMirrorZoom(
				window.NotchDomain.adjustMirrorZoom(mirrorZoom, event.deltaY),
			);
		},
		{ passive: false },
	);
	mirrorStage.addEventListener("click", async () => {
		if (mirrorStream || mirrorStarting) {
			stopMirror();
			return;
		}
		homeMirror?.classList.remove("ripple-active");
		void mirrorStage.offsetWidth;
		homeMirror?.classList.add("ripple-active");
		setTimeout(() => homeMirror?.classList.remove("ripple-active"), 720);
		await startMirror();
	});
}
