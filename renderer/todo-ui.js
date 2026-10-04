function loadData() {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { P0: [], P1: [], P2: [], P3: [] };
		const parsed = JSON.parse(raw);
		return {
			P0: normalizeTodoItems(parsed && parsed.P0),
			P1: normalizeTodoItems(parsed && parsed.P1),
			P2: normalizeTodoItems(parsed && parsed.P2),
			P3: normalizeTodoItems(parsed && parsed.P3),
		};
	} catch (e) {
		return { P0: [], P1: [], P2: [], P3: [] };
	}
}

function normalizeTodoItems(value) {
	if (!Array.isArray(value)) return [];
	return value
		.map((item) => {
			if (typeof item === "string") {
				const text = item.trim();
				return text
					? { id: generateId(), text, done: false, createdAt: Date.now() }
					: null;
			}
			if (!item || typeof item !== "object" || typeof item.text !== "string")
				return null;
			const text = item.text.trim();
			if (!text) return null;
			return {
				id: typeof item.id === "string" && item.id ? item.id : generateId(),
				text,
				done: item.done === true,
				createdAt: Number.isFinite(item.createdAt)
					? item.createdAt
					: Date.now(),
				deadline: Number.isFinite(Date.parse(String(item.deadline || "")))
					? new Date(Date.parse(String(item.deadline))).toISOString()
					: "",
				remindedAt: Math.max(0, Number(item.remindedAt) || 0),
			};
		})
		.filter(Boolean);
}

function saveData(data) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
	} catch (e) {
		// ignore quota errors
	}
	if (
		window.notchAPI &&
		typeof window.notchAPI.scheduleTodoReminders === "function"
	) {
		const reminders = PRIORITIES.flatMap((priority) => data[priority] || []);
		window.notchAPI.scheduleTodoReminders(reminders).catch(() => {});
	}
}

const data = loadData();
let todoCategoryNames = loadTodoCategoryNames();
const todoSelections = Object.fromEntries(
	PRIORITIES.map((priority) => [priority, new Set()]),
);
const todoSelectionAnchors = Object.fromEntries(
	PRIORITIES.map((priority) => [priority, null]),
);
let editingTodo = null;

function loadTodoCategoryNames() {
	try {
		return window.NotchDomain.normalizeTodoCategoryNames(
			JSON.parse(localStorage.getItem(TODO_CATEGORY_KEY) || "null"),
			TODO_CATEGORY_DEFAULTS,
		);
	} catch (error) {
		return { ...TODO_CATEGORY_DEFAULTS };
	}
}

function persistTodoCategoryNames() {
	try {
		localStorage.setItem(TODO_CATEGORY_KEY, JSON.stringify(todoCategoryNames));
	} catch (error) {
		// LocalStorage 不可用时仍保留当前会话M的分类名。
	}
}

function applyTodoCategoryNames() {
	PRIORITIES.forEach((categoryId) => {
		const name = todoCategoryNames[categoryId];
		const input = document.querySelector(
			`.todo-category-name[data-category="${categoryId}"]`,
		);
		const addInput = document.querySelector(
			`.add-row input[data-priority="${categoryId}"]`,
		);
		if (input) input.value = name;
		if (addInput) addInput.setAttribute("aria-label", `Add ${name} task`);
	});
}
if (
	window.notchAPI &&
	typeof window.notchAPI.scheduleTodoReminders === "function"
) {
	window.notchAPI
		.scheduleTodoReminders(
			PRIORITIES.flatMap((priority) => data[priority] || []),
		)
		.catch(() => {});
}

if (window.notchAPI && typeof window.notchAPI.onTodoReminder === "function") {
	window.notchAPI.onTodoReminder((payload) => {
		if (!payload || !payload.id) return;
		let changed = false;
		PRIORITIES.forEach((priority) => {
			const item = (data[priority] || []).find(
				(todo) =>
					todo.id === payload.id &&
					String(todo.deadline || "") === String(payload.deadline || ""),
			);
			if (!item) return;
			item.remindedAt = Math.max(0, Number(payload.remindedAt) || Date.now());
			changed = true;
		});
		if (changed) saveData(data);
	});
}

