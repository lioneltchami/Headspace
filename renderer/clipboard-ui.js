// ============ Home · FavoritesClip ============
const clipfavListEl = document.getElementById("clipfav-list");

function renderClipFavs() {
	if (!clipfavListEl) return;
	// 脏标记：clipHistory / clipFavorites / clipImageCache 均未变则跳过重建
	if (clipDataVersion === lastRenderedFavsVersion) return;

	// 按 clipFavorites 顺序取条目（过滤掉已删的）
	const favEntries = clipFavorites
		.map((id) => clipHistory.find((e) => e.id === id))
		.filter(Boolean);

	if (!favEntries.length) {
		clipfavListEl.innerHTML =
			'<button class="clipfav-empty" type="button" data-action="goto-clip">' +
			"Star items in the Clipboard tab →" +
			"</button>";
		lastRenderedFavsVersion = clipDataVersion; // 空态也标记已渲染
		return;
	}

	// 渲染每条Favorites
	clipfavListEl.innerHTML = favEntries
		.map((entry) => {
			const safeId = escapeHtml(entry.id);

			if (entry.type === "image") {
				const dataUrl = entry.imagePath
					? clipImageCache.get(entry.imagePath)
					: null;
				const mediaHtml = dataUrl
					? `<img class="clipfav-thumb" src="${escapeHtml(dataUrl)}" alt="Image" draggable="false"/>`
					: `<div class="clipfav-thumb-placeholder">Img</div>`;
				return (
					`<div class="clipfav-item clip-type-image" data-id="${safeId}" role="button" tabindex="0" title="Image">` +
					mediaHtml +
					`<span class="clipfav-text">Image</span>` +
					`</div>`
				);
			}

			// text | url
			const isUrl =
				entry.type === "url" || (entry.text && CLIP_URL_RE.test(entry.text));
			const typeClass = isUrl ? "clip-type-url" : "clip-type-text";
			let preview = entry.text || "";
			if (isUrl) {
				try {
					preview = new URL(entry.text).hostname || entry.text;
				} catch (_) {
					preview = entry.text || "";
				}
			}
			const safePreview = escapeHtml(preview);
			const safeTitle = escapeHtml(entry.text || "");
			return (
				`<div class="clipfav-item ${typeClass}" data-id="${safeId}" role="button" tabindex="0" title="${safeTitle}">` +
				`<span class="clipfav-text">${safePreview}</span>` +
				`</div>`
			);
		})
		.join("");
	lastRenderedFavsVersion = clipDataVersion; // 标记本次渲染版本

	// 按需预加载Image缩略Img（命M后二次渲染刷新）
	// preloadClipImage 会自增 clipDataVersion，确保二次渲染不被脏标记挡掉
	const missingImageEntries = favEntries.filter(
		(e) =>
			e.type === "image" && e.imagePath && !clipImageCache.has(e.imagePath),
	);
	if (missingImageEntries.length > 0) {
		Promise.all(
			missingImageEntries.map((e) => preloadClipImage(e.imagePath)),
		).then(() => {
			const anyLoaded = missingImageEntries.some((e) =>
				clipImageCache.has(e.imagePath),
			);
			if (anyLoaded) renderClipFavs();
		});
	}
}

if (clipfavListEl) {
	clipfavListEl.addEventListener("click", async (e) => {
		e.stopPropagation();
		// 空态：跳转 clip Tab
		if (e.target.closest('[data-action="goto-clip"]')) {
			setActiveTab("clip");
			return;
		}
		// 条目点击：复制
		const item = e.target.closest(".clipfav-item[data-id]");
		if (item) {
			const id = item.dataset.id;
			if (await copyClipEntry(id)) {
				item.classList.add("copied");
				setTimeout(() => item.classList.remove("copied"), 800);
			}
		}
	});
	clipfavListEl.addEventListener("keydown", async (e) => {
		if (e.key !== "Enter" && e.key !== " ") return;
		if (e.repeat) return;
		const item = e.target.closest(".clipfav-item[data-id]");
		if (!item) return;
		e.preventDefault();
		if (await copyClipEntry(item.dataset.id)) {
			item.classList.add("copied");
			setTimeout(() => item.classList.remove("copied"), 800);
		}
	});
}

// ============ Clipboard history ============
const CLIP_HISTORY_KEY = "notch-clip-history";
const CLIP_FAV_KEY = "notch-clip-favorites";
const CLIP_MAX = 100;
const CLIP_URL_RE = /^https?:\/\//i;
const starOutlineSvg =
	'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z"/></svg>';
