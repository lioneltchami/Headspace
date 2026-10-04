(function initWorkspace() {
  const parts = window.NotchWorkspaceKit?.parts;
  const { commands, links, recordings, settings, windows, music, credentials } =
    parts || {};
  if (
    !commands ||
    !links ||
    !recordings ||
    !settings ||
    !windows ||
    !music ||
    !credentials
  )
    return;

  commands.render();
  links.render();
  recordings.renderRecordings();
  windows.render();
  recordings.updateRecordingUi();
  recordings.loadTranscriptionConfig();
  settings.refresh();
  music.refresh();
  credentials.load();

  window.NotchWorkspace = {
    refreshWindows: windows.refresh,
    startRecording: recordings.startRecording,
    isRecordingActive: recordings.isRecordingBusy,
  };
})();