function todoItemHtml(priority, item) {
	const doneClass = item.done ? " done" : "";
	const selectedClass = todoSelections[priority]?.has(item.id)
		? " multi-selected"
		: "";
	const safeId = escapeHtml(item.id);
	const safeText = escapeHtml(item.text);
	const deadline = Number.isFinite(Date.parse(String(item.deadline || "")))
		? new Intl.DateTimeFormat("en-US", {
				month: "numeric",
				day: "numeric",
				hour: "2-digit",
				minute: "2-digit",
			}).format(new Date(item.deadline))
		: "";
	const toggleLabel = item.done
		? `Mark incomplete: ${safeText}`
		: `Mark done: ${safeText}`;
	const battery = window.NotchDomain.todoTimeBattery(item, Date.now());
	// 逾期项整条填满红色并只显示一个白色感叹号：剩余 0% 是「快到了」，
	// 逾期是「已经欠账」，两者不能长得一样。
	const batteryHtml = battery
		? `<span class="todo-battery" data-tone="${battery.tone}"${battery.overdue ? ' data-overdue="true" role="img"' : ""} title="${battery.label}" aria-label="${battery.label}"><i style="--battery:${battery.overdue ? 100 : battery.percent}%"></i><b>${battery.overdue ? "!" : `${battery.percent}%`}</b></span>`
		: "";
	const isEditing =
		editingTodo?.priority === priority && editingTodo?.id === item.id;
	const contentHtml = isEditing
		? `<div class="todo-inline-editor"><input class="todo-inline-name" value="${safeText}" maxlength="80" aria-label="Edit task name" />${batteryHtml}<button class="todo-inline-deadline" type="button" data-action="edit-deadline">${deadline || "Date"}</button><button class="todo-inline-save" type="button" data-action="save-edit" aria-label="Save changes">✓</button></div>`
		: `<button class="todo-copy" type="button" data-action="edit" title="${safeText}" aria-label="Edit: ${safeText}"><span class="todo-text">${safeText}</span>${batteryHtml}${deadline ? `<time class="todo-ddl" datetime="${escapeHtml(item.deadline)}">${escapeHtml(deadline)}</time>` : ""}</button>`;
	return `
    <li class="todo-item${doneClass}${selectedClass}" data-id="${safeId}" data-priority="${priority}">
      <button class="checkbox" type="button" data-action="toggle" aria-label="${toggleLabel}" aria-pressed="${item.done}">${checkSvg()}</button>
      ${contentHtml}
      <button class="delete" type="button" data-action="delete" aria-label="Delete: ${safeText}">×</button>
    </li>
  `;
}

function captureTodoPositions(priority) {
	const list = document.querySelector(
		`.todo-list[data-priority="${priority}"]`,
	);
	if (!list) return new Map();
	return new Map(
		Array.from(list.querySelectorAll(".todo-item[data-id]")).map((item) => [
			item.dataset.id,
			item.getBoundingClientRect(),
		]),
	);
}

function animateTodoOrder(priority, previousPositions) {
	if (
		!previousPositions?.size ||
		window.matchMedia("(prefers-reduced-motion: reduce)").matches
	)
		return;
	const list = document.querySelector(
		`.todo-list[data-priority="${priority}"]`,
	);
	if (!list) return;
	requestAnimationFrame(() => {
		list.querySelectorAll(".todo-item[data-id]").forEach((item) => {
			const previous = previousPositions.get(item.dataset.id);
			if (!previous || typeof item.animate !== "function") return;
			const current = item.getBoundingClientRect();
			const offset = previous.top - current.top;
			if (Math.abs(offset) < 1) return;
			item.animate(
				[
					{ transform: `translateY(${offset}px)` },
					{ transform: "translateY(0)" },
				],
				{
					duration: 360,
					easing: "cubic-bezier(.22, 1, .36, 1)",
				},
			);
		});
	});
}

function renderList(priority, options = {}) {
	const list = document.querySelector(
		`.todo-list[data-priority="${priority}"]`,
	);
	if (!list) return;
	const items = window.NotchDomain.sortTodosForDisplay(data[priority] || []);
	list.innerHTML = items.map((item) => todoItemHtml(priority, item)).join("");
	updateTodoBulkButton(priority);
	animateTodoOrder(priority, options.previousPositions);
	if (options.focusId) {
		requestAnimationFrame(() =>
			list
				.querySelector(
					`.todo-item[data-id="${CSS.escape(options.focusId)}"] [data-action="${options.focusAction || "toggle"}"]`,
				)
				?.focus({ preventScroll: true }),
		);
	}
}