const starFilledSvg =
	'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z"/></svg>';

function loadClipHistory() {
	try {
		const raw = localStorage.getItem(CLIP_HISTORY_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed.map(normalizeClipEntry).filter(Boolean);
	} catch (e) {
		return [];
	}
}

function normalizeClipEntry(entry) {
	if (!entry || typeof entry !== "object") return null;
	const type = ["text", "url", "image"].includes(entry.type)
		? entry.type
		: "text";
	const text = typeof entry.text === "string" ? entry.text : null;
	const imagePath =
		typeof entry.imagePath === "string" ? entry.imagePath : null;
	if (type === "image" ? !imagePath : text === null) return null;
	return {
		id: typeof entry.id === "string" && entry.id ? entry.id : generateId(),
		type,
		text,
		imagePath,
		timestamp: Number.isFinite(entry.timestamp) ? entry.timestamp : Date.now(),
	};
}

function saveClipHistory(list) {
	try {
		localStorage.setItem(CLIP_HISTORY_KEY, JSON.stringify(list));
	} catch (e) {
		// ignore quota errors
	}
}

function loadClipFavorites() {
	try {
		const raw = localStorage.getItem(CLIP_FAV_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter((p) => typeof p === "string");
	} catch (e) {
		return [];
	}
}

function saveClipFavorites(list) {
	try {
		localStorage.setItem(CLIP_FAV_KEY, JSON.stringify(list));
	} catch (e) {
		// ignore quota errors
	}
}

let clipHistory = loadClipHistory();
let clipFavorites = loadClipFavorites();
let clipFilter = "all"; // all | text | image | faved
const clipImageCache = new Map(); // imagePath -> dataUrl，仅内存

// 脏标记 —— 单调递增版本号：凡影响 renderClipList / renderClipFavs 输出的变更都自增。
// 宁可多自增（多一次重建）也不能漏（界面不更新）。
// 注意：preloadClipImage 在Image入缓存后也要自增，确保二次渲染不被脏标记挡掉。
let clipDataVersion = 0;
let lastRenderedClipVersion = -1; // renderClipList 上次渲染时的版本号
let lastRenderedFavsVersion = -1; // renderClipFavs 上次渲染时的版本号

const clipListEl = document.getElementById("clip-list");
const clipToolbarEl = document.getElementById("clip-toolbar");
const clipClearBtn = document.getElementById("clip-clear-btn");
let clipClearArmed = false;

// 防重入标志：renderClipList 内按需Image预加载Done后的二次渲染
let clipRenderPending = false;

async function preloadClipImage(imagePath) {
	if (!imagePath) return;
	if (clipImageCache.has(imagePath)) return;
	if (!window.notchAPI || typeof window.notchAPI.readClipImage !== "function")
		return;
	try {
		const dataUrl = await window.notchAPI.readClipImage(imagePath);
		if (dataUrl) {
			clipImageCache.set(imagePath, dataUrl);
			clipDataVersion++; // Image入缓存 → 版本自增，确保二次渲染不被脏标记挡掉（缩略Img必须显示）
		}
	} catch (e) {
		// ignore read errors
	}
}

async function addClipEntry(raw) {
	const id = generateId();
	const entry = {
		id,
		type: raw.type || "text",
		text: raw.text || null,
		imagePath: raw.imagePath || null,
		timestamp: Date.now(),
	};

	// 每一次系统复制都是独立历史事件；相同内容也必须保留为两条记录。
	const updated = window.NotchDomain.prependClipboardHistory(
		clipHistory,
		entry,
		CLIP_MAX,
	);
	clipHistory = updated.history;
	const evicted = updated.evicted;
	if (evicted.length > 0) {
		const evictedPaths = evicted
			.filter((e) => e.type === "image" && e.imagePath)
			.map((e) => e.imagePath);
		if (evictedPaths.length > 0) {
			if (
				window.notchAPI &&
				typeof window.notchAPI.deleteClipImages === "function"
			) {
				window.notchAPI.deleteClipImages(evictedPaths).catch(() => {});
			}
			evictedPaths.forEach((p) => clipImageCache.delete(p));
		}
	}

	saveClipHistory(clipHistory);

	// Image条目预加载缩略Img
	if (entry.type === "image" && entry.imagePath) {
		await preloadClipImage(entry.imagePath);
	}

	clipDataVersion++; // clipHistory 已变（含 FIFO 淘汰）
	renderClipList();
	renderClipFavs();
}

function formatClipTime(ts) {
	const now = Date.now();
	const diff = now - ts;
	if (diff < 60 * 1000) return "Just now";
	if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)}m ago`;
	if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)}h ago`;
	const d = new Date(ts);
	return `${d.getMonth() + 1}/${d.getDate()}`;
}

