// ============ Home · Markdown 速记 ============
// textarea M的原始 Markdown 始终是唯一数据源；预览只用 DOM API + textContent 构建，
// 不执行用户输入的 HTML，也不自动加载远程Image。
const NOTE_KEY = "notch-home-note";
const NOTE_ARCHIVE_KEY = "notch-note-archive-v1";
const NOTE_ACTIVE_ARCHIVE_KEY = "notch-note-active-archive-v1";
const noteInput = document.getElementById("home-note");
const notePreview = document.getElementById("home-note-preview");
const noteSaveButton = document.getElementById("note-save-btn");
const notesList = document.getElementById("notes-list");
const notesSearch = document.getElementById("notes-search");
const notesDetail = document.getElementById("notes-detail");
const notesCount = document.getElementById("notes-count");
const noteFormatActions = document.getElementById("note-format-actions");
const noteModeButtons = Array.from(
	document.querySelectorAll("[data-note-mode]"),
);
const noteEditButton = document.getElementById("note-edit-btn");
const homeNote = document.querySelector(".home-note");

const NOTE_INLINE_PATTERNS = [
	{ type: "code", regex: /`([^`\n]+)`/g },
	{ type: "link", regex: /\[([^\]\n]+)\]\(([^)\s]+)\)/g },
	{ type: "strong", regex: /\*\*([^*\n]+)\*\*/g },
	{ type: "strong", regex: /__([^_\n]+)__/g },
	{ type: "delete", regex: /~~([^~\n]+)~~/g },
	{ type: "emphasis", regex: /\*([^*\n]+)\*/g },
	{ type: "emphasis", regex: /_([^_\n]+)_/g },
];

const NOTE_TASK_RE = /^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/;
const NOTE_BULLET_RE = /^\s*[-*+]\s+(.*)$/;
const NOTE_ORDERED_RE = /^\s*(\d+)[.)]\s+(.*)$/;
const NOTE_QUOTE_RE = /^\s*>\s?(.*)$/;
const NOTE_HEADING_RE = /^\s{0,3}(#{1,6})\s+(.+)$/;
const NOTE_FENCE_RE = /^\s*(`{3,}|~{3,})\s*([\w-]+)?\s*$/;
const NOTE_RULE_RE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;

function findNextInlineToken(text, fromIndex) {
	let next = null;
	NOTE_INLINE_PATTERNS.forEach((pattern, priority) => {
		pattern.regex.lastIndex = fromIndex;
		const match = pattern.regex.exec(text);
		if (
			match &&
			(!next ||
				match.index < next.match.index ||
				(match.index === next.match.index && priority < next.priority))
		) {
			next = { type: pattern.type, match, priority };
		}
	});
	return next;
}

function safeMarkdownUrl(rawUrl) {
	try {
		const url = new URL(rawUrl);
		return url.protocol === "http:" || url.protocol === "https:"
			? url.href
			: null;
	} catch (e) {
		return null;
	}
}

function appendInlineMarkdown(parent, source, depth = 0) {
	const text = String(source || "");
	if (!text || depth > 6) {
		if (text) parent.append(document.createTextNode(text));
		return;
	}

	let cursor = 0;
	while (cursor < text.length) {
		const token = findNextInlineToken(text, cursor);
		if (!token) {
			parent.append(document.createTextNode(text.slice(cursor)));
			break;
		}

		const { type, match } = token;
		if (match.index > cursor) {
			parent.append(document.createTextNode(text.slice(cursor, match.index)));
		}

		if (type === "code") {
			const code = document.createElement("code");
			code.textContent = match[1];
			parent.append(code);
		} else if (type === "link") {
			const href = safeMarkdownUrl(match[2]);
			if (!href) {
				parent.append(document.createTextNode(match[0]));
			} else {
				const link = document.createElement("a");
				link.dataset.noteHref = href;
				link.setAttribute("role", "link");
				link.tabIndex = 0;
				link.rel = "noreferrer";
				appendInlineMarkdown(link, match[1], depth + 1);
				parent.append(link);
			}
		} else {
			const tagName =
				type === "strong" ? "strong" : type === "delete" ? "del" : "em";
			const formatted = document.createElement(tagName);
			appendInlineMarkdown(formatted, match[1], depth + 1);
			parent.append(formatted);
		}

		cursor = match.index + match[0].length;
	}
}