function updateTodoBulkButton(priority) {
	const button = document.querySelector(`[data-bulk-priority="${priority}"]`);
	const count = todoSelections[priority]?.size || 0;
	if (!button) return;
	button.hidden = count === 0;
	button.textContent = "Delete";
	button.setAttribute(
		"aria-label",
		count ? `Delete ${count} items` : "Delete selected",
	);
}

function updateCount(priority) {
	const countEl = document.querySelector(`.count[data-priority="${priority}"]`);
	if (!countEl) return;
	const items = data[priority] || [];
	const pending = items.filter((t) => !t.done).length;
	countEl.textContent = String(pending);
}

function renderAll() {
	PRIORITIES.forEach((p) => {
		renderList(p);
		updateCount(p);
	});
}

setInterval(() => PRIORITIES.forEach(renderList), 60_000);

// 渲染重建 innerHTML 后，给指定条目挂一次性动画类；动画结束即卸载，不污染后续渲染
function flashItemClass(priority, id, cls) {
	const el = document.querySelector(
		`.todo-item[data-priority="${priority}"][data-id="${id}"]`,
	);
	if (!el) return;
	el.classList.add(cls);
	el.addEventListener("animationend", () => el.classList.remove(cls), {
		once: true,
	});
}

function flashCheckboxPop(priority, id) {
	const box = document.querySelector(
		`.todo-item[data-priority="${priority}"][data-id="${id}"] .checkbox`,
	);
	if (!box) return;
	box.classList.add("pop");
	box.addEventListener("animationend", () => box.classList.remove("pop"), {
		once: true,
	});
}

function addTodo(priority, text, deadline) {
	const item = window.NotchDomain.createTodo(
		text,
		deadline,
		generateId(),
		Date.now(),
	);
	if (!item) return false;
	const previousPositions = captureTodoPositions(priority);
	data[priority].push(item);
	saveData(data);
	renderList(priority, { previousPositions });
	updateCount(priority);
	flashItemClass(priority, item.id, "enter");
	const added = document.querySelector(
		`.todo-item[data-priority="${priority}"][data-id="${item.id}"]`,
	);
	if (added) {
		requestAnimationFrame(() => {
			const reduceMotion = window.matchMedia(
				"(prefers-reduced-motion: reduce)",
			).matches;
			added.scrollIntoView({
				block: "nearest",
				behavior: reduceMotion ? "auto" : "smooth",
			});
		});
	}
	return true;
}

function editTodo(priority, id, text, deadline) {
	const index = (data[priority] || []).findIndex((item) => item.id === id);
	if (index < 0) return false;
	const updated = window.NotchDomain.updateTodo(
		data[priority][index],
		text,
		deadline,
	);
	if (!updated) return false;
	const previousPositions = captureTodoPositions(priority);
	data[priority][index] = updated;
	saveData(data);
	renderList(priority, { previousPositions, focusId: id, focusAction: "edit" });
	return true;
}

function toggleTodo(priority, id) {
	const list = data[priority];
	const idx = list.findIndex((t) => t.id === id);
	if (idx === -1) return;
	const previousPositions = captureTodoPositions(priority);
	const restoreFocus =
		document.activeElement?.closest(".todo-item")?.dataset.id === id;
	list[idx].done = !list[idx].done;
	const nowDone = list[idx].done;
	saveData(data);
	renderList(priority, {
		previousPositions,
		focusId: restoreFocus ? id : "",
		focusAction: "toggle",
	});
	updateCount(priority);
	if (nowDone) requestAnimationFrame(() => flashCheckboxPop(priority, id)); // 勾选弹一下
}

