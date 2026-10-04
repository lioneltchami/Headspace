(function initLinksUi() {
  const Kit = window.NotchWorkspaceKit;
  if (!Kit) return;
  const {
    Domain,
    uid,
    loadJson,
    saveJson,
    createIconButton,
    icons: { ADD_ICON, DELETE_ICON, EDIT_ICON, OPEN_ICON },
  } = Kit;
  const LINKS_KEY = "notch-link-groups";
  // ============ Link bookmarks ============
  const linkInput = document.getElementById("link-add");
  const linkBulkDelete = document.getElementById("link-bulk-delete");
  const linkGroupsEl = document.getElementById("link-groups");
  const linksStatus = document.getElementById("links-status");
  let linkGroups = loadJson(LINKS_KEY, []);
  if (!Array.isArray(linkGroups)) linkGroups = [];
  let linkSelection = new Set();
  let linkSelectionAnchor = null;
  let addingLinkGroupId = "";

  function persistLinks() {
    saveJson(LINKS_KEY, linkGroups);
  }

  function setLinksStatus(message, tone = "") {
    if (linksStatus) {
      linksStatus.textContent = "";
      linksStatus.dataset.tone = tone;
    }
    if (message && typeof showStatusToast === "function")
      showStatusToast(message);
  }

  function allLinks() {
    return linkGroups.flatMap((group) =>
      Array.isArray(group.links) ? group.links : [],
    );
  }

  function updateLinkBulkAction() {
    if (!linkBulkDelete) return;
    linkBulkDelete.hidden = linkSelection.size === 0;
    linkBulkDelete.textContent = "Delete";
    linkBulkDelete.setAttribute(
      "aria-label",
      linkSelection.size
        ? `Delete ${linkSelection.size} items`
        : "Delete selected",
    );
  }

  function linkHostname(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch (error) {
      return url;
    }
  }

  function renderLinkGroups() {
    if (!linkGroupsEl) return;
    linkGroupsEl.replaceChildren();
    updateLinkBulkAction();
    if (!linkGroups.length) {
      const empty = document.createElement("div");
      empty.className = "links-empty";
      empty.innerHTML =
        "<strong>No links yet</strong><span>Paste a URL — Headspace fetches the title and picks a group.</span>";
      linkGroupsEl.appendChild(empty);
      return;
    }

    linkGroups.forEach((group) => {
      const section = document.createElement("section");
      section.className = `link-group${group.collapsed ? " collapsed" : ""}`;
      section.dataset.groupId = group.id;

      const header = document.createElement("header");
      header.className = "link-group-head";
      const toggle = document.createElement("button");
      toggle.className = "group-toggle";
      toggle.type = "button";
      toggle.dataset.action = "toggle-group";
      toggle.setAttribute(
        "aria-label",
        group.collapsed ? "Expand group" : "Collapse group",
      );
      toggle.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m8 10 4 4 4-4"/></svg>';
      const name = document.createElement("input");
      name.className = "group-name-input";
      name.value = String(group.name || "Untitled group");
      name.dataset.action = "rename-group";
      name.setAttribute("aria-label", "Group name");
      const count = document.createElement("span");
      count.className = "group-count";
      count.textContent = `${Array.isArray(group.links) ? group.links.length : 0}`;
      header.append(toggle, name, count);
      header.appendChild(
        createIconButton(
          "add-link-to-group",
          `Add link in “${group.name || "this group"}”`,
          ADD_ICON,
        ),
      );
      header.appendChild(
        createIconButton(
          "delete-group",
          "Delete group and all its links",
          DELETE_ICON,
          true,
        ),
      );

      const body = document.createElement("div");
      body.className = "link-group-body";
      if (addingLinkGroupId === group.id) {
        const addRow = document.createElement("div");
        addRow.className = "group-link-add";
        addRow.innerHTML = `<input data-group-link-input type="text" placeholder="Paste a URL and press Enter to add to this group" aria-label="Add link to ${String(group.name || "this group").replace(/[<>"&]/g, "")}" autocomplete="off" spellcheck="false"><button type="button" data-action="cancel-group-link-add" aria-label="Cancel">×</button>`;
        body.appendChild(addRow);
      }
      const list = document.createElement("div");
      list.className = "link-list";
      (group.links || []).forEach((link) => {
        const row = document.createElement("article");
        row.className = `link-item${linkSelection.has(link.id) ? " multi-selected" : ""}`;
        row.dataset.linkId = link.id;
        row.dataset.groupId = group.id;
        const mark = document.createElement("span");
        mark.className = "link-favicon";
        if (link.icon && String(link.icon).startsWith("data:image/")) {
          const image = document.createElement("img");
          image.src = link.icon;
          image.alt = "";
          mark.appendChild(image);
        } else {
          mark.textContent = (
            linkHostname(link.url).charAt(0) || "·"
          ).toUpperCase();
        }
        const open = document.createElement("button");
        open.className = "link-open";
        open.type = "button";
        open.dataset.action = "open-link";
        const title = document.createElement("strong");
        title.textContent = link.title || linkHostname(link.url);
        const domain = document.createElement("span");
        domain.textContent = linkHostname(link.url);
        open.append(title, domain);
        const actions = document.createElement("div");
        actions.className = "link-actions";
        actions.append(
          createIconButton("open-link", "Open link", OPEN_ICON),
          createIconButton("edit-link", "Rename", EDIT_ICON),
          createIconButton("delete-link", "Delete link", DELETE_ICON, true),
        );
        row.append(mark, open, actions);
        list.appendChild(row);
      });

      body.append(list);
      section.append(header, body);
      linkGroupsEl.appendChild(section);
    });
  }

  function addLink(rawValue, requestedGroupId = "") {
    const normalized = Domain.normalizeHttpUrl(rawValue);
    if (!normalized) {
      setLinksStatus("Enter a valid public URL", "error");
      return false;
    }
    if (allLinks().some((link) => link.url === normalized)) {
      setLinksStatus("That link is already saved", "error");
      return false;
    }
    const link = {
      id: uid("link"),
      url: normalized,
      title: "Untitled",
      icon: "",
      createdAt: Date.now(),
    };
    const preferredGroupId =
      requestedGroupId || Domain.preferredLinkGroupId(linkGroups, normalized);
    const preferredGroup = linkGroups.find(
      (group) => group.id === preferredGroupId,
    );
    if (preferredGroup) {
      linkGroups = linkGroups.map((group) =>
        group.id === preferredGroup.id
          ? {
              ...group,
              collapsed: false,
              links: [...(group.links || []), link],
            }
          : group,
      );
    } else {
      linkGroups = Domain.addLinkToGroups(
        linkGroups,
        link,
        Domain.classifyLink(normalized, ""),
      );
    }
    persistLinks();
    renderLinkGroups();
    setLinksStatus("Link saved");

    // Save动作不等待网络或LModel。Heading、Img标和分组在后台静默补全。
    Promise.resolve(window.notchAPI?.inspectLink?.(normalized))
      .then((inspected) => {
        if (!inspected?.ok) return;
        let sourceGroup = null;
        let savedLink = null;
        linkGroups.some((group) => {
          const found = (group.links || []).find((item) => item.id === link.id);
          if (!found) return false;
          sourceGroup = group;
          savedLink = found;
          return true;
        });
        if (!savedLink || !sourceGroup) return;
        savedLink.url = inspected.url || savedLink.url;
        savedLink.title = inspected.title || savedLink.title || "Untitled";
        savedLink.icon = inspected.icon || savedLink.icon || "";
        // 手动定向或同站点复用后锁定分组；自动分类只使用可预测的本地规则，
        // 避免Model自由命名生成多个近义分组。
        const lockedGroupId =
          preferredGroup?.id ||
          Domain.preferredLinkGroupId(
            linkGroups.map((group) => ({
              ...group,
              links: (group.links || []).filter(
                (item) => item.id !== savedLink.id,
              ),
            })),
            savedLink.url,
          );
        const nextCategory = Domain.classifyLink(
          savedLink.url,
          savedLink.title,
        );
        if (
          !lockedGroupId &&
          nextCategory &&
          nextCategory !== sourceGroup.name
        ) {
          const target = linkGroups.find(
            (group) => group.name === nextCategory,
          );
          if (target) {
            linkGroups = Domain.moveLinkToGroup(
              linkGroups,
              savedLink.id,
              target.id,
            );
          } else {
            sourceGroup.links = sourceGroup.links.filter(
              (item) => item.id !== savedLink.id,
            );
            linkGroups = Domain.addLinkToGroups(
              linkGroups,
              savedLink,
              nextCategory,
            );
          }
        }
        persistLinks();
        renderLinkGroups();
      })
      .catch(() => {});
    return true;
  }

  if (linkInput) {
    linkInput.addEventListener("keydown", (event) => {
      if (
        event.key !== "Enter" ||
        event.isComposing ||
        event.keyCode === 229 ||
        event.repeat
      )
        return;
      event.preventDefault();
      const value = linkInput.value;
      if (addLink(value)) linkInput.value = "";
      linkInput.focus();
    });
  }

  function findLink(group, linkId) {
    return group && (group.links || []).find((link) => link.id === linkId);
  }

  if (linkGroupsEl) {
    linkGroupsEl.addEventListener("change", (event) => {
      const groupSection = event.target.closest("[data-group-id]");
      if (!groupSection) return;
      if (event.target.matches(".group-name-input")) {
        linkGroups = Domain.renameGroup(
          linkGroups,
          groupSection.dataset.groupId,
          event.target.value,
        );
        persistLinks();
        renderLinkGroups();
      }
      if (event.target.matches(".link-title-edit")) {
        const row = event.target.closest("[data-link-id]");
        const group = linkGroups.find(
          (item) => item.id === groupSection.dataset.groupId,
        );
        const link = findLink(group, row && row.dataset.linkId);
        const value = event.target.value.trim();
        if (link && value) link.title = value;
        persistLinks();
        renderLinkGroups();
      }
    });

    linkGroupsEl.addEventListener("keydown", async (event) => {
      const groupSection = event.target.closest("[data-group-id]");
      if (!groupSection) return;
      if (event.target.matches("[data-group-link-input]")) {
        if (event.key === "Escape") {
          addingLinkGroupId = "";
          renderLinkGroups();
        } else if (
          event.key === "Enter" &&
          !event.isComposing &&
          !event.repeat
        ) {
          event.preventDefault();
          if (addLink(event.target.value, groupSection.dataset.groupId)) {
            addingLinkGroupId = "";
            renderLinkGroups();
          }
        }
        return;
      }
      if (event.target.matches(".group-name-input") && event.key === "Enter") {
        event.preventDefault();
        event.target.blur();
      }
      if (event.target.matches(".link-title-edit") && event.key === "Enter") {
        event.preventDefault();
        event.target.blur();
      }
    });

    linkGroupsEl.addEventListener("click", (event) => {
      const action = event.target.closest("[data-action]");
      const groupSection = event.target.closest("[data-group-id]");
      if (!groupSection) return;
      const groupId = groupSection.dataset.groupId;
      const group = linkGroups.find((item) => item.id === groupId);
      const row = event.target.closest("[data-link-id]");
      const link = findLink(group, row && row.dataset.linkId);
      if (event.shiftKey && link) {
        event.preventDefault();
        const result = Domain.updateRangeSelection(
          allLinks().map((item) => item.id),
          [...linkSelection],
          link.id,
          linkSelectionAnchor,
          true,
        );
        linkSelection = new Set(result.selected);
        linkSelectionAnchor = result.anchor;
        renderLinkGroups();
        return;
      }
      if (link) linkSelectionAnchor = link.id;
      if (!action) return;
      if (action.dataset.action === "add-link-to-group") {
        addingLinkGroupId = groupId;
        group.collapsed = false;
        persistLinks();
        renderLinkGroups();
        requestAnimationFrame(() =>
          linkGroupsEl
            .querySelector(
              `[data-group-id="${CSS.escape(groupId)}"] [data-group-link-input]`,
            )
            ?.focus(),
        );
      }
      if (action.dataset.action === "cancel-group-link-add") {
        addingLinkGroupId = "";
        renderLinkGroups();
      }
      if (action.dataset.action === "toggle-group") {
        group.collapsed = !group.collapsed;
        persistLinks();
        renderLinkGroups();
      }
      if (action.dataset.action === "delete-group") {
        (group.links || []).forEach((item) => linkSelection.delete(item.id));
        linkGroups = linkGroups.filter((item) => item.id !== groupId);
        persistLinks();
        renderLinkGroups();
      }
      if (action.dataset.action === "open-link" && link && window.notchAPI) {
        window.notchAPI.openExternal(link.url);
      }
      if (action.dataset.action === "delete-link" && link) {
        group.links = group.links.filter((item) => item.id !== link.id);
        linkSelection.delete(link.id);
        persistLinks();
        renderLinkGroups();
      }
      if (action.dataset.action === "edit-link" && link && row) {
        const openButton = row.querySelector(".link-open");
        const input = document.createElement("input");
        input.className = "link-title-edit";
        input.value = link.title;
        openButton.replaceWith(input);
        input.focus();
        input.select();
      }
    });

    // ============ Links长按拖拽：组内排序 + 跨组搬运 ============
    // 不用 HTML5 拖拽有两个原因：一是行M间那一L块是 <button class="link-open">，
    // Chromium 里从 button 上按下不会触发祖先的 dragstart，Heading区域整块拖不动；
    // 二是原生拖拽一按就走，没法和「点击Open link」区分。改成指针事件 + 长按门槛。
    const LINK_DRAG_HOLD_MS = 340;
    const LINK_DRAG_MOVE_CANCEL = 8;
    let linkDrag = null;
    let suppressLinkClick = false;

    function clearLinkDropMarks() {
      linkGroupsEl
        .querySelectorAll(".drop-before, .drop-after, .drop-target")
        .forEach((item) => {
          item.classList.remove("drop-before", "drop-after", "drop-target");
        });
    }

    function cancelLinkDrag() {
      if (!linkDrag) return;
      clearTimeout(linkDrag.holdTimer);
      if (linkDrag.active) {
        linkDrag.row.classList.remove("dragging");
        linkGroupsEl.classList.remove("link-dragging");
        clearLinkDropMarks();
      }
      try {
        linkDrag.row.releasePointerCapture(linkDrag.pointerId);
      } catch (error) {}
      linkDrag = null;
    }

    // 落点有两种：压在某一行上就按该行M线决定插到它前面还是后面；
    // 压在分组的空白或Heading上就追加到该组末尾（index 为 null）。
    function updateLinkDropTarget(clientX, clientY) {
      clearLinkDropMarks();
      linkDrag.target = null;
      const under = document.elementFromPoint(clientX, clientY);
      if (!under || !linkGroupsEl.contains(under)) return;
      const overRow = under.closest(".link-item[data-link-id]");
      // 压在被拖那一行自己身上 = 放回原处，目标留空，松手什么都不做。
      // 少了这一步，长按后原地松手会落到「自己所在的分组」上，被当成追加到组末尾。
      if (overRow === linkDrag.row) return;
      if (overRow) {
        const rect = overRow.getBoundingClientRect();
        const after = clientY > rect.top + rect.height / 2;
        overRow.classList.add(after ? "drop-after" : "drop-before");
        const rows = Array.from(overRow.parentElement.children).filter(
          (item) => item.dataset && item.dataset.linkId,
        );
        linkDrag.target = {
          groupId: overRow.dataset.groupId,
          index: rows.indexOf(overRow) + (after ? 1 : 0),
        };
        return;
      }
      const overGroup = under.closest(".link-group[data-group-id]");
      if (!overGroup) return;
      overGroup.classList.add("drop-target");
      linkDrag.target = { groupId: overGroup.dataset.groupId, index: null };
    }

    function linkOrderFingerprint() {
      return linkGroups
        .map(
          (group) =>
            `${group.id}:${(group.links || []).map((link) => link.id).join(",")}`,
        )
        .join("|");
    }

    linkGroupsEl.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      const row = event.target.closest(".link-item[data-link-id]");
      // Edit / Delete按钮和Heading输入框保持原有点击语义，不参与拖拽。
      if (!row || event.target.closest("input, .link-actions")) return;
      // 上一次拖拽后若没有等到那个补发的 click（比如在列表外松手），标志会留着，
      // 否则它会把下一次正常点击吞掉，Links就打不开了。
      suppressLinkClick = false;
      cancelLinkDrag();
      linkDrag = {
        row,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        active: false,
        target: null,
        holdTimer: setTimeout(() => {
          if (!linkDrag) return;
          linkDrag.active = true;
          row.classList.add("dragging");
          linkGroupsEl.classList.add("link-dragging");
          try {
            row.setPointerCapture(linkDrag.pointerId);
          } catch (error) {}
          updateLinkDropTarget(linkDrag.startX, linkDrag.startY);
          setLinksStatus("Drop on the target position");
        }, LINK_DRAG_HOLD_MS),
      };
    });

    // 这三个挂在 document 上（与窗口拖拽同一套写法）：长按还没满就快速划出列表时，
    // 挂在 linkGroupsEl 上收不到 move / up，计时器随后仍会启动一次拖拽。
    document.addEventListener("pointermove", (event) => {
      if (!linkDrag || event.pointerId !== linkDrag.pointerId) return;
      if (!linkDrag.active) {
        // 长按还没满就移动，说明用户在滚动或只是手抖，放弃这次拖拽。
        const moved =
          Math.abs(event.clientX - linkDrag.startX) > LINK_DRAG_MOVE_CANCEL ||
          Math.abs(event.clientY - linkDrag.startY) > LINK_DRAG_MOVE_CANCEL;
        if (moved) cancelLinkDrag();
        return;
      }
      event.preventDefault();
      updateLinkDropTarget(event.clientX, event.clientY);
    });

    document.addEventListener("pointerup", (event) => {
      if (!linkDrag || event.pointerId !== linkDrag.pointerId) return;
      const wasActive = linkDrag.active;
      const target = linkDrag.target;
      const linkId = linkDrag.row.dataset.linkId;
      cancelLinkDrag();
      if (!wasActive) return;
      // 拖拽结束后浏览器仍会补一个 click，必须拦掉，否则松手即Open link。
      suppressLinkClick = true;
      if (!target) {
        setLinksStatus("");
        return;
      }
      const before = linkOrderFingerprint();
      linkGroups = Domain.moveLinkToPosition(
        linkGroups,
        linkId,
        target.groupId,
        target.index,
      );
      if (linkOrderFingerprint() === before) {
        setLinksStatus("");
        return;
      }
      persistLinks();
      renderLinkGroups();
      setLinksStatus("Link order updated");
    });

    document.addEventListener("pointercancel", () => cancelLinkDrag());

    linkGroupsEl.addEventListener(
      "click",
      (event) => {
        if (!suppressLinkClick) return;
        suppressLinkClick = false;
        event.stopPropagation();
        event.preventDefault();
      },
      true,
    );
  }

  linkBulkDelete?.addEventListener("click", () => {
    if (!linkSelection.size) return;
    linkGroups = linkGroups.map((group) => ({
      ...group,
      links: (group.links || []).filter((link) => !linkSelection.has(link.id)),
    }));
    linkSelection.clear();
    linkSelectionAnchor = null;
    persistLinks();
    renderLinkGroups();
    setLinksStatus("Selected links deleted");
  });

  document.addEventListener("notch:clear-selection", () => {
    linkSelection.clear();
    linkSelectionAnchor = null;
    renderLinkGroups();
  });

  Kit.parts.links = { render: renderLinkGroups };
})();