function appendMarkdownLines(parent, lines) {
	lines.forEach((line, index) => {
		if (index > 0) parent.append(document.createElement("br"));
		appendInlineMarkdown(parent, line);
	});
}

function isMarkdownBlockStart(line) {
	if (!line.trim()) return true;
	return (
		NOTE_FENCE_RE.test(line) ||
		NOTE_HEADING_RE.test(line) ||
		NOTE_QUOTE_RE.test(line) ||
		NOTE_TASK_RE.test(line) ||
		NOTE_ORDERED_RE.test(line) ||
		NOTE_BULLET_RE.test(line) ||
		NOTE_RULE_RE.test(line)
	);
}

function buildMarkdownPreview(source) {
	const fragment = document.createDocumentFragment();
	const normalized = String(source || "").replace(/\r\n?/g, "\n");

	if (!normalized.trim()) {
		const empty = document.createElement("p");
		empty.className = "note-preview-empty";
		empty.textContent = "Write something to preview formatting here";
		fragment.append(empty);
		return fragment;
	}

	const lines = normalized.split("\n");
	let index = 0;

	while (index < lines.length) {
		const line = lines[index];
		if (!line.trim()) {
			index += 1;
			continue;
		}

		const fenceMatch = line.match(NOTE_FENCE_RE);
		if (fenceMatch) {
			const fenceChar = fenceMatch[1][0];
			const fenceLength = fenceMatch[1].length;
			const closeFence = new RegExp(
				"^\\s*" + fenceChar + "{" + fenceLength + ",}\\s*$",
			);
			const codeLines = [];
			index += 1;
			while (index < lines.length && !closeFence.test(lines[index])) {
				codeLines.push(lines[index]);
				index += 1;
			}
			if (index < lines.length) index += 1;
			const pre = document.createElement("pre");
			const code = document.createElement("code");
			if (fenceMatch[2]) code.dataset.language = fenceMatch[2];
			code.textContent = codeLines.join("\n");
			pre.append(code);
			fragment.append(pre);
			continue;
		}

		const headingMatch = line.match(NOTE_HEADING_RE);
		if (headingMatch) {
			const heading = document.createElement("h" + headingMatch[1].length);
			appendInlineMarkdown(heading, headingMatch[2]);
			fragment.append(heading);
			index += 1;
			continue;
		}

		if (NOTE_RULE_RE.test(line)) {
			fragment.append(document.createElement("hr"));
			index += 1;
			continue;
		}

		const quoteMatch = line.match(NOTE_QUOTE_RE);
		if (quoteMatch) {
			const quoteLines = [];
			while (index < lines.length) {
				const match = lines[index].match(NOTE_QUOTE_RE);
				if (!match) break;
				quoteLines.push(match[1]);
				index += 1;
			}
			const quote = document.createElement("blockquote");
			appendMarkdownLines(quote, quoteLines);
			fragment.append(quote);
			continue;
		}

		const taskMatch = line.match(NOTE_TASK_RE);
		if (taskMatch) {
			const list = document.createElement("ul");
			list.className = "note-task-list";
			while (index < lines.length) {
				const match = lines[index].match(NOTE_TASK_RE);
				if (!match) break;
				const done = match[1].toLowerCase() === "x";
				const item = document.createElement("li");
				item.className = "note-task-item" + (done ? " done" : "");
				item.setAttribute("role", "checkbox");
				item.setAttribute("aria-checked", String(done));
				const box = document.createElement("span");
				box.className = "note-task-box";
				box.setAttribute("aria-hidden", "true");
				box.textContent = done ? "✓" : "";
				const content = document.createElement("span");
				appendInlineMarkdown(content, match[2]);
				item.append(box, content);
				list.append(item);
				index += 1;
			}
			fragment.append(list);
			continue;
		}

		const orderedMatch = line.match(NOTE_ORDERED_RE);
		if (orderedMatch) {
			const list = document.createElement("ol");
			const start = Number.parseInt(orderedMatch[1], 10);
			if (Number.isFinite(start) && start !== 1) list.start = start;
			while (index < lines.length) {
				const match = lines[index].match(NOTE_ORDERED_RE);
				if (!match) break;
				const item = document.createElement("li");
				appendInlineMarkdown(item, match[2]);
				list.append(item);
				index += 1;
			}
			fragment.append(list);
			continue;
		}

		const bulletMatch = line.match(NOTE_BULLET_RE);
		if (bulletMatch) {
			const list = document.createElement("ul");
			while (index < lines.length) {
				if (NOTE_TASK_RE.test(lines[index])) break;
				const match = lines[index].match(NOTE_BULLET_RE);
				if (!match) break;
				const item = document.createElement("li");
				appendInlineMarkdown(item, match[1]);
				list.append(item);
				index += 1;
			}
			fragment.append(list);
			continue;
		}

		const paragraphLines = [line];
		index += 1;
		while (index < lines.length && !isMarkdownBlockStart(lines[index])) {
			paragraphLines.push(lines[index]);
			index += 1;
		}
		const paragraph = document.createElement("p");
		appendMarkdownLines(paragraph, paragraphLines);
		fragment.append(paragraph);
	}

	return fragment;
}