function deleteTodo(priority, id) {
	const list = data[priority];
	const index = list.findIndex((t) => t.id === id);
	if (index === -1) return;
	const [removed] = list.splice(index, 1);
	const itemEl = document.querySelector(
		`.todo-item[data-priority="${priority}"][data-id="${CSS.escape(id)}"]`,
	);
	const shouldRestoreFocus = !!(
		itemEl && itemEl.contains(document.activeElement)
	);
	const nearbyItem =
		itemEl && (itemEl.nextElementSibling || itemEl.previousElementSibling);
	if (itemEl) itemEl.remove();
	saveData(data);
	updateCount(priority);
	if (shouldRestoreFocus) {
		const nextFocus =
			(nearbyItem && nearbyItem.querySelector('[data-action="toggle"]')) ||
			document.querySelector(`.add-row input[data-priority="${priority}"]`);
		if (nextFocus) nextFocus.focus({ preventScroll: true });
	}
	const summary =
		removed.text.length > 18 ? `${removed.text.slice(0, 18)}…` : removed.text;
	showStatusToast(`Deleted “${summary}”`, {
		actionLabel: "Undo",
		duration: 5000,
		onAction: () => {
			if (list.some((item) => item.id === removed.id)) return;
			list.splice(Math.min(index, list.length), 0, removed);
			saveData(data);
			renderList(priority);
			updateCount(priority);
			const restored = document.querySelector(
				`.todo-item[data-priority="${priority}"][data-id="${CSS.escape(id)}"] [data-action="toggle"]`,
			);
			if (restored) restored.focus({ preventScroll: true });
			showStatusToast("Delete undone");
		},
	});
}

document
	.querySelectorAll(".todo-category-name[data-category]")
	.forEach((input) => {
		const finishCategoryEdit = () => {
			const categoryId = input.dataset.category;
			todoCategoryNames = window.NotchDomain.normalizeTodoCategoryNames(
				{
					...todoCategoryNames,
					[categoryId]: input.value,
				},
				TODO_CATEGORY_DEFAULTS,
			);
			persistTodoCategoryNames();
			applyTodoCategoryNames();
		};
		input.addEventListener("change", finishCategoryEdit);
		input.addEventListener("keydown", (event) => {
			if (event.key === "Enter" && !event.isComposing) {
				event.preventDefault();
				input.blur();
			}
			if (event.key === "Escape") {
				input.value = todoCategoryNames[input.dataset.category];
				input.blur();
			}
		});
	});

applyTodoCategoryNames();

const todoEditorBackdrop = document.getElementById("todo-date-popover");
const todoEditorMonth = document.getElementById("todo-editor-month");
const todoCalendarPrevious = document.getElementById("todo-calendar-previous");
const todoCalendarNext = document.getElementById("todo-calendar-next");
const todoCalendarGrid = document.getElementById("todo-calendar-grid");
const todoEditorHour = document.getElementById("todo-editor-hour");
const todoEditorMinute = document.getElementById("todo-editor-minute");
const todoEditorError = document.getElementById("todo-editor-error");
let todoEditorContext = null;
let todoEditorYear = new Date().getFullYear();
let todoEditorMonthIndex = new Date().getMonth();
let todoEditorDay = new Date().getDate();

function fillTodoTimeOptions() {
	if (todoEditorHour && !todoEditorHour.options.length) {
		for (let hour = 0; hour < 24; hour += 1)
			todoEditorHour.add(
				new Option(String(hour).padStart(2, "0"), String(hour)),
			);
	}
	if (todoEditorMinute && !todoEditorMinute.options.length) {
		for (let minute = 0; minute < 60; minute += 5)
			todoEditorMinute.add(
				new Option(String(minute).padStart(2, "0"), String(minute)),
			);
	}
}

function renderTodoCalendar() {
	if (!todoCalendarGrid) return;
	const now = new Date();
	const days = new Date(todoEditorYear, todoEditorMonthIndex + 1, 0).getDate();
	const firstWeekday =
		(new Date(todoEditorYear, todoEditorMonthIndex, 1).getDay() + 6) % 7;
	if (todoEditorMonth)
		todoEditorMonth.textContent = `${todoEditorYear}-${String(todoEditorMonthIndex + 1).padStart(2, "0")}`;
	todoCalendarGrid.replaceChildren();
	for (let index = 0; index < firstWeekday; index += 1)
		todoCalendarGrid.append(document.createElement("span"));
	for (let day = 1; day <= days; day += 1) {
		const button = document.createElement("button");
		button.type = "button";
		button.textContent = String(day);
		button.dataset.day = String(day);
		button.className = day === todoEditorDay ? "selected" : "";
		if (
			todoEditorYear === now.getFullYear() &&
			todoEditorMonthIndex === now.getMonth() &&
			day === now.getDate()
		) {
			button.classList.add("today");
		}
		todoCalendarGrid.append(button);
	}
}

