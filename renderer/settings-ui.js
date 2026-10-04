(function initSettingsUi() {
  const Kit = window.NotchWorkspaceKit;
  if (!Kit) return;
  const { Domain } = Kit;
  const recordings = Kit.parts.recordings;
  if (!recordings) return;
  const settingsTranscriptionStatus = document.getElementById('settings-transcription-status');
  const settingsLlmStatus = document.getElementById('settings-llm-status');
  const settingsFeatureList = document.getElementById('settings-feature-list');
  const settingsHomeModuleList = document.getElementById('settings-home-module-list');
  const settingsMirrorPreview = document.getElementById('settings-mirror-preview');
  const settingsMirrorChoose = document.getElementById('settings-mirror-choose');
  const settingsShortcutValue = document.getElementById('settings-shortcut-value');
  const settingsShortcutChange = document.getElementById('settings-shortcut-change');
  const settingsDefaultTab = document.getElementById('settings-default-tab');
  const settingsWorkspaceKind = document.getElementById('settings-workspace-kind');
  const settingsWorkspacePath = document.getElementById('settings-workspace-path');
  const settingsWorkspaceOpen = document.getElementById('settings-workspace-open');
  const settingsWorkspaceChoose = document.getElementById('settings-workspace-choose');
  const settingsAutoLaunch = document.getElementById('settings-auto-launch');
  const settingsInlineNote = document.getElementById('settings-inline-note');
  let settingsAppSettings = null;
  let settingsWorkspace = null;

  function setSettingsNote(message, error = false) {
    if (!settingsInlineNote) return;
    settingsInlineNote.textContent = message || '';
    settingsInlineNote.classList.toggle('error', error);
  }

  function applySettingsMirrorCover(dataUrl) {
    if (settingsMirrorPreview && typeof dataUrl === 'string' && dataUrl.startsWith('data:image/')) {
      settingsMirrorPreview.src = dataUrl;
    }
  }

  function renderSettingsPanel() {
    const summary = Domain.settingsSummary({
      appSettings: settingsAppSettings,
      workspace: settingsWorkspace,
      transcription: recordings.getTranscriptionConfig(),
    });
    if (settingsTranscriptionStatus) {
      settingsTranscriptionStatus.textContent = summary.transcription.label;
      settingsTranscriptionStatus.dataset.state = summary.transcription.state;
    }
    if (settingsLlmStatus) {
      settingsLlmStatus.textContent = summary.llm.label;
      settingsLlmStatus.dataset.state = summary.llm.state;
    }
    if (settingsShortcutValue) settingsShortcutValue.textContent = summary.shortcut;
    if (settingsDefaultTab) {
      const visibleTabs = new Set(Domain.visiblePanelTabs(
        ['home', 'todo', 'notes', 'links', 'recordings', 'credentials', 'clip', 'settings'],
        settingsAppSettings?.features
      ));
      Array.from(settingsDefaultTab.options).forEach((option) => {
        const visible = visibleTabs.has(option.value);
        option.hidden = !visible;
        option.disabled = !visible;
      });
      settingsDefaultTab.value = visibleTabs.has(summary.defaultTab) ? summary.defaultTab : 'home';
    }
    if (settingsWorkspaceKind) settingsWorkspaceKind.textContent = summary.workspaceLabel;
    if (settingsWorkspacePath) {
      settingsWorkspacePath.textContent = summary.workspacePath || 'Default data folder';
      settingsWorkspacePath.title = summary.workspacePath || '';
    }
    if (settingsAutoLaunch) settingsAutoLaunch.checked = summary.autoLaunch;
    settingsFeatureList?.querySelectorAll('input[data-settings-feature]').forEach((input) => {
      input.checked = settingsAppSettings?.features?.[input.dataset.settingsFeature] !== false;
    });
    renderHomeModuleSettings();
  }

  function renderHomeModuleSettings() {
    const state = window.NotchHome?.getVisibility?.();
    const hidden = new Set(state?.hiddenIds || []);
    const recordingActive = window.NotchWorkspace?.isRecordingActive?.() ?? recordings.isRecordingActive();
    settingsHomeModuleList?.querySelectorAll('input[data-settings-home-module]').forEach((input) => {
      const moduleId = input.dataset.settingsHomeModule;
      const unavailable = state?.unavailableIds?.includes(moduleId) === true;
      input.closest('label').hidden = unavailable;
      input.checked = !hidden.has(moduleId);
      input.disabled = unavailable || state?.readOnly === true
        || (moduleId === 'recorder' && recordingActive && input.checked);
    });
    const recorderNote = settingsHomeModuleList?.querySelector('[data-home-module-setting-note="recorder"]');
    if (recorderNote) recorderNote.textContent = recordingActive ? 'Recording in progress' : 'Recording and transcription';
    const status = document.getElementById('settings-home-module-status');
    if (status) {
      status.textContent = state?.readOnly
        ? 'Safe mode · locked for now'
        : state?.persisted === false
          ? 'This session only · not saved'
          : 'Auto-fill when hidden · keep at least one';
      status.dataset.state = state?.readOnly || state?.persisted === false ? 'warning' : 'saved';
    }
  }

  async function refreshSettingsPanel() {
    if (!window.notchAPI) return;
    const [appSettings, workspace, config, mirrorImage] = await Promise.all([
      window.notchAPI.getAppSettings?.().catch(() => null),
      window.notchAPI.getWorkspace?.().catch(() => null),
      window.notchAPI.getTranscriptionConfig?.().catch(() => null),
      window.notchAPI.getMirrorImage?.().catch(() => null),
    ]);
    if (appSettings) settingsAppSettings = appSettings;
    if (workspace) settingsWorkspace = workspace;
    if (config) {
      recordings.applyTranscriptionConfig(config);
    }
    applySettingsMirrorCover(mirrorImage);
    renderSettingsPanel();
  }

  settingsFeatureList?.addEventListener('change', async (event) => {
    const input = event.target.closest('input[data-settings-feature]');
    if (!input || !window.notchAPI?.setFeature) return;
    input.disabled = true;
    const result = await window.notchAPI.setFeature(input.dataset.settingsFeature, input.checked)
      .catch(() => ({ ok: false }));
    input.disabled = false;
    if (!result?.ok) {
      input.checked = !input.checked;
      setSettingsNote('Couldn’t save feature visibility — try again.', true);
      return;
    }
    settingsAppSettings = result.settings || settingsAppSettings;
    renderSettingsPanel();
    setSettingsNote('Visible features updated.');
  });
  settingsHomeModuleList?.addEventListener('change', async (event) => {
    const input = event.target.closest('input[data-settings-home-module]');
    if (!input || !window.NotchHome?.setModuleVisible) return;
    input.disabled = true;
    const result = await window.NotchHome.setModuleVisible(
      input.dataset.settingsHomeModule,
      input.checked
    );
    renderHomeModuleSettings();
    if (!result?.ok) {
      const message = result?.error === 'at_least_one_required'
        ? 'Keep at least one Home widget'
        : result?.error === 'recording_active'
          ? 'Can’t hide Quick record while recording'
          : result?.error === 'layout_read_only'
            ? 'Home layout is in safe mode — widgets locked this session'
            : result?.error === 'layout_invalid'
              ? 'New layout failed validation — previous layout kept'
              : result?.error === 'dom_apply_failed'
                ? 'Couldn’t apply layout — previous layout restored'
                : 'Home widget settings not updated';
      if (typeof showStatusToast === 'function') showStatusToast(message);
      return;
    }
    if (result.changed === false) return;
    const message = result.persisted === false
      ? 'Layout updated for this session only — settings not saved'
      : input.checked ? 'Home widget restored' : 'Home widget hidden';
    if (typeof showStatusToast === 'function') showStatusToast(message);
  });
  settingsMirrorChoose?.addEventListener('click', async () => {
    if (!window.notchAPI?.chooseMirrorImage) return;
    settingsMirrorChoose.disabled = true;
    const result = await window.notchAPI.chooseMirrorImage().catch(() => ({ ok: false }));
    settingsMirrorChoose.disabled = false;
    if (result?.canceled) return;
    if (!result?.ok) {
      setSettingsNote('Couldn’t replace mirror image.', true);
      return;
    }
    applySettingsMirrorCover(result.dataUrl);
    setSettingsNote('Home mirror image updated.');
  });
  settingsShortcutChange?.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('notch:record-shortcut'));
  });
  settingsDefaultTab?.addEventListener('change', async () => {
    if (!window.notchAPI?.setDefaultTab) return;
    const previous = settingsAppSettings?.defaultTab || 'home';
    settingsDefaultTab.disabled = true;
    const result = await window.notchAPI.setDefaultTab(settingsDefaultTab.value).catch(() => ({ ok: false }));
    settingsDefaultTab.disabled = false;
    if (!result?.ok) {
      settingsDefaultTab.value = previous;
      setSettingsNote('Couldn’t save default tab — try again.', true);
      return;
    }
    settingsAppSettings = result.settings || settingsAppSettings;
    renderSettingsPanel();
    setSettingsNote(`Next open will show ${settingsDefaultTab.selectedOptions[0]?.textContent || 'the selected tab'}.`);
  });
  settingsWorkspaceOpen?.addEventListener('click', () => {
    window.notchAPI?.openWorkspace?.().catch(() => setSettingsNote('Couldn’t open data folder.', true));
  });
  settingsWorkspaceChoose?.addEventListener('click', async () => {
    const changed = await window.notchAPI?.chooseWorkspace?.().catch(() => false);
    if (!changed) return;
    settingsWorkspace = await window.notchAPI?.getWorkspace?.().catch(() => settingsWorkspace);
    renderSettingsPanel();
    setSettingsNote('Data folder updated.');
  });
  settingsAutoLaunch?.addEventListener('change', async () => {
    if (!window.notchAPI?.setAutoLaunch) return;
    settingsAutoLaunch.disabled = true;
    const result = await window.notchAPI.setAutoLaunch(settingsAutoLaunch.checked).catch(() => ({ ok: false }));
    settingsAutoLaunch.disabled = false;
    if (!result?.ok) {
      settingsAutoLaunch.checked = !settingsAutoLaunch.checked;
      setSettingsNote('Couldn’t change launch-at-login.', true);
      return;
    }
    settingsAutoLaunch.checked = result.autoLaunch === true;
    if (settingsAppSettings) settingsAppSettings.autoLaunch = result.autoLaunch === true;
    setSettingsNote(result.autoLaunch ? 'Launch at login enabled.' : 'Launch at login disabled.');
  });
  window.notchAPI?.onAppSettingsChanged?.((settings) => {
    settingsAppSettings = settings;
    renderSettingsPanel();
  });
  window.notchAPI?.onWorkspaceChanged?.(() => refreshSettingsPanel());
  window.notchAPI?.onMirrorImageChanged?.(applySettingsMirrorCover);

  document.addEventListener('notch:tabchange', (event) => {
    if (event.detail?.tab === 'settings') refreshSettingsPanel();
  });
  document.addEventListener('notch:home-modules-changed', renderHomeModuleSettings);
  document.addEventListener('notch:recording-state-changed', renderHomeModuleSettings);

  Kit.parts.settings = {
    render: renderSettingsPanel,
    renderHomeModules: renderHomeModuleSettings,
    refresh: refreshSettingsPanel,
  };
})();