function clipEntryHtml(entry, faved) {
	const favClass = faved ? " faved" : "";
	const star = faved ? starFilledSvg : starOutlineSvg;
	const favLabel = faved ? "Unfavorite" : "Favorites";
	const timeStr = escapeHtml(formatClipTime(entry.timestamp));
	const safeId = escapeHtml(entry.id);

	if (entry.type === "image") {
		const dataUrl = entry.imagePath
			? clipImageCache.get(entry.imagePath)
			: null;
		const thumbHtml = dataUrl
			? `<img class="clip-thumb" src="${escapeHtml(dataUrl)}" alt="Image" draggable="false"/>`
			: `<span class="clip-thumb-placeholder">Loading image…</span>`;
		return `<div class="clip-item clip-item-image clip-type-image" data-id="${safeId}">
  <button class="clip-copy-target" type="button" data-action="copy" aria-label="Copy image">
    <span class="clip-thumb-wrap">${thumbHtml}</span>
    <span class="clip-meta"><span class="clip-time">${timeStr}</span></span>
  </button>
  <button class="clip-fav-btn${favClass}" type="button" data-action="fav" aria-label="${favLabel}">${star}</button>
  <button class="clip-del-btn" type="button" data-action="delete" aria-label="Delete">×</button>
</div>`;
	}

	// text | url 条目
	const safeText = escapeHtml(entry.text || "");
	const isUrl =
		entry.type === "url" || (entry.text && CLIP_URL_RE.test(entry.text));
	const typeClass = isUrl ? "clip-type-url" : "clip-type-text";
	const accessiblePreview = escapeHtml(
		(entry.text || "").replace(/\s+/g, " ").trim().slice(0, 80) || "Empty",
	);
	return `<div class="clip-item clip-item-text ${typeClass}" data-id="${safeId}">
  <button class="clip-copy-target" type="button" data-action="copy" aria-label="Copy: ${accessiblePreview}">
    <span class="clip-text">${safeText}</span>
    <span class="clip-meta"><span class="clip-time">${timeStr}</span></span>
  </button>
  <button class="clip-fav-btn${favClass}" type="button" data-action="fav" aria-label="${favLabel}">${star}</button>
  <button class="clip-del-btn" type="button" data-action="delete" aria-label="Delete">×</button>
</div>`;
}

function getFilteredClipItems() {
	if (clipFilter === "all") return clipHistory;
	if (clipFilter === "text")
		return clipHistory.filter((e) => e.type === "text" || e.type === "url");
	if (clipFilter === "image")
		return clipHistory.filter((e) => e.type === "image");
	if (clipFilter === "faved") {
		const favSet = new Set(clipFavorites);
		return clipHistory.filter((e) => favSet.has(e.id));
	}
	return clipHistory;
}

function renderClipList() {
	if (!clipListEl) return;
	// 脏标记：数据/过滤器/Image缓存均未变则跳过全量重建
	if (clipDataVersion === lastRenderedClipVersion) return;

	const items = getFilteredClipItems();
	const favSet = new Set(clipFavorites);

	if (items.length === 0) {
		clipListEl.innerHTML =
			'<div class="clip-empty">' +
			(clipHistory.length
				? "No matching items"
				: "Copy something — history shows up here") +
			"</div>";
		lastRenderedClipVersion = clipDataVersion; // 空态也标记已渲染
		return;
	}

	clipListEl.innerHTML = items
		.map((e) => clipEntryHtml(e, favSet.has(e.id)))
		.join("");
	lastRenderedClipVersion = clipDataVersion; // 标记本次渲染版本（在预加载之前）

	// 按需预加载Image：收集当前 items 里 cache 未命M的 image 条目
	// preloadClipImage 成功后自增 clipDataVersion，确保二次渲染不被脏标记挡掉
	if (clipRenderPending) return; // 防重入：已有预加载Task在途
	const missingPaths = items
		.filter(
			(e) =>
				e.type === "image" && e.imagePath && !clipImageCache.has(e.imagePath),
		)
		.map((e) => e.imagePath);

	if (missingPaths.length === 0) return;

	clipRenderPending = true;
	Promise.all(missingPaths.map((p) => preloadClipImage(p)))
		.then(() => {
			clipRenderPending = false;
			// 只有至少有一条路径成功填入 cache 才重渲，避免无意义刷新
			const anyLoaded = missingPaths.some((p) => clipImageCache.has(p));
			if (anyLoaded) renderClipList();
		})
		.catch(() => {
			clipRenderPending = false;
		});
}