function closeTodoEditor() {
	if (todoEditorBackdrop) todoEditorBackdrop.hidden = true;
	if (todoEditorContext?.mode === "edit") {
		const { priority } = todoEditorContext;
		renderList(priority);
	}
	todoEditorContext = null;
}

function selectedTodoDeadline() {
	return window.NotchDomain.calendarDeadline({
		year: todoEditorYear,
		month: todoEditorMonthIndex,
		day: todoEditorDay,
		hour: todoEditorHour?.value,
		minute: todoEditorMinute?.value,
	});
}

function applyTodoEditorSelection(markManual = true) {
	if (!todoEditorContext) return false;
	const deadline = selectedTodoDeadline();
	if (!deadline || Date.parse(deadline) <= Date.now()) {
		if (todoEditorError)
			todoEditorError.textContent = "Pick a deadline later than now";
		return false;
	}
	if (todoEditorError) todoEditorError.textContent = "";
	const { priority, id, mode } = todoEditorContext;
	if (mode === "edit") {
		const todo = (data[priority] || []).find((item) => item.id === id);
		if (!todo) return false;
		todo.deadline = deadline;
		saveData(data);
	} else {
		const trigger = document.querySelector(
			`.todo-deadline-trigger[data-deadline-priority="${priority}"]`,
		);
		if (!trigger) return false;
		trigger.dataset.deadline = deadline;
		trigger.dataset.deadlineSource = markManual
			? "manual"
			: trigger.dataset.deadlineSource || "default";
		trigger.querySelector("span").textContent = new Intl.DateTimeFormat(
			"en-US",
			{
				day: "numeric",
				hour: "2-digit",
				minute: "2-digit",
				hour12: false,
			},
		).format(new Date(deadline));
		trigger.classList.add("selected");
		trigger.classList.remove("invalid");
	}
	return true;
}

function openTodoEditor(priority, item = null, anchor = null) {
	const now = new Date();
	const addInput = document.querySelector(
		`.add-row input[data-priority="${priority}"]`,
	);
	const trigger = document.querySelector(
		`.todo-deadline-trigger[data-deadline-priority="${priority}"]`,
	);
	if (!item) applyDefaultTodoDeadline(trigger, now);
	const candidate =
		item && item.deadline
			? new Date(item.deadline)
			: trigger?.dataset.deadline
				? new Date(trigger.dataset.deadline)
				: null;
	const selectedDate =
		candidate && Number.isFinite(candidate.getTime())
			? candidate
			: new Date(
					now.getFullYear(),
					now.getMonth(),
					now.getDate(),
					23,
					30,
					0,
					0,
				);
	todoEditorContext = {
		priority,
		id: (item && item.id) || "",
		mode: item ? "edit" : "add",
	};
	todoEditorYear = selectedDate.getFullYear();
	todoEditorMonthIndex = selectedDate.getMonth();
	todoEditorDay = selectedDate.getDate();
	fillTodoTimeOptions();
	if (todoEditorHour) todoEditorHour.value = String(selectedDate.getHours());
	if (todoEditorMinute)
		todoEditorMinute.value = String(
			Math.floor(selectedDate.getMinutes() / 5) * 5,
		);
	if (todoEditorError) todoEditorError.textContent = "";
	renderTodoCalendar();
	if (todoEditorBackdrop) {
		const target =
			anchor ||
			(item
				? document.querySelector(
						`.todo-item[data-id="${CSS.escape(item.id)}"] .todo-inline-deadline`,
					)
				: trigger);
		const quadrant =
			target?.closest(".quadrant") ||
			document.querySelector(`.quadrant[data-priority="${priority}"]`);
		quadrant?.appendChild(todoEditorBackdrop);
		todoEditorBackdrop.hidden = false;
		todoEditorBackdrop.style.removeProperty("left");
		todoEditorBackdrop.style.removeProperty("top");
		todoEditorBackdrop.style.right = "12px";
		todoEditorBackdrop.style.bottom = "58px";
	}
	applyTodoEditorSelection(false);
}

