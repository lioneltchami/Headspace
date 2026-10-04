// Loaded after ui-shared/todo-ui/notes-ui/home-ui/clipboard-ui (index.html order): panel mode, tabs, shortcut recorder, then boot.
let isExpanded = false;
let modeBusy = false;
let pendingMode = null;
let restoreNotchFocusAfterCollapse = false;
// 从折叠态展开的瞬间置 true，岛体落定后自动清除；
// setActiveTab 读取此标志决定是否延后重活，已展开态切 Tab 不受影响。
let _justExpanded = false;

const PANEL_MOTION_FALLBACK_MS = 440;
const OPENING_SETTLE_MS = 360;
const HEAVY_LOAD_AFTER_OPEN_MS = 360;

function nextAnimationFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function waitForPanelMotion() {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      panel.removeEventListener("transitionend", onEnd);
      resolve();
    };
    const onEnd = (event) => {
      if (
        event.target === panel &&
        event.propertyName === "opacity" &&
        event.pseudoElement === "::before"
      ) {
        finish();
      }
    };
    const timer = setTimeout(finish, PANEL_MOTION_FALLBACK_MS);
    panel.addEventListener("transitionend", onEnd);
  });
}

async function ipcSetMode(mode) {
  if (!window.notchAPI || typeof window.notchAPI.setMode !== "function") return;
  try {
    await window.notchAPI.setMode(mode);
  } catch (e) {
    // ignore
  }
}

async function ipcBeginCollapse() {
  if (!window.notchAPI || typeof window.notchAPI.beginCollapse !== "function")
    return;
  try {
    await window.notchAPI.beginCollapse();
  } catch (e) {
    // ignore
  }
}

function syncPanelAccessibility(expanded) {
  const focusWasInPanel = !!(panel && panel.contains(document.activeElement));
  if (!expanded) {
    restoreNotchFocusAfterCollapse = document.hasFocus();
    if (focusWasInPanel) document.activeElement.blur();
  } else {
    restoreNotchFocusAfterCollapse = false;
  }
  if (panel) {
    panel.inert = !expanded;
    panel.setAttribute("aria-hidden", String(!expanded));
  }
  if (!notch) return;
  notch.setAttribute("aria-expanded", String(expanded));
  notch.setAttribute(
    "aria-label",
    expanded ? "Collapse Headspace" : "Expand Headspace",
  );
  if (expanded && document.activeElement === notch) {
    const activeTabButton = document.querySelector(
      `.tab[data-tab="${activeTab}"]`,
    );
    if (activeTabButton) activeTabButton.focus({ preventScroll: true });
  }
  notch.setAttribute("aria-hidden", String(expanded));
  notch.tabIndex = expanded ? -1 : 0;
}