// ---- 工具栏事件委托 ----
if (clipToolbarEl) {
	clipToolbarEl.addEventListener("click", (e) => {
		e.stopPropagation();
		const filterBtn = e.target.closest(".clip-filter");
		if (filterBtn) {
			clipFilter = filterBtn.dataset.filter || "all";
			clipToolbarEl.querySelectorAll(".clip-filter").forEach((b) => {
				const selected = b === filterBtn;
				b.classList.toggle("active", selected);
				b.setAttribute("aria-pressed", String(selected));
			});
			clipDataVersion++; // clipFilter 已变 → 输出变化
			renderClipList();
			return;
		}
		if (e.target.closest("#clip-clear-btn")) {
			requestClearClipHistory();
		}
	});
	clipToolbarEl.querySelectorAll(".clip-filter").forEach((button) => {
		button.setAttribute(
			"aria-pressed",
			String(button.classList.contains("active")),
		);
	});
}

// ---- 列表事件委托 ----
if (clipListEl) {
	clipListEl.addEventListener("click", (e) => {
		e.stopPropagation();
		const item = e.target.closest(".clip-item");
		if (!item) return;
		const id = item.dataset.id;
		if (!id) return;

		// 优先判断子按钮
		const favoriteButton = e.target.closest(".clip-fav-btn");
		if (favoriteButton) {
			toggleClipFavorite(id, {
				restoreFocus: document.activeElement === favoriteButton,
				nextId: item.nextElementSibling && item.nextElementSibling.dataset.id,
				previousId:
					item.previousElementSibling && item.previousElementSibling.dataset.id,
			});
			return;
		}
		const deleteButton = e.target.closest(".clip-del-btn");
		if (deleteButton) {
			deleteClipEntry(id, {
				restoreFocus: document.activeElement === deleteButton,
				nextId: item.nextElementSibling && item.nextElementSibling.dataset.id,
				previousId:
					item.previousElementSibling && item.previousElementSibling.dataset.id,
			});
			return;
		}
		if (e.target.closest('[data-action="copy"]')) copyClipEntry(id);
	});
}

function focusClipControl(ids, action = "copy") {
	if (!clipListEl) return;
	for (const id of ids.filter(Boolean)) {
		const target = clipListEl.querySelector(
			`.clip-item[data-id="${CSS.escape(id)}"] [data-action="${action}"]`,
		);
		if (target) {
			target.focus({ preventScroll: true });
			return;
		}
	}
	const activeFilter =
		clipToolbarEl && clipToolbarEl.querySelector(".clip-filter.active");
	if (activeFilter) activeFilter.focus({ preventScroll: true });
}

function toggleClipFavorite(id, focusContext = null) {
	const idx = clipFavorites.indexOf(id);
	if (idx === -1) {
		clipFavorites.push(id);
	} else {
		clipFavorites.splice(idx, 1);
	}
	clipDataVersion++; // clipFavorites 已变
	saveClipFavorites(clipFavorites);
	renderClipList();
	renderClipFavs();
	if (focusContext && focusContext.restoreFocus) {
		const sameItemButton =
			clipListEl &&
			clipListEl.querySelector(
				`.clip-item[data-id="${CSS.escape(id)}"] [data-action="fav"]`,
			);
		if (sameItemButton) {
			sameItemButton.focus({ preventScroll: true });
		} else {
			focusClipControl([focusContext.nextId, focusContext.previousId]);
		}
	}
}