todoCalendarGrid?.addEventListener("click", (event) => {
	const button = event.target.closest("[data-day]");
	if (!button) return;
	todoEditorDay = Number(button.dataset.day);
	renderTodoCalendar();
	applyTodoEditorSelection(true);
});
function moveTodoCalendar(offset) {
	const shifted = window.NotchDomain.shiftCalendarMonth(
		{
			year: todoEditorYear,
			month: todoEditorMonthIndex,
		},
		offset,
	);
	if (!shifted) return;
	todoEditorYear = shifted.year;
	todoEditorMonthIndex = shifted.month;
	todoEditorDay = Math.min(
		todoEditorDay,
		new Date(todoEditorYear, todoEditorMonthIndex + 1, 0).getDate(),
	);
	if (todoEditorError) todoEditorError.textContent = "";
	renderTodoCalendar();
}

todoCalendarPrevious?.addEventListener("click", () => moveTodoCalendar(-1));
todoCalendarNext?.addEventListener("click", () => moveTodoCalendar(1));
todoEditorHour?.addEventListener("change", () =>
	applyTodoEditorSelection(true),
);
todoEditorMinute?.addEventListener("change", () =>
	applyTodoEditorSelection(true),
);

document.addEventListener(
	"pointerdown",
	(event) => {
		if (todoEditorBackdrop?.hidden) return;
		if (
			todoEditorBackdrop.contains(event.target) ||
			event.target.closest(".todo-deadline-trigger, .todo-inline-deadline")
		)
			return;
		closeTodoEditor();
	},
	true,
);

function applyDefaultTodoDeadline(trigger, now = new Date()) {
	if (
		!trigger ||
		(trigger.dataset.deadline && trigger.dataset.deadlineSource !== "default")
	)
		return;
	const deadline = window.NotchDomain.defaultTodoDeadline(now);
	if (!deadline) return;
	if (
		trigger.dataset.deadline === deadline &&
		trigger.dataset.deadlineSource === "default"
	)
		return;
	trigger.dataset.deadline = deadline;
	trigger.dataset.deadlineSource = "default";
	trigger.querySelector("span").textContent = new Intl.DateTimeFormat("en-US", {
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	}).format(new Date(deadline));
	trigger.classList.add("selected");
}

function resetTodoDraftDeadline(trigger, now = new Date()) {
	if (!trigger) return;
	delete trigger.dataset.deadline;
	delete trigger.dataset.deadlineSource;
	applyDefaultTodoDeadline(trigger, now);
}

function refreshDefaultTodoDeadlines(now = new Date()) {
	document
		.querySelectorAll(".todo-deadline-trigger[data-deadline-priority]")
		.forEach((trigger) => {
			if (trigger.dataset.deadlineSource === "manual") return;
			applyDefaultTodoDeadline(trigger, now);
		});
}

PRIORITIES.forEach((priority) => {
	const input = document.querySelector(
		`.add-row input[data-priority="${priority}"]`,
	);
	const deadlineInput = document.querySelector(
		`.todo-deadline-trigger[data-deadline-priority="${priority}"]`,
	);
	if (!input) return;
	applyDefaultTodoDeadline(deadlineInput);

	const submitTodo = () => {
		const value = input.value;
		if (!value.trim()) return;
		// Sleep or midnight may have passed since the form was rendered.
		applyDefaultTodoDeadline(deadlineInput);
		if (!deadlineInput || !deadlineInput.dataset.deadline) {
			deadlineInput?.classList.add("invalid");
			openTodoEditor(priority);
			return;
		}
		if (!addTodo(priority, value, deadlineInput.dataset.deadline)) {
			deadlineInput.classList.add("invalid");
			showStatusToast("Invalid deadline format");
			return;
		}
		input.value = "";
		if (
			todoEditorContext?.mode === "add" &&
			todoEditorContext.priority === priority
		)
			closeTodoEditor();
		resetTodoDraftDeadline(deadlineInput);
		deadlineInput.classList.remove("invalid");
		input.focus({ preventScroll: true });
	};

	input.addEventListener("keydown", (e) => {
		if (e.key !== "Enter" || e.isComposing || e.keyCode === 229) return;
		e.preventDefault();
		if (e.repeat) return;
		submitTodo();
	});
	input.addEventListener("focus", () =>
		applyDefaultTodoDeadline(deadlineInput),
	);
	deadlineInput?.addEventListener("click", () => openTodoEditor(priority));
});