function renderNotePreview() {
	if (!noteInput || !notePreview) return;
	notePreview.replaceChildren(buildMarkdownPreview(noteInput.value));
}

function replaceNoteText(
	start,
	end,
	replacement,
	selectionStart,
	selectionEnd,
	selectionDirection = "none",
) {
	if (!noteInput) return;
	noteInput.setRangeText(replacement, start, end, "end");
	noteInput.focus({ preventScroll: true });
	noteInput.setSelectionRange(selectionStart, selectionEnd, selectionDirection);
	noteInput.dispatchEvent(new Event("input", { bubbles: true }));
}

function wrapNoteSelection(open, close, placeholder) {
	if (!noteInput) return;
	const start = noteInput.selectionStart;
	const end = noteInput.selectionEnd;
	const direction = noteInput.selectionDirection;
	const selected = noteInput.value.slice(start, end);

	const hasOuterMarkers =
		selected &&
		start >= open.length &&
		noteInput.value.slice(start - open.length, start) === open &&
		noteInput.value.slice(end, end + close.length) === close;
	if (hasOuterMarkers) {
		replaceNoteText(
			start - open.length,
			end + close.length,
			selected,
			start - open.length,
			end - open.length,
			direction,
		);
		return;
	}

	if (selected && selected.startsWith(open) && selected.endsWith(close)) {
		const unwrapped = selected.slice(
			open.length,
			selected.length - close.length,
		);
		replaceNoteText(
			start,
			end,
			unwrapped,
			start,
			start + unwrapped.length,
			direction,
		);
		return;
	}

	const content = selected || placeholder;
	const replacement = open + content + close;
	replaceNoteText(
		start,
		end,
		replacement,
		start + open.length,
		start + open.length + content.length,
		direction,
	);
}

function stripNoteBlockPrefix(line) {
	return line.replace(
		/^(?:#{1,6}\s+|>\s+|[-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+[.)]\s+)/,
		"",
	);
}

function applyNoteLineFormat(type) {
	if (!noteInput) return;
	const value = noteInput.value;
	const start = noteInput.selectionStart;
	const end = noteInput.selectionEnd;
	const direction = noteInput.selectionDirection;
	const lineStart = value.lastIndexOf("\n", start - 1) + 1;
	let lineEnd;
	if (end > start && value[end - 1] === "\n") {
		lineEnd = end - 1;
	} else {
		const nextBreak = value.indexOf("\n", end);
		lineEnd = nextBreak === -1 ? value.length : nextBreak;
	}

	const original = value.slice(lineStart, lineEnd);
	const lines = original.split("\n");
	const matchers = {
		heading: /^#{1,6}\s+/,
		bullet: /^[-*+]\s+(?!\[[ xX]\]\s+)/,
		ordered: /^\d+[.)]\s+/,
		task: /^[-*+]\s+\[[ xX]\]\s+/,
		quote: /^>\s+/,
	};
	const matcher = matchers[type];
	if (!matcher) return;
	const nonEmptyLines = lines.filter((line) => line.trim());
	const shouldRemove =
		nonEmptyLines.length > 0 &&
		nonEmptyLines.every((line) => matcher.test(line.trimStart()));
	let orderedIndex = 1;

	const transformed = lines
		.map((line) => {
			if (!line.trim() && lines.length > 1) return line;
			const indentation = line.match(/^\s*/)[0];
			const body = line.slice(indentation.length);
			if (shouldRemove) return indentation + body.replace(matcher, "");
			const content =
				stripNoteBlockPrefix(body) ||
				(type === "heading"
					? "Heading"
					: type === "task"
						? "Tasks"
						: type === "quote"
							? "Quote"
							: "Item");
			if (type === "ordered")
				return indentation + String(orderedIndex++) + ". " + content;
			if (type === "heading") return indentation + "# " + content;
			if (type === "task") return indentation + "- [ ] " + content;
			if (type === "quote") return indentation + "> " + content;
			return indentation + "- " + content;
		})
		.join("\n");

	const emptySingleLine =
		lines.length === 1 && !original.trim() && !shouldRemove;
	let nextStart = lineStart;
	const nextEnd = lineStart + transformed.length;
	if (emptySingleLine) {
		const indentationLength = original.match(/^\s*/)[0].length;
		const prefixLength =
			type === "heading" ? 2 : type === "task" ? 6 : type === "ordered" ? 3 : 2;
		nextStart += indentationLength + prefixLength;
	}
	replaceNoteText(
		lineStart,
		lineEnd,
		transformed,
		nextStart,
		nextEnd,
		direction,
	);
}