// 原生窗口只提供动画需要的透明画布；用户看到的黑色岛体由 CSS 连续形变。
// 收起必须等岛体退场Done后再缩原生窗口，避免最后一帧被裁掉。
async function setMode(expanded) {
  if (modeBusy) {
    pendingMode = expanded;
    return;
  }
  if (expanded === isExpanded) return;
  modeBusy = true;
  isExpanded = expanded;
  try {
    if (expanded) {
      // 每次召回使用SettingsM的默认页，不沿用上次收起时的停留页。
      _justExpanded = true;
      setTimeout(() => {
        _justExpanded = false;
      }, OPENING_SETTLE_MS);
      const openingTab = window.NotchDomain.resolveDefaultPanelTab(
        defaultOpenTab,
        TABS,
      );
      if (activeTab !== openingTab) await setActiveTab(openingTab);
      else applyTabDom(openingTab);
      syncPanelAccessibility(true);
      app.classList.remove("collapsed", "closing");
      app.classList.add("opening");
      void panel.offsetWidth;
      // offsetWidth 只强制布局，不强制绘制；而 rAF 回调发生在绘制之前。
      // 必须等两帧、确认 .opening 的透明折叠条真的进了合成器，再让主进程放L窗口，
      // 否则放L时被钉在新原点上的仍是那条黑色折叠条（菜单栏黑块闪烁的成因）。
      await nextAnimationFrame();
      await nextAnimationFrame();
      await ipcSetMode("expanded");
      await nextAnimationFrame();
      await nextAnimationFrame();
      app.classList.remove("opening");
      app.classList.add("expanded");
      // 展开后面板从Hide变为可见，tab 尺寸此时才可量，校准激活胶囊位置
      requestAnimationFrame(() => requestAnimationFrame(positionIndicator));
      setTimeout(() => {
        if (!isExpanded) return;
        if (activeTab === "clip") renderClipList();
      }, HEAVY_LOAD_AFTER_OPEN_MS);
    } else {
      const motion = waitForPanelMotion();
      syncPanelAccessibility(false);
      // 隐私优先：不要把摄像头释放放在 rAF 之后，Hide窗口可能Pause动画帧。
      stopMirror();
      await ipcBeginCollapse();
      app.classList.add("closing");
      await nextAnimationFrame();
      await motion;
      await nextAnimationFrame();
      await nextAnimationFrame();
      await ipcSetMode("collapsed");
      app.classList.remove("expanded", "closing", "opening");
      app.classList.add("collapsed");
      if (restoreNotchFocusAfterCollapse && document.hasFocus() && notch) {
        notch.focus({ preventScroll: true });
      }
      restoreNotchFocusAfterCollapse = false;
    }
    document.dispatchEvent(
      new CustomEvent("notch:modechange", {
        detail: { expanded: isExpanded },
      }),
    );
  } finally {
    modeBusy = false;
    if (pendingMode !== null) {
      const nextMode = pendingMode;
      pendingMode = null;
      if (nextMode !== isExpanded) setMode(nextMode);
    }
  }
}

notch.addEventListener("click", (e) => {
  e.stopPropagation();
  setMode(!isExpanded);
});

notch.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  e.preventDefault();
  if (e.repeat) return;
  setMode(!isExpanded);
});

document.addEventListener(
  "keydown",
  (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const editable = Boolean(
      target &&
      target.closest(
        'input, textarea, select, [contenteditable]:not([contenteditable="false"]), audio, video',
      ),
    );
    if (
      !window.NotchDomain.shouldTogglePanelForSpace({
        key: event.key,
        code: event.code,
        repeat: event.repeat,
        isComposing: event.isComposing,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        editable,
      })
    )
      return;
    event.preventDefault();
    event.stopImmediatePropagation();
    setMode(!isExpanded);
  },
  true,
);

syncPanelAccessibility(false);

panel.addEventListener("click", (e) => {
  e.stopPropagation();
});

// Esc 收起面板（菜单栏会拦截顶部刘海条的点击，给收起多一条可靠路径）；
// 焦点在输入框/速记里时，第一次 Esc 只Quit输入。
// Escape 不会原生到达页面（被浏览器层吞掉），由主进程 before-input-event 转发
if (window.notchAPI && typeof window.notchAPI.onEscape === "function") {
  window.notchAPI.onEscape(() => {
    const el = document.activeElement;
    if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) {
      el.blur();
      return;
    }
    if (document.querySelector(".multi-selected")) {
      PRIORITIES.forEach((priority) => {
        todoSelections[priority].clear();
        todoSelectionAnchors[priority] = null;
        renderList(priority);
      });
      document.dispatchEvent(new CustomEvent("notch:clear-selection"));
      return;
    }
    if (isExpanded) setMode(false);
  });
}

if (window.notchAPI && typeof window.notchAPI.onToggleShortcut === "function") {
  window.notchAPI.onToggleShortcut(() => setMode(!isExpanded));
}

// 失焦与点击收起共用同一个状态机，保证退场节奏一致。
if (
  window.notchAPI &&
  typeof window.notchAPI.onCollapseRequest === "function"
) {
  window.notchAPI.onCollapseRequest(() => {
    if (isExpanded) setMode(false);
  });
}

// 全局快捷键召唤也走同一套 Tab 与展开状态机，避免出现另一种突兀的入场路径。
if (window.notchAPI && typeof window.notchAPI.onOpenClip === "function") {
  window.notchAPI.onOpenClip(async () => {
    await setActiveTab("clip");
    if (!isExpanded) await setMode(true);
  });
}