PRIORITIES.forEach((priority) => {
	const list = document.querySelector(
		`.todo-list[data-priority="${priority}"]`,
	);
	if (!list) return;
	list.addEventListener("click", (e) => {
		const item = e.target.closest(".todo-item");
		if (!item) return;
		const id = item.dataset.id;
		if (e.shiftKey) {
			e.preventDefault();
			const result = window.NotchDomain.updateRangeSelection(
				window.NotchDomain.sortTodosForDisplay(data[priority] || []).map(
					(todo) => todo.id,
				),
				[...todoSelections[priority]],
				id,
				todoSelectionAnchors[priority],
				true,
			);
			todoSelections[priority] = new Set(result.selected);
			todoSelectionAnchors[priority] = result.anchor;
			renderList(priority);
			return;
		}
		const target = e.target.closest("[data-action]");
		if (!target) return;
		const action = target.dataset.action;
		if (action === "toggle") {
			toggleTodo(priority, id);
		} else if (action === "edit") {
			const todo = (data[priority] || []).find((item) => item.id === id);
			if (todo) {
				editingTodo = { priority, id };
				renderList(priority);
				requestAnimationFrame(() =>
					document
						.querySelector(
							`.todo-item[data-id="${CSS.escape(id)}"] .todo-inline-name`,
						)
						?.focus({ preventScroll: true }),
				);
			}
		} else if (action === "edit-deadline") {
			const todo = (data[priority] || []).find(
				(candidate) => candidate.id === id,
			);
			if (todo) openTodoEditor(priority, todo, target);
		} else if (action === "save-edit") {
			const todo = (data[priority] || []).find(
				(candidate) => candidate.id === id,
			);
			const name = item.querySelector(".todo-inline-name")?.value.trim() || "";
			if (!todo || !name || !todo.deadline) return;
			editingTodo = null;
			editTodo(priority, id, name, todo.deadline);
		} else if (action === "delete") {
			deleteTodo(priority, id);
		}
	});
	list.addEventListener("keydown", (event) => {
		const item = event.target.closest(".todo-item");
		if (!item || !event.target.matches(".todo-inline-name")) return;
		if (event.key === "Escape") {
			editingTodo = null;
			renderList(priority);
		} else if (event.key === "Enter" && !event.isComposing) {
			event.preventDefault();
			item.querySelector('[data-action="save-edit"]')?.click();
		}
	});
});

document
	.querySelectorAll(".todo-bulk-delete[data-bulk-priority]")
	.forEach((button) => {
		button.addEventListener("click", () => {
			const priority = button.dataset.bulkPriority;
			const selected = todoSelections[priority];
			if (!selected || !selected.size) return;
			data[priority] = (data[priority] || []).filter(
				(item) => !selected.has(item.id),
			);
			selected.clear();
			todoSelectionAnchors[priority] = null;
			saveData(data);
			renderList(priority);
			updateCount(priority);
			showStatusToast("Selected tasks deleted");
		});
	});

// ============ Tasks · 常驻跨天刷新 ============
// Draft dates must not depend on a home clock widget being present or visible.
let todoDefaultRefreshKey = "";