function applyNoteLink() {
	if (!noteInput) return;
	const start = noteInput.selectionStart;
	const end = noteInput.selectionEnd;
	const direction = noteInput.selectionDirection;
	const selected = noteInput.value.slice(start, end);
	const label = selected || "Link text";
	const url = "https://";
	const replacement = "[" + label + "](" + url + ")";
	if (selected) {
		const urlStart = start + label.length + 3;
		replaceNoteText(
			start,
			end,
			replacement,
			urlStart,
			urlStart + url.length,
			direction,
		);
	} else {
		replaceNoteText(
			start,
			end,
			replacement,
			start + 1,
			start + 1 + label.length,
			direction,
		);
	}
}

let noteComposing = false;

function applyNoteFormat(type) {
	if (!noteInput || noteComposing) return;
	if (type === "bold") return wrapNoteSelection("**", "**", "bold text");
	if (type === "italic") return wrapNoteSelection("*", "*", "italic text");
	if (type === "code") return wrapNoteSelection("`", "`", "code");
	if (type === "link") return applyNoteLink();
	applyNoteLineFormat(type);
}

let noteMode = "edit";
let noteSelection = { start: 0, end: 0, direction: "none", scrollTop: 0 };

function setNoteMode(mode, focusTarget = true) {
	if (!noteInput || !notePreview) return;
	const previousMode = noteMode;
	noteMode = mode === "preview" ? "preview" : "edit";
	const isPreview = noteMode === "preview";

	if (isPreview) {
		noteSelection = {
			start: noteInput.selectionStart,
			end: noteInput.selectionEnd,
			direction: noteInput.selectionDirection,
			scrollTop: noteInput.scrollTop,
		};
		renderNotePreview();
	} else if (previousMode === "edit") {
		// 重复点击已选M的“Edit”时保留用户当下光标，而不是恢复旧选区。
		noteSelection = {
			start: noteInput.selectionStart,
			end: noteInput.selectionEnd,
			direction: noteInput.selectionDirection,
			scrollTop: noteInput.scrollTop,
		};
	}

	noteInput.hidden = isPreview;
	notePreview.hidden = !isPreview;
	if (noteFormatActions) noteFormatActions.hidden = isPreview;
	if (homeNote) homeNote.classList.toggle("is-preview", isPreview);
	noteModeButtons.forEach((button) => {
		const active = button.dataset.noteMode === noteMode;
		button.classList.toggle("active", active);
		button.setAttribute("aria-pressed", String(active));
	});
	if (noteEditButton) {
		noteEditButton.classList.toggle("active", !isPreview);
		noteEditButton.textContent = isPreview ? "Edit" : "Done";
		noteEditButton.setAttribute("aria-pressed", String(!isPreview));
	}

	if (!focusTarget) return;
	requestAnimationFrame(() => {
		if (isPreview) {
			notePreview.focus({ preventScroll: true });
		} else {
			noteInput.focus({ preventScroll: true });
			noteInput.setSelectionRange(
				noteSelection.start,
				noteSelection.end,
				noteSelection.direction,
			);
			noteInput.scrollTop = noteSelection.scrollTop;
		}
	});
}