// 布局度量（主进程按屏计算下发）：折叠条高 / 菜单栏占位高 / 各 Tab 目标尺寸
let layoutMetrics = null;

function applyLayoutMetrics(metrics) {
  if (!metrics) return;
  layoutMetrics = metrics;
  if (metrics.stripHeight) {
    document.documentElement.style.setProperty(
      "--notch-h",
      `${metrics.stripHeight}px`,
    );
  }
  if (metrics.menuBarHeight) {
    document.documentElement.style.setProperty(
      "--mb-h",
      `${metrics.menuBarHeight}px`,
    );
  }
}

if (window.notchAPI && typeof window.notchAPI.getMetrics === "function") {
  window.notchAPI
    .getMetrics()
    .then(applyLayoutMetrics)
    .catch(() => {});
}

if (window.notchAPI && typeof window.notchAPI.onMetricsChanged === "function") {
  window.notchAPI.onMetricsChanged(applyLayoutMetrics);
}

// ============ Tab 切换 ============
const TAB_KEY = "notch-active-tab";
const ALL_TABS = [
  "home",
  "todo",
  "notes",
  "links",
  "recordings",
  "credentials",
  "clip",
  "settings",
];
let TABS = ALL_TABS.filter((name) => name !== "clip");
let tabButtons = Array.from(document.querySelectorAll(".tab:not([hidden])"));
const tabPanels = Array.from(document.querySelectorAll(".tab-panel"));
const tabIndicator = document.getElementById("tab-indicator");
const collapseBtn = document.getElementById("collapse-btn");

let activeTab = "home";
let defaultOpenTab = "home";

function applyFeatureSettings(settings) {
  const features = {
    ...((settings && settings.features) || {}),
    home: true,
    settings: true,
  };
  document.querySelectorAll(".tab[data-tab]").forEach((button) => {
    const enabled =
      button.dataset.tab === "home" ||
      button.dataset.tab === "settings" ||
      features[button.dataset.tab] !== false;
    button.hidden = !enabled;
    button.setAttribute("aria-hidden", String(!enabled));
  });
  TABS = window.NotchDomain.visiblePanelTabs(ALL_TABS, features);
  defaultOpenTab = window.NotchDomain.resolveDefaultPanelTab(
    settings?.defaultTab,
    TABS,
  );
  tabButtons = Array.from(document.querySelectorAll(".tab:not([hidden])"));
  tabButtons.forEach((button) => button.classList.remove("tab-split-start"));
  document
    .getElementById("tabs")
    ?.classList.toggle("is-split", tabButtons.length > 4);
  if (tabButtons.length > 4) {
    tabButtons[Math.ceil(tabButtons.length / 2)]?.classList.add(
      "tab-split-start",
    );
  }
  if (!TABS.includes(activeTab)) setActiveTab("home");
  requestAnimationFrame(positionIndicator);
}

if (window.notchAPI?.getAppSettings) {
  window.notchAPI
    .getAppSettings()
    .then(applyFeatureSettings)
    .catch(() => {});
  window.notchAPI.onAppSettingsChanged?.(applyFeatureSettings);
}

function positionIndicator() {
  const btn = tabButtons.find((b) => b.dataset.tab === activeTab);
  if (!btn || !tabIndicator) return;
  tabIndicator.style.width = `${btn.offsetWidth}px`;
  tabIndicator.style.transform = `translateX(${btn.offsetLeft}px)`;
}

function applyTabDom(name) {
  tabButtons.forEach((b) => {
    const selected = b.dataset.tab === name;
    b.classList.toggle("active", selected);
    b.setAttribute("aria-selected", String(selected));
    b.tabIndex = selected ? 0 : -1;
  });
  tabPanels.forEach((p) => {
    const selected = p.id === `tab-${name}`;
    p.classList.toggle("active", selected);
    p.inert = !selected;
    p.setAttribute("aria-hidden", String(!selected));
  });
  positionIndicator();
  requestAnimationFrame(() => requestAnimationFrame(positionIndicator));
  document.dispatchEvent(
    new CustomEvent("notch:tabchange", { detail: { tab: name } }),
  );
}