function tickTodoDefaultDeadlines() {
	const now = new Date();
	const refreshKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getTimezoneOffset()}`;
	if (refreshKey !== todoDefaultRefreshKey) {
		todoDefaultRefreshKey = refreshKey;
		refreshDefaultTodoDeadlines(now);
	}
}

tickTodoDefaultDeadlines();
setInterval(tickTodoDefaultDeadlines, 1000);
window.addEventListener("focus", () => refreshDefaultTodoDeadlines());
document.addEventListener("visibilitychange", () => {
	if (!document.hidden) refreshDefaultTodoDeadlines();
});
document.addEventListener("notch:modechange", (event) => {
	if (event.detail?.expanded) refreshDefaultTodoDeadlines();
});
document.addEventListener("notch:tabchange", (event) => {
	if (event.detail?.tab === "todo") refreshDefaultTodoDeadlines();
});

// ============ Tasks · 外部导入收件箱 ============
// 主进程读取 todo-inbox/*.json 后投递到这里；合并只追加，不改动已有Tasks。

// 导入可能在用户行内改名时到达：重绘列表前后保留输入M的草稿与光标。
function renderListKeepingDraft(priority, options) {
	const input =
		editingTodo?.priority === priority
			? document.querySelector(
					`.todo-item[data-id="${CSS.escape(editingTodo.id)}"] .todo-inline-name`,
				)
			: null;
	const draft = input && {
		value: input.value,
		focused: document.activeElement === input,
		start: input.selectionStart,
		end: input.selectionEnd,
	};
	renderList(priority, options);
	if (!draft) return;
	const next = document.querySelector(
		`.todo-item[data-id="${CSS.escape(editingTodo.id)}"] .todo-inline-name`,
	);
	if (!next) return;
	next.value = draft.value;
	if (draft.focused) {
		next.focus({ preventScroll: true });
		next.setSelectionRange(draft.start, draft.end);
	}
}

function applyTodoInboxImport(message) {
	const result = window.NotchDomain.mergeTodoImport(data, message.payload, {
		categories: PRIORITIES,
		categoryNames: todoCategoryNames,
		now: Date.now(),
		sourceId: message.sourceId,
	});
	const report = {
		error: result.error || "",
		imported: result.imported.map(({ index, category, todo }) => ({
			index,
			id: todo.id,
			category,
			categoryName: todoCategoryNames[category],
			text: todo.text,
			deadline: todo.deadline,
		})),
		skipped: result.skipped,
		warnings: result.warnings,
	};
	if (!result.imported.length) return report;
	const touched = [...new Set(result.imported.map(({ category }) => category))];
	const previousPositions = Object.fromEntries(
		touched.map((priority) => [priority, captureTodoPositions(priority)]),
	);
	// 追加进现有数组而不是整体替换：Delete「Undo」的闭包还持有这些数组Quote。
	result.imported.forEach(({ category, todo }) => data[category].push(todo));
	saveData(data);
	if (localStorage.getItem(STORAGE_KEY) !== JSON.stringify(data)) {
		// 本地存储写入失败（如配额已满）：回滚内存，让主进程稍后重试，源文件保留。
		const addedIds = new Set(result.imported.map(({ todo }) => todo.id));
		touched.forEach((priority) => {
			const list = data[priority];
			for (let index = list.length - 1; index >= 0; index -= 1) {
				if (addedIds.has(list[index].id)) list.splice(index, 1);
			}
		});
		saveData(data);
		return { retry: true };
	}
	touched.forEach((priority) => {
		renderListKeepingDraft(priority, {
			previousPositions: previousPositions[priority],
		});
		updateCount(priority);
	});
	result.imported.forEach(({ category, todo }) =>
		flashItemClass(category, todo.id, "enter"),
	);
	// 不顶掉正在等待「Undo」的提示。
	if (!statusToastActionHandler) {
		const skippedText = result.skipped.length
			? `, skipped ${result.skipped.length}`
			: "";
		showStatusToast(`Imported ${result.imported.length} tasks${skippedText}`);
	}
	return report;
}

function startTodoInbox() {
	if (!window.notchAPI?.onTodoInboxImport || !window.notchAPI?.todoInboxReady)
		return;
	window.notchAPI.onTodoInboxImport(async (message) => {
		if (!message || typeof message.token !== "string") return;
		let result;
		try {
			result = applyTodoInboxImport(message);
		} catch (error) {
			// 意外异常时不归档；稍后重试时稳定 id 会挡住已写入的条目。
			result = { retry: true };
		}
		if (result.imported?.length) {
			await window.notchAPI
				.saveWorkspaceData(collectLocalStorageSnapshot())
				.catch(() => {});
		}
		window.notchAPI.completeTodoInbox(message.token, result).catch(() => {});
	});
	window.notchAPI.todoInboxReady().catch(() => {});
}