function continueNoteList(event) {
	if (
		!noteInput ||
		event.key !== "Enter" ||
		event.shiftKey ||
		event.metaKey ||
		event.ctrlKey ||
		event.altKey ||
		event.isComposing ||
		noteComposing ||
		noteInput.selectionStart !== noteInput.selectionEnd
	) {
		return false;
	}

	const value = noteInput.value;
	const cursor = noteInput.selectionStart;
	const lineStart = value.lastIndexOf("\n", cursor - 1) + 1;
	const nextBreak = value.indexOf("\n", cursor);
	const lineEnd = nextBreak === -1 ? value.length : nextBreak;
	const line = value.slice(lineStart, lineEnd);
	const patterns = [
		{
			regex: /^(\s*)[-*+]\s+\[[ xX]\]\s*(.*)$/,
			prefix: () => "- [ ] ",
		},
		{
			regex: /^(\s*)(\d+)[.)]\s+(.*)$/,
			prefix: (match) => String(Number.parseInt(match[2], 10) + 1) + ". ",
		},
		{
			regex: /^(\s*)[-*+]\s+(.*)$/,
			prefix: () => "- ",
		},
		{
			regex: /^(\s*)>\s?(.*)$/,
			prefix: () => "> ",
		},
	];

	const definition = patterns.find((candidate) => candidate.regex.test(line));
	if (!definition) return false;
	const match = line.match(definition.regex);
	const content = match[match.length - 1];
	const indentation = match[1];
	event.preventDefault();

	if (!content.trim()) {
		replaceNoteText(
			lineStart,
			lineEnd,
			indentation,
			lineStart + indentation.length,
			lineStart + indentation.length,
		);
		return true;
	}

	const prefix = indentation + definition.prefix(match);
	const insertion = "\n" + prefix;
	replaceNoteText(
		cursor,
		cursor,
		insertion,
		cursor + insertion.length,
		cursor + insertion.length,
	);
	return true;
}

if (noteInput) {
	try {
		noteInput.value = localStorage.getItem(NOTE_KEY) || "";
	} catch (e) {
		// ignore
	}

	let noteTimer = null;
	const saveNote = () => {
		if (noteTimer) clearTimeout(noteTimer);
		noteTimer = null;
		if (workspaceReloadPending) return;
		try {
			localStorage.setItem(NOTE_KEY, noteInput.value);
		} catch (e) {
			// ignore quota errors
		}
	};

	noteInput.addEventListener("input", () => {
		if (!noteInput.value.trim())
			localStorage.removeItem(NOTE_ACTIVE_ARCHIVE_KEY);
		renderNotePreview();
		clearTimeout(noteTimer);
		noteTimer = setTimeout(saveNote, 300);
	});
	noteInput.addEventListener("blur", saveNote);
	noteInput.addEventListener("compositionstart", () => {
		noteComposing = true;
	});
	noteInput.addEventListener("compositionend", () => {
		noteComposing = false;
	});
	noteInput.addEventListener("keydown", (event) => {
		if (continueNoteList(event)) return;
		if (!(event.metaKey || event.ctrlKey) || event.altKey || event.isComposing)
			return;
		const key = event.key.toLowerCase();
		if (key !== "b" && key !== "i") return;
		event.preventDefault();
		applyNoteFormat(key === "b" ? "bold" : "italic");
	});

	window.addEventListener("beforeunload", saveNote);
	document.addEventListener("visibilitychange", () => {
		if (document.hidden) saveNote();
	});

	noteInput.hidden = false;
}

function loadNoteArchive() {
	try {
		const parsed = JSON.parse(localStorage.getItem(NOTE_ARCHIVE_KEY) || "[]");
		return window.NotchDomain.normalizeNoteArchive(parsed);
	} catch (error) {
		return [];
	}
}

let selectedNoteId = "";

function noteArchiveTitle(note) {
	return String((note && note.title) || "").trim() || "Untitled note";
}