async function ipcSetTab(name) {
  if (!window.notchAPI || typeof window.notchAPI.setTab !== "function") return;
  try {
    await window.notchAPI.setTab(name);
  } catch (e) {
    // ignore
  }
}

// 固定展开尺寸下，Tab 只切换内容与指示器，不再改变原生窗口边界。
async function morphToTab(name) {
  await ipcSetTab(name);
  applyTabDom(name);
  positionIndicator();
}

let tabBusy = false;
let pendingTab = null;

async function setActiveTab(name) {
  if (!TABS.includes(name)) name = "home";
  if (tabBusy) {
    pendingTab = name; // 补间M连点：记住最后目标，结束后追赶
    return;
  }
  if (name === activeTab) {
    applyTabDom(name);
    return;
  }
  tabBusy = true;
  activeTab = name;
  if (name !== "home") stopMirror();
  try {
    // Image预加载等重活的调度策略：
    //   - 已展开态切 Tab：_justExpanded=false → 立即执行，保持即时响应
    //   - 从折叠态展开（_justExpanded=true）：延后到展开动画基本落定后再跑，
    //     避免与面板 scale 手势争首帧 CPU/GPU，消除展开卡顿
    // renderClipList 延后只是缩略Img晚一点出现，可接受。
    const _tabNameForDeferred = name; // 闭包捕获当前目标 Tab
    const runHeavyLoads = () => {
      if (_tabNameForDeferred === "clip") renderClipList();
      if (_tabNameForDeferred === "notes") renderNotesLibrary();
    };
    if (_justExpanded) {
      // 双帧后再延迟重活，让岛体形变先Done，避免抢首帧 CPU/GPU。
      requestAnimationFrame(() =>
        requestAnimationFrame(() =>
          setTimeout(runHeavyLoads, HEAVY_LOAD_AFTER_OPEN_MS),
        ),
      );
    } else {
      // 已展开态切 Tab：立即执行，无感知延迟
      runHeavyLoads();
    }
    if (isExpanded) {
      await morphToTab(name);
    } else {
      // 折叠态只记录目标尺寸（主进程不变形），展开时一步到位
      await ipcSetTab(name);
      applyTabDom(name);
    }
    try {
      localStorage.setItem(TAB_KEY, name);
    } catch (e) {
      // ignore quota errors
    }
  } finally {
    tabBusy = false;
    if (pendingTab && pendingTab !== activeTab) {
      const next = pendingTab;
      pendingTab = null;
      setActiveTab(next);
    } else {
      pendingTab = null;
    }
  }
}

// 胶囊滑动结束后兜底再校准一次（窗口变形期间布局可能回流）
if (tabIndicator) {
  tabIndicator.addEventListener("transitionend", positionIndicator);
}

Array.from(document.querySelectorAll(".tab[data-tab]")).forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    setActiveTab(btn.dataset.tab);
  });
  btn.addEventListener("keydown", (e) => {
    const currentIndex = tabButtons.indexOf(btn);
    let nextIndex = null;
    if (e.key === "ArrowRight")
      nextIndex = (currentIndex + 1) % tabButtons.length;
    if (e.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + tabButtons.length) % tabButtons.length;
    }
    if (e.key === "Home") nextIndex = 0;
    if (e.key === "End") nextIndex = tabButtons.length - 1;
    if (nextIndex === null) return;
    e.preventDefault();
    const nextButton = tabButtons[nextIndex];
    nextButton.focus({ preventScroll: true });
    setActiveTab(nextButton.dataset.tab);
  });
});

// 托盘里的“Settings快捷键…”会把Settings入口以内联浮层放到面板M。
// 这里绑定所有 Tab（包括启动时Hide的Clipboard），避免功能启用后按钮仍没有事件。
const shortcutRecorder = document.getElementById("shortcut-recorder");
const shortcutRecorderValue = document.getElementById(
  "shortcut-recorder-value",
);
const shortcutRecorderCancel = document.getElementById(
  "shortcut-recorder-cancel",
);
let shortcutRecorderActive = false;

