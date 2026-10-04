(function initWindowsMusicUi() {
  const Kit = window.NotchWorkspaceKit;
  if (!Kit) return;
  const { Domain, loadJson, saveJson } = Kit;
  const HIDDEN_WINDOWS_KEY = "notch-hidden-windows";
  // ============ Open windows ============
  const windowsRefresh = document.getElementById("windows-refresh");
  const windowsHidden = document.getElementById("windows-hidden");
  const windowList = document.getElementById("window-list");
  let windows = [];
  const hiddenWindows = new Set(
    loadJson(HIDDEN_WINDOWS_KEY, []).filter((item) => typeof item === "string"),
  );
  let windowsLoading = false;
  let workspaceTab =
    document.querySelector(".tab.active")?.dataset.tab || "home";
  let workspaceExpanded =
    document.getElementById("app")?.classList.contains("expanded") || false;
  let homeWindowsVisible = window.NotchHome?.isVisible?.("windows") !== false;
  let windowDrag = null;
  let suppressWindowClickUntil = 0;

  function windowHideKey(windowInfo) {
    return `${String(windowInfo.appName || "").trim()}\u0000${String(windowInfo.title || "").trim()}`;
  }

  function persistHiddenWindows() {
    saveJson(HIDDEN_WINDOWS_KEY, [...hiddenWindows]);
  }

  function clearWindowDragVisuals() {
    const drag = windowDrag;
    windowDrag = null;
    if (drag) {
      clearTimeout(drag.timer);
      try {
        if (drag.item.hasPointerCapture?.(drag.pointerId))
          drag.item.releasePointerCapture(drag.pointerId);
      } catch (error) {}
      drag.item.classList.remove("dragging", "remove-ready");
      drag.item.style.removeProperty("--window-drag-x");
      drag.item.style.removeProperty("--window-drag-y");
    }
    document.querySelectorAll(".home-windows.drag-active").forEach((card) => {
      card.classList.remove("drag-active");
    });
    return drag;
  }

  function renderWindows(error = "") {
    if (!windowList) return;
    // 轮询可能在长按过程M重建列表；先清理捕获与卡片移除态，避免红色区域残留。
    clearWindowDragVisuals();
    windowList.replaceChildren();
    if (error) {
      const empty = document.createElement("div");
      empty.className = "window-empty permission";
      // 两种权限的现象完全一样（列表空），但要开的开关不同，必须分开说：
      // 「Screen Recording」决定能不能读到窗口Heading，「Accessibility」决定能不能枚举和聚焦窗口。
      // 缺Screen Recording时系统既不报错也不弹提示，所以只能由这里告诉用户。
      const screenRecording = error === "screen_recording_permission_required";
      const title = screenRecording
        ? "Screen Recording permission required"
        : "Accessibility permission required";
      const pane = screenRecording ? "Screen Recording" : "Accessibility";
      const heading = document.createElement("strong");
      heading.textContent = title;
      const hint = document.createElement("span");
      hint.textContent = `System Settings → Privacy & Security → ${pane}, allow Headspace, then try again.`;
      const action = document.createElement("button");
      action.type = "button";
      action.className = "window-permission-open";
      action.textContent = "Open System Settings";
      action.addEventListener("click", () => {
        if (
          window.notchAPI &&
          typeof window.notchAPI.openPrivacySettings === "function"
        ) {
          window.notchAPI.openPrivacySettings(
            screenRecording ? "screen-recording" : "accessibility",
          );
        }
      });
      empty.append(heading, hint, action);
      windowList.appendChild(empty);
      return;
    }
    const visibleWindows = Domain.numberWindowLabels(
      windows.filter((item) => !hiddenWindows.has(windowHideKey(item))),
    );
    if (windowsHidden) {
      windowsHidden.hidden = hiddenWindows.size === 0;
      windowsHidden.textContent = "Hide";
      windowsHidden.setAttribute(
        "aria-label",
        `Restore ${hiddenWindows.size} hidden windows`,
      );
    }
    if (!visibleWindows.length) {
      const empty = document.createElement("div");
      empty.className = "window-empty";
      empty.textContent = windowsLoading
        ? "Reading open windows…"
        : hiddenWindows.size
          ? "All windows hidden · restore above"
          : "No switchable windows found";
      windowList.appendChild(empty);
      return;
    }
    visibleWindows.slice(0, 15).forEach((windowInfo) => {
      const button = document.createElement("button");
      button.className = "window-item";
      button.type = "button";
      button.dataset.id = windowInfo.id;
      button.title = `${windowInfo.displayName}\n${windowInfo.title}\nPress and hold, drag out to hide`;
      const mark = document.createElement("span");
      mark.className = "window-app-mark";
      if (windowInfo.icon) {
        const icon = document.createElement("img");
        icon.src = windowInfo.icon;
        icon.alt = "";
        icon.draggable = false;
        mark.appendChild(icon);
      } else {
        mark.textContent = (windowInfo.appName.charAt(0) || "·").toUpperCase();
      }
      const appName = document.createElement("strong");
      appName.textContent = windowInfo.displayName;
      button.append(mark, appName);
      windowList.appendChild(button);
    });
  }

  async function refreshWindows(force = false) {
    if (!window.NotchHome?.isVisible?.("windows")) return;
    if (
      windowsLoading ||
      !window.notchAPI ||
      (!force && (!workspaceExpanded || workspaceTab !== "home"))
    )
      return;
    windowsLoading = true;
    renderWindows();
    let result;
    try {
      result = await window.notchAPI.listWindows();
    } catch (error) {
      result = { items: [], error: "accessibility_permission_required" };
    }
    windowsLoading = false;
    windows = result && Array.isArray(result.items) ? result.items : [];
    renderWindows(result && result.error);
  }

  if (windowsRefresh)
    windowsRefresh.addEventListener("click", () => refreshWindows(true));
  if (windowsHidden) {
    windowsHidden.addEventListener("click", () => {
      hiddenWindows.clear();
      persistHiddenWindows();
      renderWindows();
    });
  }
  if (windowList) {
    windowList.addEventListener("click", (event) => {
      if (Date.now() < suppressWindowClickUntil) return;
      const item = event.target.closest(".window-item[data-id]");
      if (item && window.notchAPI) window.notchAPI.focusWindow(item.dataset.id);
    });
    windowList.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || windowDrag) return;
      const item = event.target.closest(".window-item[data-id]");
      if (!item) return;
      windowDrag = {
        item,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        active: false,
        removeReady: false,
        timer: setTimeout(() => {
          if (!windowDrag || windowDrag.item !== item) return;
          windowDrag.active = true;
          item.classList.add("dragging");
          try {
            item.setPointerCapture(event.pointerId);
          } catch (error) {}
          item.closest(".home-windows")?.classList.add("drag-active");
        }, 460),
      };
    });
    document.addEventListener("pointermove", (event) => {
      if (!windowDrag || windowDrag.pointerId !== event.pointerId) return;
      const dx = event.clientX - windowDrag.startX;
      const dy = event.clientY - windowDrag.startY;
      if (!windowDrag.active) {
        if (Math.hypot(dx, dy) > 8) {
          clearTimeout(windowDrag.timer);
          windowDrag = null;
        }
        return;
      }
      event.preventDefault();
      windowDrag.item.style.setProperty("--window-drag-x", `${dx}px`);
      windowDrag.item.style.setProperty("--window-drag-y", `${dy}px`);
      const bounds = windowList
        .closest(".home-windows")
        .getBoundingClientRect();
      windowDrag.removeReady =
        event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom;
      windowDrag.item.classList.toggle("remove-ready", windowDrag.removeReady);
    });
    const finishWindowDrag = (event) => {
      if (
        !windowDrag ||
        (event.pointerId != null && windowDrag.pointerId !== event.pointerId)
      )
        return;
      const drag = clearWindowDragVisuals();
      if (!drag) return;
      if (!drag.active) return;
      suppressWindowClickUntil = Date.now() + 450;
      if (drag.removeReady) {
        const windowInfo = windows.find(
          (item) => item.id === drag.item.dataset.id,
        );
        if (windowInfo) {
          hiddenWindows.add(windowHideKey(windowInfo));
          persistHiddenWindows();
          renderWindows();
        }
      }
    };
    document.addEventListener("pointerup", finishWindowDrag);
    document.addEventListener("pointercancel", finishWindowDrag);
    windowList.addEventListener(
      "lostpointercapture",
      () => clearWindowDragVisuals(),
      true,
    );
    window.addEventListener("blur", clearWindowDragVisuals);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) clearWindowDragVisuals();
    });
  }

  document.addEventListener("notch:tabchange", (event) => {
    clearWindowDragVisuals();
    workspaceTab = (event.detail && event.detail.tab) || "home";
    if (workspaceTab === "home") refreshWindows();
  });
  document.addEventListener("notch:modechange", (event) => {
    clearWindowDragVisuals();
    workspaceExpanded = !!(event.detail && event.detail.expanded);
    if (workspaceExpanded && workspaceTab === "home") refreshWindows();
  });
  document.addEventListener("notch:home-modules-changed", (event) => {
    const nextVisible = Array.isArray(event.detail?.visibleIds)
      ? event.detail.visibleIds.includes("windows")
      : window.NotchHome?.isVisible?.("windows") !== false;
    const restored = !homeWindowsVisible && nextVisible;
    homeWindowsVisible = nextVisible;
    if (restored && workspaceExpanded && workspaceTab === "home")
      refreshWindows(true);
  });

  // ============ Local Soda Music ============
  const homeMusic = document.getElementById("home-music");
  const musicArtwork = document.getElementById("music-artwork");
  const musicTitle = document.getElementById("music-title");
  const musicStatus = document.getElementById("music-status");
  const musicPlayToggle = document.getElementById("music-play-toggle");
  let musicPlaying = false;

  function renderMusicPlaybackState() {
    if (!homeMusic || !musicPlayToggle) return;
    homeMusic.classList.toggle("music-playing", musicPlaying);
    musicPlayToggle.dataset.musicAction = musicPlaying ? "pause" : "play";
    musicPlayToggle.setAttribute("aria-label", musicPlaying ? "Pause" : "Play");
    musicPlayToggle.innerHTML = musicPlaying
      ? '<svg viewBox="0 0 24 24"><path d="M8 7h3v10H8zM14 7h3v10h-3z" /></svg>'
      : '<svg viewBox="0 0 24 24"><path d="m9 7 8 5-8 5z" /></svg>';
  }

  async function refreshMusicStatus() {
    if (
      !homeMusic ||
      !window.notchAPI ||
      typeof window.notchAPI.getMusicStatus !== "function"
    )
      return;
    let status;
    try {
      status = await window.notchAPI.getMusicStatus();
    } catch (error) {
      status = null;
    }
    homeMusic.classList.toggle(
      "music-running",
      Boolean(status && status.running),
    );
    if (status && typeof status.playing === "boolean") {
      musicPlaying = status.playing;
      renderMusicPlaybackState();
    }
    if (status && status.icon && musicArtwork) {
      musicArtwork.replaceChildren();
      const image = document.createElement("img");
      image.src = status.icon;
      image.alt = "";
      musicArtwork.appendChild(image);
    }
    if (musicTitle)
      musicTitle.textContent =
        status && status.installed ? "Soda Music" : "Soda Music not installed";
    if (musicStatus)
      musicStatus.textContent =
        status && status.running
          ? musicPlaying
            ? "Playing"
            : "Connected"
          : status && status.installed
            ? "Tap to play"
            : "Local app required";
  }

  homeMusic?.addEventListener("click", async (event) => {
    if (event.target.closest("[data-widget-size-cycle]") || !window.notchAPI)
      return;
    const control =
      event.target.closest("[data-music-action]") || musicPlayToggle;
    if (!control) return;
    event.stopPropagation();
    control.disabled = true;
    const action = control.dataset.musicAction;
    let result;
    try {
      result = await window.notchAPI.controlMusic(action);
    } catch (error) {
      result = { ok: false };
    }
    control.disabled = false;
    if (!result || !result.ok) {
      const needsSession =
        result &&
        ["no_active_session", "soda_session_inactive"].includes(result.error);
      const needsPermission =
        result && result.error === "accessibility_permission_required";
      if (musicStatus)
        musicStatus.textContent =
          result && result.error === "not_installed"
            ? "Local app required"
            : needsPermission
              ? "Accessibility permission required"
              : needsSession
                ? "Press Play first"
                : "Controls unavailable";
      if (typeof showStatusToast === "function") {
        showStatusToast(
          result && result.error === "not_installed"
            ? "Soda Music not installed"
            : needsPermission
              ? "Allow Headspace Accessibility in System Settings"
              : needsSession
                ? "Press Play before using skip controls"
                : "Soda Music controls unavailable",
        );
      }
    } else {
      if (typeof result.playing === "boolean") musicPlaying = result.playing;
      else if (action === "play") musicPlaying = true;
      else if (action === "pause") musicPlaying = false;
      renderMusicPlaybackState();
      if (musicStatus)
        musicStatus.textContent =
          action === "next"
            ? "Next track"
            : action === "previous"
              ? "Previous track"
              : musicPlaying
                ? "Playing"
                : "Paused";
    }
    setTimeout(refreshMusicStatus, 500);
  });

  renderMusicPlaybackState();

  setInterval(() => refreshWindows(), 6000);

  Kit.parts.windows = { render: renderWindows, refresh: refreshWindows };
  Kit.parts.music = { refresh: refreshMusicStatus };
})();