function noteArchiveExcerpt(note) {
	const lines = String((note && note.content) || "")
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);
	return lines
		.join(" ")
		.replace(/[#*_~`>[\]]/g, "")
		.slice(0, 86);
}

function noteArchiveTime(timestamp) {
	return new Intl.DateTimeFormat("en-US", {
		year: "numeric",
		month: "numeric",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	}).format(new Date(timestamp));
}

function renderNotesDetail(notes = loadNoteArchive()) {
	if (!notesDetail) return;
	notesDetail.replaceChildren();
	const note = notes.find((item) => item.id === selectedNoteId);
	if (!note) {
		const empty = document.createElement("div");
		empty.className = "notes-detail-empty";
		const hasArchive = loadNoteArchive().length > 0;
		empty.innerHTML = hasArchive
			? '<span class="notes-empty-mark" aria-hidden="true">⌕</span><strong>No matching notes</strong><p>Try a different search.</p>'
			: '<span class="notes-empty-mark" aria-hidden="true">✎</span><strong>No saved notes yet</strong><p>Write in Scratch note on Home, then save — notes show up here.</p>';
		notesDetail.append(empty);
		return;
	}

	const header = document.createElement("header");
	header.className = "notes-detail-head";
	const heading = document.createElement("div");
	const title = document.createElement("input");
	title.type = "text";
	title.className = "notes-detail-title";
	title.dataset.noteId = note.id;
	title.value = String(note.title || "");
	title.placeholder = "Untitled note";
	title.maxLength = 80;
	title.autocomplete = "off";
	title.spellcheck = false;
	title.setAttribute("aria-label", "Note title — click to edit");
	const time = document.createElement("time");
	time.className = "notes-detail-time";
	time.textContent = `Updated ${noteArchiveTime(note.updatedAt)}`;
	heading.append(title, time);
	const actions = document.createElement("div");
	actions.className = "notes-detail-actions";
	const remove = document.createElement("button");
	remove.type = "button";
	remove.className = "notes-delete";
	remove.dataset.action = "delete-note";
	remove.setAttribute("aria-label", "Delete note");
	remove.title = "Delete note";
	remove.innerHTML =
		'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V5h6v2M7 7l1 12h10l1-12"/></svg>';
	actions.append(remove);
	header.append(heading, actions);

	const editor = document.createElement("textarea");
	editor.id = "notes-editor";
	editor.className = "notes-editor";
	editor.dataset.noteId = note.id;
	editor.value = note.content;
	editor.placeholder = "Start typing your note…";
	editor.setAttribute("aria-label", `Edit note: ${noteArchiveTitle(note)}`);
	editor.spellcheck = false;
	notesDetail.append(header, editor);
	requestNoteTitle(note);
}

let notesSaveTimer = null;
let pendingNotesEditor = null;
const noteTitleAttempts = new Set();

async function requestNoteTitle(note) {
	if (
		!note ||
		note.title ||
		note.titleSource === "user" ||
		!String(note.content || "").trim() ||
		noteTitleAttempts.has(note.id) ||
		!window.notchAPI?.organizeMaterial
	)
		return;
	noteTitleAttempts.add(note.id);
	const expectedContent = note.content;
	const result = await window.notchAPI
		.organizeMaterial({ kind: "note", text: expectedContent })
		.catch(() => null);
	if (!result?.ok || !result.title) {
		noteTitleAttempts.delete(note.id);
		return;
	}
	const next = window.NotchDomain.applyGeneratedNoteTitle(
		loadNoteArchive(),
		note.id,
		result.title,
		expectedContent,
	);
	const updated = next.find((item) => item.id === note.id);
	if (!updated?.title || updated.titleSource !== "model") {
		noteTitleAttempts.delete(note.id);
		return;
	}
	localStorage.setItem(NOTE_ARCHIVE_KEY, JSON.stringify(next.slice(0, 200)));
	renderNotesLibrary();
}

function updateSavedNotePresentation(note) {
	if (!note) return;
	const title = noteArchiveTitle(note);
	const detailTitle = notesDetail?.querySelector(".notes-detail-title");
	const detailTime = notesDetail?.querySelector(".notes-detail-time");
	if (detailTitle && document.activeElement !== detailTitle)
		detailTitle.value = note.title || "";
	if (detailTime)
		detailTime.textContent = `Saved · ${noteArchiveTime(note.updatedAt)}`;
	const row = notesList?.querySelector(
		`[data-note-id="${CSS.escape(note.id)}"]`,
	);
	if (!row) return;
	const rowTitle = row.querySelector("strong");
	const rowExcerpt = row.querySelector("span");
	const rowTime = row.querySelector("time");
	if (rowTitle) rowTitle.textContent = title;
	if (rowExcerpt) rowExcerpt.textContent = noteArchiveExcerpt(note);
	if (rowTime) rowTime.textContent = noteArchiveTime(note.updatedAt);
}

function persistNotesEditor(editor) {
	if (!editor || !editor.dataset.noteId) return;
	const notes = window.NotchDomain.updateNoteInArchive(
		loadNoteArchive(),
		editor.dataset.noteId,
		editor.value,
		Date.now(),
	);
	localStorage.setItem(NOTE_ARCHIVE_KEY, JSON.stringify(notes.slice(0, 200)));
	const updated = notes.find((note) => note.id === editor.dataset.noteId);
	if (
		localStorage.getItem(NOTE_ACTIVE_ARCHIVE_KEY) === editor.dataset.noteId &&
		noteInput
	) {
		noteInput.value = editor.value;
		localStorage.setItem(NOTE_KEY, editor.value);
		renderNotePreview();
	}
	updateSavedNotePresentation(updated);
	if (pendingNotesEditor === editor) pendingNotesEditor = null;
}

function flushNotesEditorSave() {
	if (workspaceReloadPending) return;
	if (notesSaveTimer) clearTimeout(notesSaveTimer);
	notesSaveTimer = null;
	const editor = pendingNotesEditor;
	pendingNotesEditor = null;
	if (editor) persistNotesEditor(editor);
}

function scheduleNotesEditorSave(editor) {
	pendingNotesEditor = editor;
	if (notesSaveTimer) clearTimeout(notesSaveTimer);
	const time = notesDetail?.querySelector(".notes-detail-time");
	if (time) time.textContent = "Saving…";
	notesSaveTimer = setTimeout(() => {
		notesSaveTimer = null;
		const pending = pendingNotesEditor;
		pendingNotesEditor = null;
		if (pending) persistNotesEditor(pending);
	}, 220);
}

function renderNotesLibrary() {
	if (!notesList) return;
	const archive = loadNoteArchive();
	const notes = window.NotchDomain.filterNotes(
		archive,
		notesSearch?.value || "",
	);
	if (notesCount) notesCount.textContent = `${archive.length} notes`;
	if (!notes.some((note) => note.id === selectedNoteId))
		selectedNoteId = notes[0]?.id || "";
	notesList.replaceChildren();
	if (!notes.length) {
		const empty = document.createElement("div");
		empty.className = "notes-list-empty";
		empty.textContent = archive.length
			? "No matching notes"
			: "Saved notes appear here";
		notesList.append(empty);
		renderNotesDetail(notes);
		return;
	}
	notes.forEach((note) => {
		const button = document.createElement("button");
		button.type = "button";
		button.className = `notes-list-item${note.id === selectedNoteId ? " active" : ""}`;
		button.dataset.noteId = note.id;
		button.dataset.lineSidebarItem = "";
		button.setAttribute("aria-pressed", String(note.id === selectedNoteId));
		const title = document.createElement("strong");
		title.textContent = noteArchiveTitle(note);
		const excerpt = document.createElement("span");
		excerpt.textContent = noteArchiveExcerpt(note);
		const time = document.createElement("time");
		time.textContent = noteArchiveTime(note.updatedAt);
		button.append(title, excerpt, time);
		notesList.append(button);
	});
	renderNotesDetail(notes);
}

noteSaveButton?.addEventListener("click", () => {
	const content = noteInput?.value.trim() || "";
	if (!content) {
		showStatusToast("Write something before saving");
		return;
	}
	const notes = loadNoteArchive();
	let activeId = localStorage.getItem(NOTE_ACTIVE_ARCHIVE_KEY) || "";
	const existing = notes.find((item) => item.id === activeId);
	if (existing) {
		existing.content = content;
		existing.updatedAt = Date.now();
	} else {
		activeId = generateId();
		notes.unshift({
			id: activeId,
			content,
			createdAt: Date.now(),
			updatedAt: Date.now(),
		});
	}
	localStorage.setItem(NOTE_ACTIVE_ARCHIVE_KEY, activeId);
	localStorage.setItem(NOTE_ARCHIVE_KEY, JSON.stringify(notes.slice(0, 200)));
	localStorage.setItem(NOTE_KEY, noteInput.value);
	selectedNoteId = activeId;
	renderNotesLibrary();
	showStatusToast("Note saved");
});

notesList?.addEventListener("click", (event) => {
	const row = event.target.closest("[data-note-id]");
	if (!row) return;
	flushNotesEditorSave();
	selectedNoteId = row.dataset.noteId;
	renderNotesLibrary();
});

notesSearch?.addEventListener("input", () => {
	flushNotesEditorSave();
	renderNotesLibrary();
});

notesDetail?.addEventListener("input", (event) => {
	const title = event.target.closest(".notes-detail-title");
	if (title?.dataset.noteId) {
		const notes = window.NotchDomain.updateNoteTitle(
			loadNoteArchive(),
			title.dataset.noteId,
			title.value,
			Date.now(),
		);
		localStorage.setItem(NOTE_ARCHIVE_KEY, JSON.stringify(notes.slice(0, 200)));
		updateSavedNotePresentation(
			notes.find((note) => note.id === title.dataset.noteId),
		);
		return;
	}
	const editor = event.target.closest("#notes-editor");
	if (editor) scheduleNotesEditorSave(editor);
});

notesDetail?.addEventListener("focusout", (event) => {
	const title = event.target.closest(".notes-detail-title");
	if (title?.dataset.noteId) {
		const note = loadNoteArchive().find(
			(item) => item.id === title.dataset.noteId,
		);
		if (note) title.value = note.title;
	}
	if (event.target.closest("#notes-editor")) flushNotesEditorSave();
});

notesDetail?.addEventListener("click", (event) => {
	const action = event.target.closest("[data-action]")?.dataset.action;
	if (!action) return;
	flushNotesEditorSave();
	const notes = loadNoteArchive();
	const note = notes.find((item) => item.id === selectedNoteId);
	if (!note) return;
	if (action === "delete-note") {
		const next = notes.filter((item) => item.id !== note.id);
		localStorage.setItem(NOTE_ARCHIVE_KEY, JSON.stringify(next));
		if (localStorage.getItem(NOTE_ACTIVE_ARCHIVE_KEY) === note.id) {
			localStorage.removeItem(NOTE_ACTIVE_ARCHIVE_KEY);
		}
		selectedNoteId = next[0]?.id || "";
		renderNotesLibrary();
		showStatusToast("Note deleted");
		return;
	}
});

document.addEventListener("notch:tabchange", (event) => {
	if (event.detail?.tab !== "notes") flushNotesEditorSave();
});
window.addEventListener("beforeunload", flushNotesEditorSave);

if (noteFormatActions) {
	noteFormatActions.addEventListener("mousedown", (event) => {
		if (event.target.closest("[data-note-format]")) event.preventDefault();
	});
	noteFormatActions.addEventListener("click", (event) => {
		const button = event.target.closest("[data-note-format]");
		if (!button) return;
		applyNoteFormat(button.dataset.noteFormat);
	});
}

noteModeButtons.forEach((button) => {
	button.addEventListener("click", () => setNoteMode(button.dataset.noteMode));
});
noteEditButton?.addEventListener("click", () =>
	setNoteMode(noteMode === "preview" ? "edit" : "preview"),
);

if (notePreview) {
	notePreview.addEventListener("click", (event) => {
		const link = event.target.closest("[data-note-href]");
		if (!link) return;
		event.preventDefault();
		event.stopPropagation();
		const href = safeMarkdownUrl(link.dataset.noteHref);
		if (
			href &&
			window.notchAPI &&
			typeof window.notchAPI.openExternal === "function"
		) {
			window.notchAPI.openExternal(href).catch(() => {});
		}
	});
	notePreview.addEventListener("keydown", (event) => {
		if (event.key !== "Enter" && event.key !== " ") return;
		const link = event.target.closest("[data-note-href]");
		if (!link) return;
		event.preventDefault();
		const href = safeMarkdownUrl(link.dataset.noteHref);
		if (
			href &&
			window.notchAPI &&
			typeof window.notchAPI.openExternal === "function"
		) {
			window.notchAPI.openExternal(href).catch(() => {});
		}
	});
}