function deleteClipEntry(id, focusContext = null) {
	const idx = clipHistory.findIndex((e) => e.id === id);
	if (idx === -1) return;
	const entry = clipHistory[idx];
	const favoriteIndex = clipFavorites.indexOf(id);
	clipHistory.splice(idx, 1);
	clipFavorites = clipFavorites.filter((fid) => fid !== id);
	clipDataVersion++; // clipHistory + clipFavorites 已变
	saveClipHistory(clipHistory);
	saveClipFavorites(clipFavorites);
	renderClipList();
	renderClipFavs();
	if (focusContext && focusContext.restoreFocus) {
		focusClipControl([focusContext.nextId, focusContext.previousId]);
	}
	showStatusToast("Clipboard item deleted", {
		actionLabel: "Undo",
		duration: 5000,
		onAction: () => {
			if (clipHistory.some((item) => item.id === id)) return;
			clipHistory.splice(Math.min(idx, clipHistory.length), 0, entry);
			if (favoriteIndex !== -1) {
				clipFavorites.splice(
					Math.min(favoriteIndex, clipFavorites.length),
					0,
					id,
				);
			}
			clipDataVersion++;
			saveClipHistory(clipHistory);
			saveClipFavorites(clipFavorites);
			renderClipList();
			renderClipFavs();
			focusClipControl([id]);
			showStatusToast("Delete undone");
		},
		onExpire: () => {
			if (entry.type !== "image" || !entry.imagePath) return;
			clipImageCache.delete(entry.imagePath);
			if (
				window.notchAPI &&
				typeof window.notchAPI.deleteClipImages === "function"
			) {
				window.notchAPI.deleteClipImages([entry.imagePath]).catch(() => {});
			}
		},
	});
}

function resetClipClearConfirmation() {
	clipClearArmed = false;
	if (clipClearBtn) {
		clipClearBtn.classList.remove("confirming");
		clipClearBtn.setAttribute("aria-label", "Clear history");
	}
}

function requestClearClipHistory() {
	if (clipHistory.length === 0) {
		showStatusToast("Clipboard history is already empty");
		return;
	}
	if (!clipClearArmed) {
		clipClearArmed = true;
		if (clipClearBtn) {
			clipClearBtn.classList.add("confirming");
			clipClearBtn.setAttribute(
				"aria-label",
				`Click again to clear ${clipHistory.length} items`,
			);
		}
		showStatusToast(`Click the trash again to clear ${clipHistory.length} items`, {
			duration: 3000,
			onExpire: resetClipClearConfirmation,
		});
		return;
	}
	resetClipClearConfirmation();
	clearClipHistory();
}

if (clipClearBtn) {
	clipClearBtn.addEventListener("keydown", (event) => {
		if (event.repeat && (event.key === "Enter" || event.key === " ")) {
			event.preventDefault();
		}
	});
}

function clearClipHistory() {
	const removedCount = clipHistory.length;
	const imagePaths = clipHistory
		.filter((e) => e.type === "image" && e.imagePath)
		.map((e) => e.imagePath);
	clipHistory = [];
	clipFavorites = [];
	clipImageCache.clear();
	clipDataVersion++; // All数据已清空
	saveClipHistory([]);
	saveClipFavorites([]);
	if (
		imagePaths.length > 0 &&
		window.notchAPI &&
		typeof window.notchAPI.deleteClipImages === "function"
	) {
		window.notchAPI.deleteClipImages(imagePaths).catch(() => {});
	}
	renderClipList();
	renderClipFavs();
	showStatusToast(`Cleared ${removedCount} clipboard items`);
}

async function copyClipEntry(id) {
	const entry = clipHistory.find((e) => e.id === id);
	if (!entry) return false;
	if (!window.notchAPI) return false;
	try {
		const result =
			typeof window.notchAPI.pasteClipboard === "function"
				? await window.notchAPI.pasteClipboard(entry)
				: { ok: await window.notchAPI.writeClipboard(entry), pasted: false };
		if (!result?.ok) {
			showStatusToast("Copy failed — try again");
			return false;
		}
		showStatusToast(
			result.pasted
				? "Pasted into the previous field"
				: result.permissionRequired
					? "Enable Accessibility; content is copied"
					: entry.type === "image"
						? "Image copied — paste anytime"
						: "Copied — paste anytime",
		);
	} catch (e) {
		showStatusToast("Copy failed — try again");
		return false;
	}
	// 视觉反馈：800ms 后移除 copied 类
	const itemEl =
		clipListEl &&
		clipListEl.querySelector(`.clip-item[data-id="${CSS.escape(id)}"]`);
	if (itemEl) {
		itemEl.classList.add("copied");
		setTimeout(() => itemEl.classList.remove("copied"), 800);
	}
	return true;
}

// ---- IPC 推送监听 ----
if (window.notchAPI && typeof window.notchAPI.onNewClipEntry === "function") {
	window.notchAPI.onNewClipEntry((raw) => {
		addClipEntry(raw);
	});
}
