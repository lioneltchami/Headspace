(function initRecordingsUi() {
  const Kit = window.NotchWorkspaceKit;
  if (!Kit) return;
  const { Domain, uid, loadJson, saveJson, formatClock, formatShortDate, createIconButton, icons: { COPY_ICON, DELETE_ICON, OPEN_ICON } } = Kit;
  const RECORDINGS_KEY = 'notch-recordings';
  // ============ Recording and transcription ============
  const homeRecorder = document.getElementById('home-recorder');
  const recordingDot = document.getElementById('home-recording-dot');
  const recordingStateLabel = document.getElementById('home-recording-state');
  const recordingTime = document.getElementById('home-recording-time');
  const recordingStrands = document.getElementById('recording-strands');
  const liveTranscript = document.getElementById('home-live-transcript');
  const recordStart = document.getElementById('record-start');
  const recordPause = document.getElementById('record-pause');
  const recordStop = document.getElementById('record-stop');
  const recordingNew = document.getElementById('recording-new');
  const recordingConfigure = document.getElementById('recording-configure');
  const recordingList = document.getElementById('recording-list');
  const recordingDetail = document.getElementById('recording-detail');
  const recordingCount = document.getElementById('recording-count');
  const recordingBulkDelete = document.getElementById('recording-bulk-delete');
  const transcriptionSettingsBackdrop = document.getElementById('transcription-settings-backdrop');
  const transcriptionSettingsClose = document.getElementById('transcription-settings-close');
  const transcriptionSettingsCancel = document.getElementById('transcription-settings-cancel');
  const transcriptionSettingsSave = document.getElementById('transcription-settings-save');
  const transcriptionApiKey = document.getElementById('transcription-api-key');
  const transcriptionApiStatus = document.getElementById('transcription-api-status');
  const transcriptionApiHelp = document.getElementById('transcription-api-help');
  const transcriptionRegion = document.getElementById('transcription-region');
  const transcriptionWorkspace = document.getElementById('transcription-workspace');
  const llmApiKey = document.getElementById('llm-api-key');
  const llmApiStatus = document.getElementById('llm-api-status');
  const llmApiHelp = document.getElementById('llm-api-help');
  const llmBaseUrl = document.getElementById('llm-base-url');
  const llmModel = document.getElementById('llm-model');
  const transcriptionSettingsNote = document.getElementById('transcription-settings-note');
  const settingsApiConfigure = document.getElementById('settings-api-configure');
  let recordings = loadJson(RECORDINGS_KEY, []).map(Domain.createRecording).filter(Boolean);
  let selectedRecordingId = recordings[0] && recordings[0].id;
  let recordingSelection = new Set();
  let recordingSelectionAnchor = selectedRecordingId || null;
  let mediaStream = null;
  let mediaRecorder = null;
  let audioChunks = [];
  let speechRecognition = null;
  let speechRecognitionBlocked = false;
  let speechRecognitionError = '';
  let recordingStatus = 'idle';
  let recordingStartedAt = 0;
  let pausedAt = 0;
  let pausedTotalMs = 0;
  let recordingTranscript = '';
  let interimTranscript = '';
  let recordingTimer = null;
  let recordingStopDurationMs = 0;
  let recordingCaptureIssue = '';
  let recordingDraftId = '';
  let currentAudioUrl = '';
  let transcriptionConfig = {
    configured: false,
    asrNeedsReentry: false,
    region: 'beijing',
    workspaceId: '',
    llmConfigured: false,
    llmNeedsReentry: false,
    llmBaseUrl: 'https://api.deepseek.com',
    llmModel: 'deepseek-v4-flash',
  };
  let transcriptionStatus = 'idle';
  let transcriptionAudioGap = false;
  let transcriptionStartPromise = null;
  let transcriptionAudioContext = null;
  let transcriptionAudioSource = null;
  let transcriptionAudioProcessor = null;
  let transcriptionAudioMute = null;
  let transcriptionFinishPromise = null;
  let strandsAudioContext = null;
  let strandsAudioSource = null;
  let strandsAnalyser = null;
  let strandsFrame = null;
  let strandsSamples = null;
  let strandsLevel = 0;
  const recordingStartTask = Domain.createExclusiveAsyncTask(() => updateRecordingUi());

  function isRecordingActive() {
    return ['recording', 'paused', 'saving'].includes(recordingStatus);
  }

  function isRecordingBusy() {
    return recordingStartTask.isPending() || isRecordingActive();
  }

  function stopRecordingStrands() {
    if (strandsFrame) cancelAnimationFrame(strandsFrame);
    strandsFrame = null;
    try { strandsAudioSource?.disconnect(); } catch (error) {}
    if (strandsAudioContext) strandsAudioContext.close().catch(() => {});
    strandsAudioContext = null;
    strandsAudioSource = null;
    strandsAnalyser = null;
    strandsSamples = null;
    strandsLevel = 0;
    const context = recordingStrands?.getContext('2d');
    context?.clearRect(0, 0, recordingStrands.width, recordingStrands.height);
  }

  function drawRecordingStrands(now) {
    if (!recordingStrands || !strandsAnalyser || !strandsSamples) {
      strandsFrame = null;
      return;
    }
    const bounds = recordingStrands.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(bounds.width * dpr));
    const height = Math.max(1, Math.round(bounds.height * dpr));
    if (recordingStrands.width !== width || recordingStrands.height !== height) {
      recordingStrands.width = width;
      recordingStrands.height = height;
    }
    strandsAnalyser.getFloatTimeDomainData(strandsSamples);
    const measured = recordingStatus === 'recording' ? Domain.calculateAudioLevel(strandsSamples) : 0;
    strandsLevel += (measured - strandsLevel) * (measured > strandsLevel ? 0.34 : 0.08);
    const context = recordingStrands.getContext('2d');
    context.clearRect(0, 0, width, height);
    context.save();
    context.scale(dpr, dpr);
    context.globalCompositeOperation = 'lighter';
    const cssWidth = bounds.width;
    const cssHeight = bounds.height;
    const activeLevel = Math.min(1, strandsLevel * 6);
    const centerY = cssHeight * 0.55;
    const phase = now * 0.00115;
    const colors = [
      ['rgba(82, 224, 255, 0)', `rgba(82, 224, 255, ${0.2 + activeLevel * 0.44})`, 'rgba(82, 224, 255, 0)'],
      ['rgba(111, 128, 255, 0)', `rgba(111, 128, 255, ${0.22 + activeLevel * 0.5})`, 'rgba(111, 128, 255, 0)'],
      ['rgba(209, 96, 255, 0)', `rgba(209, 96, 255, ${0.19 + activeLevel * 0.46})`, 'rgba(209, 96, 255, 0)'],
      ['rgba(255, 102, 184, 0)', `rgba(255, 102, 184, ${0.17 + activeLevel * 0.4})`, 'rgba(255, 102, 184, 0)'],
      ['rgba(255, 210, 91, 0)', `rgba(255, 210, 91, ${0.14 + activeLevel * 0.34})`, 'rgba(255, 210, 91, 0)'],
    ];
    context.filter = `blur(${8 + activeLevel * 10}px)`;
    colors.forEach((palette, layer) => {
      const gradient = context.createLinearGradient(cssWidth * 0.08, 0, cssWidth * 0.92, 0);
      gradient.addColorStop(0, palette[0]);
      gradient.addColorStop(0.36 + layer * 0.025, palette[1]);
      gradient.addColorStop(0.72 - layer * 0.02, palette[1]);
      gradient.addColorStop(1, palette[2]);
      const heightScale = cssHeight * (0.06 + layer * 0.012 + activeLevel * (0.18 + layer * 0.014));
      const drift = Math.sin(phase + layer * 0.92) * cssHeight * 0.025;
      context.beginPath();
      context.moveTo(cssWidth * 0.04, centerY);
      for (let x = cssWidth * 0.04; x <= cssWidth * 0.96; x += 5) {
        const progress = (x - cssWidth * 0.04) / (cssWidth * 0.92);
        const envelope = Math.sin(Math.PI * progress) ** (1.45 + layer * 0.08);
        const ripple = Math.sin(progress * Math.PI * (2.2 + layer * 0.18) + phase + layer) * heightScale * 0.16;
        context.lineTo(x, centerY - envelope * heightScale - ripple + drift);
      }
      for (let x = cssWidth * 0.96; x >= cssWidth * 0.04; x -= 5) {
        const progress = (x - cssWidth * 0.04) / (cssWidth * 0.92);
        const envelope = Math.sin(Math.PI * progress) ** (1.45 + layer * 0.08);
        const ripple = Math.cos(progress * Math.PI * (2 + layer * 0.14) - phase - layer) * heightScale * 0.14;
        context.lineTo(x, centerY + envelope * heightScale + ripple + drift);
      }
      context.closePath();
      context.fillStyle = gradient;
      context.globalAlpha = 0.58 - layer * 0.055;
      context.fill();
    });
    context.filter = 'blur(2px)';
    const core = context.createLinearGradient(cssWidth * 0.16, 0, cssWidth * 0.84, 0);
    core.addColorStop(0, 'rgba(66, 191, 255, 0)');
    core.addColorStop(0.34, `rgba(172, 238, 255, ${0.3 + activeLevel * 0.55})`);
    core.addColorStop(0.58, `rgba(255, 209, 255, ${0.38 + activeLevel * 0.58})`);
    core.addColorStop(0.78, `rgba(255, 213, 117, ${0.24 + activeLevel * 0.5})`);
    core.addColorStop(1, 'rgba(255, 130, 196, 0)');
    context.globalAlpha = 1;
    context.fillStyle = core;
    context.fillRect(cssWidth * 0.08, centerY - 1.3 - activeLevel, cssWidth * 0.84, 2.6 + activeLevel * 2);
    context.restore();
    homeRecorder?.style.setProperty('--recording-level', strandsLevel.toFixed(3));
    strandsFrame = requestAnimationFrame(drawRecordingStrands);
  }

  function startRecordingStrands(stream) {
    stopRecordingStrands();
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext || !stream || !recordingStrands) return;
    try {
      strandsAudioContext = new AudioContext();
      strandsAudioSource = strandsAudioContext.createMediaStreamSource(stream);
      strandsAnalyser = strandsAudioContext.createAnalyser();
      strandsAnalyser.fftSize = 512;
      strandsAnalyser.smoothingTimeConstant = 0.72;
      strandsSamples = new Float32Array(strandsAnalyser.fftSize);
      strandsAudioSource.connect(strandsAnalyser);
      strandsFrame = requestAnimationFrame(drawRecordingStrands);
    } catch (error) {
      stopRecordingStrands();
    }
  }

  function updateTranscriptionConfigUi() {
    const statuses = Domain.apiCredentialStatuses(transcriptionConfig);
    if (transcriptionApiStatus) {
      transcriptionApiStatus.textContent = statuses.transcription.label;
      transcriptionApiStatus.dataset.state = statuses.transcription.state;
    }
    if (llmApiStatus) {
      llmApiStatus.textContent = statuses.llm.label;
      llmApiStatus.dataset.state = statuses.llm.state;
    }
    if (transcriptionRegion) transcriptionRegion.value = transcriptionConfig.region || 'beijing';
    if (transcriptionWorkspace) transcriptionWorkspace.value = transcriptionConfig.workspaceId || '';
    if (llmBaseUrl) llmBaseUrl.value = transcriptionConfig.llmBaseUrl || 'https://api.deepseek.com';
    if (llmModel) llmModel.value = transcriptionConfig.llmModel || 'deepseek-v4-flash';
  }


  async function loadTranscriptionConfig() {
    if (!window.notchAPI || typeof window.notchAPI.getTranscriptionConfig !== 'function') return;
    try {
      const config = await window.notchAPI.getTranscriptionConfig();
      if (config) transcriptionConfig = config;
    } catch (error) {}
    updateTranscriptionConfigUi();
    updateRecordingUi();
    Kit.parts.settings?.render();
  }

  function openTranscriptionSettings() {
    if (!transcriptionSettingsBackdrop) return;
    transcriptionSettingsBackdrop.hidden = false;
    transcriptionSettingsNote.classList.remove('error', 'success');
    transcriptionSettingsNote.textContent = transcriptionConfig.asrNeedsReentry || transcriptionConfig.llmNeedsReentry
      ? 'Old encrypted keys can’t be decrypted after upgrade. Re-enter your DashScope and DeepSeek API keys.'
      : transcriptionConfig.configured || transcriptionConfig.llmConfigured
        ? 'Leave configured keys blank; new values replace the old ones.'
        : 'Configure both DashScope live transcription and DeepSeek API keys.';
    if (transcriptionApiKey) transcriptionApiKey.value = '';
    if (llmApiKey) llmApiKey.value = '';
    updateTranscriptionConfigUi();
    setTimeout(() => transcriptionApiKey?.focus(), 0);
  }

  function closeTranscriptionSettings() {
    if (transcriptionSettingsBackdrop) transcriptionSettingsBackdrop.hidden = true;
  }

  async function saveTranscriptionSettings() {
    if (!window.notchAPI || !transcriptionSettingsSave) return;
    if (
      !transcriptionConfig.configured
      && !transcriptionApiKey.value.trim()
      && !transcriptionConfig.llmConfigured
      && !llmApiKey.value.trim()
    ) {
      transcriptionSettingsNote.classList.add('error');
      transcriptionSettingsNote.textContent = 'Configure at least one API key.';
      return;
    }
    transcriptionSettingsSave.disabled = true;
    transcriptionSettingsNote.classList.remove('error');
    transcriptionSettingsNote.textContent = 'Saving securely…';
    let result;
    try {
      result = await window.notchAPI.setTranscriptionConfig({
        apiKey: transcriptionApiKey.value,
        region: transcriptionRegion.value,
        workspaceId: transcriptionWorkspace.value,
        llmApiKey: llmApiKey.value,
        llmBaseUrl: llmBaseUrl.value,
        llmModel: llmModel.value,
      });
    } catch (error) {
      result = { ok: false, error: 'save_failed' };
    }
    transcriptionSettingsSave.disabled = false;
    if (!result || !result.ok) {
      transcriptionSettingsNote.classList.add('error');
      transcriptionSettingsNote.textContent = result && result.error === 'invalid_workspace'
        ? 'Invalid Workspace ID format.'
        : result && result.error === 'invalid_llm_url'
          ? 'LLM Base URL must be a valid HTTPS address.'
        : result && result.error === 'secure_storage_unavailable'
          ? 'System secure storage unavailable. Use the DASHSCOPE_API_KEY environment variable instead.'
          : 'Couldn’t save settings — try again.';
      return;
    }
    transcriptionConfig = result;
    if (transcriptionApiKey) transcriptionApiKey.value = '';
    if (llmApiKey) llmApiKey.value = '';
    updateTranscriptionConfigUi();
    transcriptionSettingsNote.classList.remove('error');
    transcriptionSettingsNote.classList.add('success');
    transcriptionSettingsNote.textContent = 'Saved securely. Fields stay blank for safety; status above shows what’s configured.';
    transcriptionSettingsSave.textContent = 'Saved';
    setTimeout(() => {
      if (transcriptionSettingsSave) transcriptionSettingsSave.textContent = 'Save';
    }, 1200);
    if (
      transcriptionConfig.configured
      && ['recording', 'paused'].includes(recordingStatus)
      && !transcriptionStartPromise
    ) {
      stopSpeechRecognition();
      transcriptionStatus = 'idle';
      transcriptionStartPromise = startCloudTranscription();
    }
    updateRecordingUi();
    Kit.parts.settings?.render();
  }

  function persistRecordings() {
    saveJson(RECORDINGS_KEY, recordings.filter((recording) => !recording.isDraft));
  }

  function currentDuration() {
    return Domain.calculateRecordingDuration({
      startedAt: recordingStartedAt,
      status: recordingStatus,
      pausedAt,
      pausedTotalMs,
      now: Date.now(),
    });
  }

  function activeRecordingDraft() {
    return recordingDraftId && recordings.find((recording) => recording.id === recordingDraftId) || null;
  }

  function currentRecordingText() {
    return `${recordingTranscript} ${interimTranscript}`.trim();
  }

  function currentRecordingFeedback() {
    if (recordingStartTask.isPending()) return 'Waiting for microphone permission…';
    if (recordingCaptureIssue) return recordingCaptureIssue;
    if (recordingStatus === 'saving') return 'Saving recording…';
    if (transcriptionConfig.asrNeedsReentry) return 'Transcription key invalid · reconfigure API key';
    if (transcriptionStatus === 'browser-error') return 'Transcription API not set · audio still recording';
    if (transcriptionStatus === 'error') return 'Transcription connect failed · audio still recording';
    if (transcriptionStatus === 'reconnecting') return 'Transcription interrupted, reconnecting · audio still recording';
    if (transcriptionStatus === 'connecting') return 'Connecting to transcription…';
    if (transcriptionAudioGap) return 'Some transcript may be missing while offline · full audio still records locally';
    if (recordingStatus === 'paused') return 'Recording paused';
    if (!transcriptionConfig.configured && !currentRecordingText()) return 'Transcription API not set · audio still saves locally';
    return 'Recording';
  }

  function beginRecordingDraft() {
    recordingDraftId = uid('recording');
    const draft = {
      ...Domain.createRecording({
        id: recordingDraftId,
        createdAt: recordingStartedAt,
        durationMs: 0,
        transcript: '',
      }),
      isDraft: true,
    };
    recordings.unshift(draft);
    selectedRecordingId = draft.id;
    recordingSelectionAnchor = draft.id;
    renderRecordings();
  }

  function discardRecordingDraft() {
    if (!recordingDraftId) return;
    recordings = recordings.filter((recording) => recording.id !== recordingDraftId);
    recordingSelection.delete(recordingDraftId);
    selectedRecordingId = recordings[0]?.id || '';
    recordingSelectionAnchor = selectedRecordingId || null;
    recordingDraftId = '';
    renderRecordings();
  }

  function syncRecordingDraftUi() {
    const draft = activeRecordingDraft();
    if (!draft) return;
    const durationMs = recordingStopDurationMs || currentDuration();
    const text = currentRecordingText();
    draft.durationMs = durationMs;
    draft.transcript = recordingTranscript;
    const row = recordingList?.querySelector(`.recording-item[data-id="${CSS.escape(draft.id)}"]`);
    const preview = row?.querySelector('[data-recording-preview]');
    const meta = row?.querySelector('[data-recording-meta]');
    if (preview) preview.textContent = text || currentRecordingFeedback();
    if (meta) meta.textContent = `${recordingStatus === 'saving' ? 'Saving' : recordingStatus === 'paused' ? 'Paused' : 'Recording'} · ${formatClock(durationMs)}`;
    if (selectedRecordingId !== draft.id) return;
    const detailState = recordingDetail?.querySelector('[data-recording-live-state]');
    const detailDot = recordingDetail?.querySelector('[data-recording-live-dot]');
    const detailTime = recordingDetail?.querySelector('[data-recording-live-time]');
    const detailTranscript = recordingDetail?.querySelector('[data-recording-live-transcript]');
    const detailFeedback = recordingDetail?.querySelector('[data-recording-live-feedback]');
    const detailConfigure = recordingDetail?.querySelector('[data-action="configure-transcription"]');
    const detailPause = recordingDetail?.querySelector('.recording-live-pause');
    const detailStop = recordingDetail?.querySelector('.recording-live-stop');
    if (detailState) detailState.textContent = recordingStatus === 'saving' ? 'Saving' : recordingStatus === 'paused' ? 'Paused' : 'Recording';
    if (detailDot) detailDot.dataset.state = recordingStatus;
    if (detailTime) detailTime.textContent = formatClock(durationMs);
    if (detailTranscript && detailTranscript.value !== text) detailTranscript.value = text;
    if (detailFeedback) detailFeedback.textContent = currentRecordingFeedback();
    if (detailConfigure) detailConfigure.hidden = transcriptionConfig.configured && !transcriptionConfig.asrNeedsReentry;
    if (detailPause) {
      detailPause.textContent = recordingStatus === 'paused' ? 'Resume' : 'Pause';
      detailPause.disabled = recordingStatus === 'saving';
    }
    if (detailStop) detailStop.disabled = recordingStatus === 'saving';
  }

  function stopTranscriptionAudioPipeline() {
    if (transcriptionAudioProcessor) {
      transcriptionAudioProcessor.onaudioprocess = null;
      try { transcriptionAudioProcessor.disconnect(); } catch (error) {}
    }
    if (transcriptionAudioSource) {
      try { transcriptionAudioSource.disconnect(); } catch (error) {}
    }
    if (transcriptionAudioMute) {
      try { transcriptionAudioMute.disconnect(); } catch (error) {}
    }
    if (transcriptionAudioContext) transcriptionAudioContext.close().catch(() => {});
    transcriptionAudioContext = null;
    transcriptionAudioSource = null;
    transcriptionAudioProcessor = null;
    transcriptionAudioMute = null;
  }

  function sendTranscriptionPcm(buffer) {
    if (!buffer || !buffer.byteLength || !window.notchAPI) return;
    if (['connecting', 'connected', 'reconnecting'].includes(transcriptionStatus)) {
      window.notchAPI.sendTranscriptionAudio(buffer);
    }
  }

  function startTranscriptionAudioPipeline(stream) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext || !stream) return false;
    try {
      transcriptionAudioContext = new AudioContext({ sampleRate: 16000 });
      transcriptionAudioSource = transcriptionAudioContext.createMediaStreamSource(stream);
      transcriptionAudioProcessor = transcriptionAudioContext.createScriptProcessor(4096, 1, 1);
      transcriptionAudioMute = transcriptionAudioContext.createGain();
      transcriptionAudioMute.gain.value = 0;
      transcriptionAudioProcessor.onaudioprocess = (event) => {
        if (recordingStatus !== 'recording') return;
        const source = event.inputBuffer.getChannelData(0);
        const pcm = Domain.resampleFloat32ToPcm16(source, transcriptionAudioContext.sampleRate, 16000);
        sendTranscriptionPcm(pcm.buffer);
      };
      transcriptionAudioSource.connect(transcriptionAudioProcessor);
      transcriptionAudioProcessor.connect(transcriptionAudioMute);
      transcriptionAudioMute.connect(transcriptionAudioContext.destination);
      return true;
    } catch (error) {
      stopTranscriptionAudioPipeline();
      return false;
    }
  }

  async function startCloudTranscription() {
    if (!transcriptionConfig.configured || !window.notchAPI || !mediaStream) return { ok: false, error: 'not_configured' };
    transcriptionStatus = 'connecting';
    startTranscriptionAudioPipeline(mediaStream);
    updateRecordingUi();
    let result;
    try {
      result = await window.notchAPI.startTranscription();
    } catch (error) {
      result = { ok: false, error: 'connection_failed' };
    }
    if (recordingStatus !== 'recording' && recordingStatus !== 'paused') return result;
    if (!result || !result.ok) {
      transcriptionStatus = 'error';
      stopTranscriptionAudioPipeline();
      updateRecordingUi();
      return result || { ok: false };
    }
    if (transcriptionStatus === 'connecting') transcriptionStatus = 'connected';
    updateRecordingUi();
    return result;
  }

  async function finishCloudTranscription() {
    if (!transcriptionStartPromise) return { ok: false, error: 'not_active', transcript: recordingTranscript };
    stopTranscriptionAudioPipeline();
    // Send finish immediately: waiting for a reconnect here could block saving for a minute.
    transcriptionStartPromise = null;
    transcriptionStatus = 'finishing';
    updateRecordingUi();
    let result;
    try {
      result = await window.notchAPI.finishTranscription();
    } catch (error) {
      result = { ok: false, error: 'finish_failed', transcript: currentRecordingText() };
    }
    recordingTranscript = result?.transcript || currentRecordingText();
    transcriptionStatus = result && result.ok ? 'idle' : 'error';
    interimTranscript = '';
    updateRecordingUi();
    return result;
  }

  if (window.notchAPI && typeof window.notchAPI.onTranscriptionEvent === 'function') {
    window.notchAPI.onTranscriptionEvent((event) => {
      if (!event || !['recording', 'paused', 'saving'].includes(recordingStatus)) return;
      if (event.type === 'transcript') {
        recordingTranscript = String(event.final || '').trim();
        interimTranscript = String(event.interim || '').trim();
      } else if (event.type === 'error') {
        transcriptionStatus = 'error';
      } else if (event.type === 'status' && ['connected', 'reconnecting'].includes(event.status)) {
        if (transcriptionStatus !== 'finishing') transcriptionStatus = event.status;
      } else if (event.type === 'warning' && event.code === 'audio_gap') {
        transcriptionAudioGap = true;
      }
      updateRecordingUi();
    });
  }

  function updateRecordingUi() {
    const recordingActive = isRecordingActive();
    const recordingBusy = isRecordingBusy();
    const visualState = recordingStartTask.isPending() ? 'requesting' : recordingStatus;
    if (homeRecorder) homeRecorder.dataset.state = visualState;
    if (recordingDot) recordingDot.dataset.state = visualState;
    if (recordingStateLabel) {
      recordingStateLabel.textContent = recordingStartTask.isPending()
        ? 'Waiting for mic permission'
        : recordingStatus === 'recording'
        ? 'Recording'
        : recordingStatus === 'paused'
          ? 'Paused'
          : recordingStatus === 'saving'
            ? 'Saving'
            : 'Quick record';
    }
    if (recordingTime) recordingTime.textContent = formatClock(recordingActive ? currentDuration() : 0);
    if (recordStart) recordStart.disabled = recordingBusy;
    if (recordPause) {
      recordPause.disabled = !['recording', 'paused'].includes(recordingStatus);
      recordPause.setAttribute('aria-label', recordingStatus === 'paused' ? 'Resume recording' : 'Pause recording');
      recordPause.classList.toggle('resume', recordingStatus === 'paused');
    }
    if (recordStop) recordStop.disabled = !['recording', 'paused'].includes(recordingStatus);
    if (recordingNew) {
      recordingNew.disabled = recordingBusy;
      recordingNew.textContent = recordingBusy ? 'Record' : 'Record';
      recordingNew.setAttribute('aria-label', recordingStartTask.isPending()
        ? 'Requesting microphone permission'
        : recordingActive ? 'Recording in progress' : 'Start recording');
    }
    if (liveTranscript && recordingBusy) {
      const text = currentRecordingText();
      // asrNeedsReentry = 密文还在但当前App解不开它。safeStorage 的Vault存在钥匙串里、
      // ACL 绑code签名，所以Dev版存的 Key 装成 DMG 后就读不出来（ad-hoc 签名每次打包
      // 都会换 cdhash，也是同样的结果）。这种情况下Record正常、只有转写不Work，
      // 原来只在Settings面板里提示一行，Record的人看不到，表现就是「能录但不转写」。
      const fallback = currentRecordingFeedback();
      const needsAttention = recordingCaptureIssue || transcriptionAudioGap
        || ['error', 'reconnecting', 'connecting', 'browser-error'].includes(transcriptionStatus);
      liveTranscript.textContent = needsAttention && text ? `${fallback}\n${text}` : text || fallback;
      liveTranscript.hidden = !(text || fallback);
    }
    syncRecordingDraftUi();
    Kit.parts.settings?.renderHomeModules();
    document.dispatchEvent(new CustomEvent('notch:recording-state-changed', {
      detail: { active: recordingBusy },
    }));
  }

  function stopSpeechRecognition() {
    const recognition = speechRecognition;
    speechRecognition = null;
    if (recognition) {
      try { recognition.stop(); } catch (error) {}
    }
    interimTranscript = '';
  }

  function startSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      transcriptionStatus = 'browser-error';
      updateRecordingUi();
      return;
    }
    if (speechRecognitionBlocked || recordingStatus !== 'recording') return;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      interimTranscript = '';
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const text = String(event.results[index][0] && event.results[index][0].transcript || '').trim();
        if (!text) continue;
        if (event.results[index].isFinal) {
          recordingTranscript = `${recordingTranscript} ${text}`.trim();
        } else {
          interimTranscript = `${interimTranscript} ${text}`.trim();
        }
      }
      updateRecordingUi();
    };
    recognition.onerror = (event) => {
      interimTranscript = '';
      speechRecognitionError = String(event && event.error || 'unknown');
      if (['network', 'not-allowed', 'service-not-allowed', 'audio-capture'].includes(speechRecognitionError)) {
        speechRecognitionBlocked = true;
        transcriptionStatus = 'browser-error';
      }
      updateRecordingUi();
    };
    recognition.onend = () => {
      if (speechRecognition !== recognition) return;
      speechRecognition = null;
      if (recordingStatus === 'recording' && !speechRecognitionBlocked) setTimeout(startSpeechRecognition, 180);
    };
    speechRecognition = recognition;
    try {
      recognition.start();
    } catch (error) {
      speechRecognition = null;
    }
  }

  function stopMediaTracks() {
    stopRecordingStrands();
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      mediaStream = null;
    }
  }

  function chooseRecordingMimeType() {
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
    return candidates.find((type) => window.MediaRecorder && MediaRecorder.isTypeSupported(type)) || '';
  }

  async function finalizeRecording(blob, durationMs) {
    recordingStatus = 'saving';
    updateRecordingUi();
    if (!blob || blob.size === 0) {
      recordingStatus = 'idle';
      recordingCaptureIssue = '';
      discardRecordingDraft();
      if (liveTranscript) {
        liveTranscript.textContent = 'Empty recording · check microphone input';
        liveTranscript.hidden = false;
      }
      updateRecordingUi();
      return;
    }
    let saved;
    try {
      saved = window.notchAPI && await window.notchAPI.saveRecording({
        bytes: await blob.arrayBuffer(),
        mimeType: blob.type || 'audio/webm',
      });
    } catch (error) {
      saved = null;
    }
    if (saved && saved.ok) {
      const draft = activeRecordingDraft();
      const recording = Domain.createRecording({
        id: draft?.id || uid('recording'),
        createdAt: draft?.createdAt || Date.now(),
        durationMs,
        transcript: recordingTranscript,
        audioPath: saved.audioPath,
        mimeType: saved.mimeType || blob.type,
      });
      const draftIndex = recordings.findIndex((item) => item.id === recording.id);
      if (draftIndex >= 0) recordings.splice(draftIndex, 1, recording);
      else recordings.unshift(recording);
      recordingDraftId = '';
      selectedRecordingId = recording.id;
      persistRecordings();
      renderRecordings();
      if (recording.transcript && window.notchAPI?.organizeMaterial) {
        window.notchAPI.organizeMaterial({ kind: 'recording', text: recording.transcript }).then((metadata) => {
          const target = recordings.find((item) => item.id === recording.id);
          if (!target || !metadata || !metadata.ok) return;
          target.title = metadata.title || target.title;
          target.category = metadata.category || target.category;
          persistRecordings();
          renderRecordings();
        }).catch(() => {});
      }
      if (liveTranscript) {
        liveTranscript.textContent = recording.transcript || (transcriptionConfig.configured
          ? 'Recording saved · no transcript'
          : 'Recording saved · configure transcription API');
        liveTranscript.hidden = false;
      }
    } else {
      discardRecordingDraft();
      if (liveTranscript) {
        liveTranscript.textContent = 'Couldn’t save recording — check storage permission';
        liveTranscript.hidden = false;
      }
    }
    recordingStatus = 'idle';
    recordingStartedAt = 0;
    pausedAt = 0;
    pausedTotalMs = 0;
    audioChunks = [];
    recordingTranscript = '';
    interimTranscript = '';
    recordingCaptureIssue = '';
    updateRecordingUi();
  }

  async function startRecordingAttempt() {
    if (recordingStatus !== 'idle' || !navigator.mediaDevices || !window.MediaRecorder) return;
    try {
      if (window.notchAPI && !(await window.notchAPI.ensureMicrophone())) {
        if (liveTranscript) {
          liveTranscript.textContent = 'Can’t access microphone · allow it in System Settings';
          liveTranscript.hidden = false;
        }
        return;
      }
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      const audioTrack = mediaStream.getAudioTracks()[0];
      if (!audioTrack || audioTrack.readyState !== 'live') throw new Error('audio_track_unavailable');
      recordingCaptureIssue = '';
      audioTrack.addEventListener('mute', () => {
        if (!['recording', 'paused'].includes(recordingStatus)) return;
        recordingCaptureIssue = 'No mic input · check system audio source';
        updateRecordingUi();
      });
      audioTrack.addEventListener('unmute', () => {
        recordingCaptureIssue = '';
        updateRecordingUi();
      });
      startRecordingStrands(mediaStream);
      const mimeType = chooseRecordingMimeType();
      mediaRecorder = new MediaRecorder(mediaStream, mimeType ? { mimeType } : undefined);
      audioChunks = [];
      recordingTranscript = '';
      interimTranscript = '';
      speechRecognitionBlocked = false;
      speechRecognitionError = '';
      recordingStartedAt = Date.now();
      recordingStopDurationMs = 0;
      pausedTotalMs = 0;
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size) audioChunks.push(event.data);
      };
      mediaRecorder.onerror = () => {
        recordingCaptureIssue = 'Recording interrupted · start again';
        updateRecordingUi();
      };
      mediaRecorder.onstop = async () => {
        const durationMs = recordingStopDurationMs || currentDuration();
        const blob = new Blob(audioChunks, { type: mediaRecorder.mimeType || mimeType || 'audio/webm' });
        stopMediaTracks();
        if (transcriptionFinishPromise) {
          await transcriptionFinishPromise;
          transcriptionFinishPromise = null;
        }
        finalizeRecording(blob, durationMs);
      };
      mediaRecorder.start(1000);
      recordingStatus = 'recording';
      transcriptionStatus = 'idle';
      transcriptionAudioGap = false;
      transcriptionStartPromise = null;
      transcriptionFinishPromise = null;
      beginRecordingDraft();
      if (transcriptionConfig.configured) {
        transcriptionStartPromise = startCloudTranscription();
      } else {
        startSpeechRecognition();
      }
      clearInterval(recordingTimer);
      recordingTimer = setInterval(updateRecordingUi, 500);
      updateRecordingUi();
    } catch (error) {
      stopMediaTracks();
      recordingStatus = 'idle';
      recordingCaptureIssue = '';
      discardRecordingDraft();
      if (liveTranscript) {
        liveTranscript.textContent = 'Can’t start recording · check microphone permission';
        liveTranscript.hidden = false;
      }
      updateRecordingUi();
    }
  }

  function startRecording() {
    return recordingStartTask.run(startRecordingAttempt);
  }

  function togglePauseRecording() {
    if (!mediaRecorder) return;
    if (recordingStatus === 'recording') {
      mediaRecorder.pause();
      pausedAt = Date.now();
      recordingStatus = 'paused';
      if (!transcriptionConfig.configured) stopSpeechRecognition();
    } else if (recordingStatus === 'paused') {
      pausedTotalMs += Date.now() - pausedAt;
      pausedAt = 0;
      mediaRecorder.resume();
      recordingStatus = 'recording';
      if (!transcriptionConfig.configured) startSpeechRecognition();
    }
    updateRecordingUi();
  }

  function stopRecording() {
    if (!mediaRecorder || !['recording', 'paused'].includes(recordingStatus)) return;
    recordingStopDurationMs = currentDuration();
    recordingStatus = 'saving';
    if (!transcriptionConfig.configured) stopSpeechRecognition();
    transcriptionFinishPromise = transcriptionStartPromise
      ? finishCloudTranscription()
      : Promise.resolve({ ok: false, error: 'not_active', transcript: recordingTranscript });
    clearInterval(recordingTimer);
    recordingTimer = null;
    updateRecordingUi();
    try {
      mediaRecorder.stop();
    } catch (error) {
      stopMediaTracks();
      recordingStatus = 'idle';
      discardRecordingDraft();
      updateRecordingUi();
    }
  }

  if (recordStart) recordStart.addEventListener('click', startRecording);
  if (recordPause) recordPause.addEventListener('click', togglePauseRecording);
  if (recordStop) recordStop.addEventListener('click', stopRecording);
  if (recordingNew) recordingNew.addEventListener('click', startRecording);
  if (recordingConfigure) recordingConfigure.addEventListener('click', openTranscriptionSettings);
  if (settingsApiConfigure) settingsApiConfigure.addEventListener('click', openTranscriptionSettings);
  if (transcriptionSettingsClose) transcriptionSettingsClose.addEventListener('click', closeTranscriptionSettings);
  if (transcriptionSettingsCancel) transcriptionSettingsCancel.addEventListener('click', closeTranscriptionSettings);
  if (transcriptionSettingsSave) transcriptionSettingsSave.addEventListener('click', saveTranscriptionSettings);
  if (transcriptionApiHelp) {
    transcriptionApiHelp.addEventListener('click', () => {
      window.notchAPI?.openExternal('https://bailian.console.aliyun.com/cn-beijing/?tab=app#/api-key');
    });
  }
  if (llmApiHelp) {
    llmApiHelp.addEventListener('click', () => {
      window.notchAPI?.openExternal('https://platform.deepseek.com/api_keys');
    });
  }
  if (transcriptionSettingsBackdrop) {
    transcriptionSettingsBackdrop.addEventListener('click', (event) => {
      if (event.target === transcriptionSettingsBackdrop) closeTranscriptionSettings();
    });
  }
  if (window.notchAPI && typeof window.notchAPI.onOpenApiSettings === 'function') {
    window.notchAPI.onOpenApiSettings(async () => {
      if (!document.getElementById('app')?.classList.contains('expanded')) await setMode(true);
      openTranscriptionSettings();
    });
  }

  async function loadRecordingAudio(recording, container) {
    if (!window.notchAPI || !recording.audioPath) return;
    const result = await window.notchAPI.readRecording(recording.audioPath);
    if (!result || selectedRecordingId !== recording.id || !container.isConnected) {
      container.textContent = 'Audio file unavailable';
      return;
    }
    if (currentAudioUrl) URL.revokeObjectURL(currentAudioUrl);
    currentAudioUrl = URL.createObjectURL(new Blob([result.bytes], { type: result.mimeType }));
    const audio = document.createElement('audio');
    audio.controls = true;
    audio.preload = 'metadata';
    audio.src = currentAudioUrl;
    container.replaceChildren(audio);
  }

  function renderRecordingDetail() {
    if (!recordingDetail) return;
    const recording = recordings.find((item) => item.id === selectedRecordingId);
    recordingDetail.replaceChildren();
    if (!recording) {
      const empty = document.createElement('div');
      empty.className = 'recording-detail-empty';
      empty.textContent = 'After you record, audio and transcript appear here.';
      recordingDetail.appendChild(empty);
      return;
    }
    if (recording.isDraft) {
      const liveHeader = document.createElement('header');
      liveHeader.className = 'recording-live-head';
      const liveState = document.createElement('div');
      liveState.className = 'recording-live-state';
      const liveDot = document.createElement('span');
      liveDot.className = 'recording-state-dot';
      liveDot.dataset.recordingLiveDot = '';
      liveDot.dataset.state = recordingStatus;
      const liveLabel = document.createElement('strong');
      liveLabel.dataset.recordingLiveState = '';
      const liveTime = document.createElement('time');
      liveTime.dataset.recordingLiveTime = '';
      liveState.append(liveDot, liveLabel);
      liveHeader.append(liveState, liveTime);

      const liveAudio = document.createElement('div');
      liveAudio.className = 'recording-live-audio';
      const liveAudioTitle = document.createElement('strong');
      liveAudioTitle.textContent = 'Audio is recording locally';
      const liveAudioHint = document.createElement('span');
      liveAudioHint.textContent = 'Saves automatically when you stop, then the player appears';
      const liveControls = document.createElement('div');
      liveControls.className = 'recording-live-controls';
      const pause = document.createElement('button');
      pause.type = 'button';
      pause.className = 'workspace-button compact recording-live-pause';
      pause.textContent = recordingStatus === 'paused' ? 'Resume' : 'Pause';
      pause.addEventListener('click', togglePauseRecording);
      const stop = document.createElement('button');
      stop.type = 'button';
      stop.className = 'workspace-button compact primary recording-live-stop';
      stop.textContent = 'Stop and save';
      stop.addEventListener('click', stopRecording);
      liveControls.append(pause, stop);
      liveAudio.append(liveAudioTitle, liveAudioHint, liveControls);

      const transcriptHead = document.createElement('div');
      transcriptHead.className = 'recording-transcript-head';
      const transcriptLabel = document.createElement('span');
      transcriptLabel.className = 'tile-label';
      transcriptLabel.textContent = 'Live transcript';
      const configure = document.createElement('button');
      configure.type = 'button';
      configure.className = 'workspace-button compact recording-live-configure';
      configure.dataset.action = 'configure-transcription';
      configure.textContent = 'Configure API';
      configure.addEventListener('click', openTranscriptionSettings);
      transcriptHead.append(transcriptLabel, configure);

      const transcript = document.createElement('textarea');
      transcript.className = 'recording-transcript-editor recording-live-transcript';
      transcript.readOnly = true;
      transcript.dataset.recordingLiveTranscript = '';
      transcript.placeholder = 'Transcript appears here once you start speaking.';
      transcript.setAttribute('aria-label', 'Live transcript text');
      const feedback = document.createElement('p');
      feedback.className = 'recording-live-feedback';
      feedback.dataset.recordingLiveFeedback = '';
      feedback.setAttribute('aria-live', 'polite');
      recordingDetail.append(liveHeader, liveAudio, transcriptHead, transcript, feedback);
      syncRecordingDraftUi();
      return;
    }
    const header = document.createElement('header');
    header.className = 'recording-detail-head';
    const title = document.createElement('input');
    title.className = 'recording-title-input';
    title.value = recording.title;
    title.setAttribute('aria-label', 'Recording name');
    const meta = document.createElement('span');
    meta.textContent = `${recording.category || 'Uncategorized'} · ${formatShortDate(recording.createdAt)} · ${formatClock(recording.durationMs)}`;
    header.append(title, meta);

    const audioWrap = document.createElement('div');
    audioWrap.className = 'recording-audio';
    audioWrap.textContent = 'Loading audio…';

    const transcriptHead = document.createElement('div');
    transcriptHead.className = 'recording-transcript-head';
    const label = document.createElement('span');
    label.className = 'tile-label';
    label.textContent = 'Transcript';
    const actions = document.createElement('div');
    actions.append(
      createIconButton('copy-recording', 'Copy transcript', COPY_ICON),
      createIconButton('reveal-recording', 'Reveal in Finder', OPEN_ICON),
      createIconButton('delete-recording', 'Delete recording', DELETE_ICON, true)
    );
    transcriptHead.append(label, actions);

    const transcript = document.createElement('textarea');
    transcript.className = 'recording-transcript-editor';
    transcript.value = recording.transcript;
    transcript.placeholder = 'No live transcript for this recording. You can still play audio or add notes here.';
    transcript.setAttribute('aria-label', 'Recording transcript');
    recordingDetail.append(header, audioWrap, transcriptHead, transcript);

    title.addEventListener('change', () => {
      if (title.value.trim()) recording.title = title.value.trim();
      title.value = recording.title;
      persistRecordings();
      renderRecordingList();
    });
    transcript.addEventListener('input', () => {
      recording.transcript = transcript.value;
      persistRecordings();
    });
    actions.addEventListener('click', async (event) => {
      const action = event.target.closest('[data-action]');
      if (!action) return;
      if (action.dataset.action === 'copy-recording' && window.notchAPI && recording.transcript) {
        await window.notchAPI.writeClipboard({ type: 'text', text: recording.transcript });
      }
      if (action.dataset.action === 'reveal-recording' && window.notchAPI && recording.audioPath) {
        await window.notchAPI.revealRecording(recording.audioPath);
      }
      if (action.dataset.action === 'delete-recording') {
        await deleteSingleRecording(recording.id);
      }
    });
    loadRecordingAudio(recording, audioWrap);
  }

  async function deleteSingleRecording(recordingId) {
    const recording = recordings.find((item) => item.id === recordingId);
    if (!recording) return;
    if (window.notchAPI && recording.audioPath) {
      await window.notchAPI.deleteRecording(recording.audioPath).catch(() => false);
    }
    const next = Domain.removeRecordingState(
      recordings,
      recording.id,
      [...recordingSelection],
      selectedRecordingId
    );
    recordings = next.recordings;
    recordingSelection = new Set(next.selection);
    selectedRecordingId = next.selectedId;
    recordingSelectionAnchor = selectedRecordingId || null;
    persistRecordings();
    renderRecordings();
  }

  function renderRecordingList() {
    if (!recordingList) return;
    recordingList.replaceChildren();
    if (recordingBulkDelete) {
      recordingBulkDelete.hidden = recordingSelection.size === 0;
      recordingBulkDelete.textContent = 'Delete';
      recordingBulkDelete.setAttribute('aria-label', recordingSelection.size
        ? `Delete ${recordingSelection.size} items`
        : 'Delete selected');
    }
    if (!recordings.length) {
      const empty = document.createElement('div');
      empty.className = 'recording-list-empty';
      empty.textContent = 'No recordings yet';
      recordingList.appendChild(empty);
      return;
    }
    recordings.forEach((recording) => {
      const row = document.createElement('div');
      row.className = `recording-item${recording.id === selectedRecordingId ? ' active' : ''}${recordingSelection.has(recording.id) ? ' multi-selected' : ''}${recording.isDraft ? ' is-live' : ''}`;
      row.dataset.id = recording.id;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'recording-item-main';
      button.setAttribute('aria-label', `Open recording: ${recording.title}`);
      const title = document.createElement('strong');
      title.textContent = recording.title;
      const preview = document.createElement('span');
      preview.dataset.recordingPreview = '';
      preview.textContent = recording.isDraft ? (currentRecordingText() || currentRecordingFeedback()) : (recording.transcript || 'Audio only · no transcript');
      const meta = document.createElement('time');
      meta.dataset.recordingMeta = '';
      meta.textContent = recording.isDraft
        ? `${recordingStatus === 'saving' ? 'Saving' : recordingStatus === 'paused' ? 'Paused' : 'Recording'} · ${formatClock(recording.durationMs)}`
        : `${formatShortDate(recording.createdAt)} · ${formatClock(recording.durationMs)}`;
      button.append(title, preview, meta);
      row.append(button);
      if (!recording.isDraft) {
        const remove = createIconButton('delete-recording-item', `Delete recording: ${recording.title}`, DELETE_ICON, true);
        remove.classList.add('recording-item-delete');
        row.append(remove);
      }
      recordingList.appendChild(row);
    });
  }

  function renderRecordings() {
    if (recordingCount) recordingCount.textContent = `${recordings.length} items`;
    renderRecordingList();
    renderRecordingDetail();
  }

  if (recordingList) {
    recordingList.addEventListener('click', async (event) => {
      const remove = event.target.closest('[data-action="delete-recording-item"]');
      if (remove) {
        event.preventDefault();
        event.stopPropagation();
        const row = remove.closest('.recording-item[data-id]');
        if (row) await deleteSingleRecording(row.dataset.id);
        return;
      }
      const item = event.target.closest('.recording-item[data-id]');
      if (!item) return;
      const targetRecording = recordings.find((recording) => recording.id === item.dataset.id);
      if (event.shiftKey && targetRecording && !targetRecording.isDraft) {
        event.preventDefault();
        const result = Domain.updateRangeSelection(
          recordings.filter((recording) => !recording.isDraft).map((recording) => recording.id),
          [...recordingSelection],
          item.dataset.id,
          recordingSelectionAnchor,
          true
        );
        recordingSelection = new Set(result.selected);
        recordingSelectionAnchor = result.anchor;
        renderRecordingList();
        return;
      }
      selectedRecordingId = item.dataset.id;
      recordingSelectionAnchor = selectedRecordingId;
      renderRecordings();
    });
  }

  recordingBulkDelete?.addEventListener('click', async () => {
    if (!recordingSelection.size) return;
    const targets = recordings.filter((recording) => !recording.isDraft && recordingSelection.has(recording.id));
    if (!targets.length) return;
    if (window.notchAPI) {
      await Promise.all(targets.map((recording) => recording.audioPath
        ? window.notchAPI.deleteRecording(recording.audioPath).catch(() => false)
        : Promise.resolve(true)));
    }
    const targetIds = new Set(targets.map((recording) => recording.id));
    recordings = recordings.filter((recording) => !targetIds.has(recording.id));
    recordingSelection.clear();
    selectedRecordingId = recordings[0] && recordings[0].id;
    recordingSelectionAnchor = selectedRecordingId || null;
    persistRecordings();
    renderRecordings();
  });

  document.addEventListener('notch:clear-selection', () => {
    recordingSelection.clear();
    recordingSelectionAnchor = selectedRecordingId || null;
    renderRecordingList();
  });

  window.addEventListener('beforeunload', () => {
    stopSpeechRecognition();
    stopTranscriptionAudioPipeline();
    if (transcriptionStartPromise && window.notchAPI) window.notchAPI.finishTranscription().catch(() => {});
    stopMediaTracks();
    if (currentAudioUrl) URL.revokeObjectURL(currentAudioUrl);
  });

  Kit.parts.recordings = {
    renderRecordings,
    updateRecordingUi,
    loadTranscriptionConfig,
    startRecording,
    isRecordingActive,
    isRecordingBusy,
    getTranscriptionConfig: () => transcriptionConfig,
    applyTranscriptionConfig(config) {
      transcriptionConfig = config;
      updateTranscriptionConfigUi();
      updateRecordingUi();
    },
  };
})();