function closeShortcutRecorder() {
  shortcutRecorderActive = false;
  if (shortcutRecorder) shortcutRecorder.hidden = true;
}

function keyEventToAccelerator(event) {
  const keyAliases = {
    " ": "Space",
    Spacebar: "Space",
    Escape: "Escape",
    Esc: "Escape",
    ArrowLeft: "Left",
    ArrowRight: "Right",
    ArrowUp: "Up",
    ArrowDown: "Down",
  };
  let key = keyAliases[event.key] || event.key;
  if (/^[a-z]$/i.test(key)) key = key.toUpperCase();
  if (
    !/^(?:[A-Z0-9]|F(?:[1-9]|1[0-9]|2[0-4])|Space|Tab|Escape|Left|Right|Up|Down|Home|End|PageUp|PageDown|Backspace|Delete|Enter)$/.test(
      key,
    )
  )
    return "";
  const parts = [];
  if (event.metaKey) parts.push("Command");
  if (event.ctrlKey) parts.push("Control");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");
  parts.push(key);
  return parts.join("+");
}

shortcutRecorder?.addEventListener("keydown", async (event) => {
  if (!shortcutRecorderActive) return;
  event.preventDefault();
  event.stopPropagation();
  if (event.key === "Escape") {
    closeShortcutRecorder();
    return;
  }
  const accelerator = keyEventToAccelerator(event);
  if (!accelerator) {
    if (shortcutRecorderValue)
      shortcutRecorderValue.textContent = "Press a full key combination";
    return;
  }
  if (
    accelerator !== "Space" &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.shiftKey
  ) {
    if (shortcutRecorderValue)
      shortcutRecorderValue.textContent =
        "Space is the only single-key shortcut";
    return;
  }
  if (shortcutRecorderValue) shortcutRecorderValue.textContent = accelerator;
  const result = await window.notchAPI
    ?.setPanelShortcut?.(accelerator)
    .catch(() => ({ ok: false }));
  if (!result?.ok) {
    if (shortcutRecorderValue)
      shortcutRecorderValue.textContent =
        result?.error === "occupied"
          ? "That shortcut is already in use"
          : "That shortcut can’t be used";
    return;
  }
  showStatusToast(`Shortcut set to ${accelerator}`);
  setTimeout(closeShortcutRecorder, 420);
});

shortcutRecorderCancel?.addEventListener("click", closeShortcutRecorder);
function openShortcutRecorder() {
  if (!isExpanded) setMode(true);
  shortcutRecorderActive = true;
  shortcutRecorder.hidden = false;
  shortcutRecorderValue.textContent = "Waiting for input…";
  requestAnimationFrame(() => shortcutRecorder.focus({ preventScroll: true }));
}
window.notchAPI?.onRecordShortcut?.(openShortcutRecorder);
document.addEventListener("notch:record-shortcut", openShortcutRecorder);

if (collapseBtn) {
  collapseBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    setMode(false);
  });
}

// 顶栏空白处点按收起——黑条在展开态已退场，由顶栏接替这一角色。
// 排除交互区（Tab / 按钮 / 输入 / 搜索框），品牌区与空白处都可收起（明确的收起热区）。
// 注意：home/todo 下搜索框Hide会让 .topbar-mid 高度塌成 0，点击其实落在 .topbar 上，
// 所以必须挂在 .topbar 上并用 closest 排除，不能只认 .topbar-mid 本体。
const topbarEl = document.querySelector(".topbar");
if (topbarEl) {
  topbarEl.addEventListener("click", (e) => {
    if (e.target.closest(".tabs, button, input")) return;
    e.stopPropagation();
    setMode(false);
  });
}

function initTab() {
  setActiveTab("home");
}

renderAll();
renderClipList(); // 首屏确保 clip-list DOM 就绪时渲染一次（幂等）
renderClipFavs(); // 首屏渲染FavoritesClip块
initTab();
