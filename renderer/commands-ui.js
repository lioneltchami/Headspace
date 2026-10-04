(function initCommandsUi() {
  const Kit = window.NotchWorkspaceKit;
  if (!Kit) return;
  const { Domain, uid, loadJson, saveJson, icons: { COPY_ICON, DELETE_ICON } } = Kit;
  const COMMANDS_KEY = 'notch-home-commands';
  // ============ Commands ============
  const commandInput = document.getElementById('command-add');
  const commandList = document.getElementById('command-list');
  const commandBulkDelete = document.getElementById('command-bulk-delete');
  let commands = loadJson(COMMANDS_KEY, [])
    .map((item) => Domain.createCommand(item && item.text, item && item.id, item && item.createdAt))
    .filter(Boolean);
  let commandSelection = new Set();
  let commandSelectionAnchor = null;

  function persistCommands() {
    saveJson(COMMANDS_KEY, commands);
  }

  function renderCommands() {
    if (!commandList) return;
    commandList.replaceChildren();
    if (commandBulkDelete) {
      commandBulkDelete.hidden = commandSelection.size === 0;
      commandBulkDelete.textContent = 'Delete';
      commandBulkDelete.setAttribute('aria-label', commandSelection.size
        ? `Delete ${commandSelection.size} items`
        : 'Delete selected');
    }
    if (!commands.length) {
      const empty = document.createElement('div');
      empty.className = 'command-empty';
      empty.textContent = 'Keep commands, prompts, or reply templates here';
      commandList.appendChild(empty);
      return;
    }
    commands.forEach((command) => {
      const row = document.createElement('div');
      row.className = `command-item${commandSelection.has(command.id) ? ' multi-selected' : ''}`;
      row.dataset.id = command.id;

      const textButton = document.createElement('button');
      textButton.className = 'command-text';
      textButton.type = 'button';
      textButton.dataset.action = 'edit-command';
      textButton.title = 'Click to edit';
      textButton.textContent = command.text;

      const actions = document.createElement('div');
      actions.className = 'command-actions';
      const copy = document.createElement('button');
      copy.className = 'icon-button';
      copy.type = 'button';
      copy.dataset.action = 'copy-command';
      copy.setAttribute('aria-label', 'Copy command');
      copy.innerHTML = COPY_ICON;
      const remove = document.createElement('button');
      remove.className = 'icon-button danger';
      remove.type = 'button';
      remove.dataset.action = 'delete-command';
      remove.setAttribute('aria-label', 'Delete command');
      remove.innerHTML = DELETE_ICON;
      actions.append(copy, remove);
      row.append(textButton, actions);
      commandList.appendChild(row);
    });
  }

  function editCommand(row) {
    const command = commands.find((item) => item.id === row.dataset.id);
    if (!command || row.querySelector('input')) return;
    const button = row.querySelector('.command-text');
    const input = document.createElement('input');
    input.className = 'command-edit';
    input.value = command.text;
    button.replaceWith(input);
    input.focus();
    input.select();
    let finished = false;
    const finish = (save) => {
      if (finished) return;
      finished = true;
      const value = input.value.trim();
      if (save && value) command.text = value;
      persistCommands();
      renderCommands();
    };
    input.addEventListener('blur', () => finish(true));
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.isComposing) finish(true);
      if (event.key === 'Escape') finish(false);
    });
  }

  if (commandInput) {
    commandInput.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || event.isComposing || event.keyCode === 229 || event.repeat) return;
      event.preventDefault();
      const command = Domain.createCommand(commandInput.value, uid('command'), Date.now());
      if (!command) return;
      commands.unshift(command);
      commandInput.value = '';
      persistCommands();
      renderCommands();
    });
  }

  if (commandList) {
    commandList.addEventListener('click', async (event) => {
      const row = event.target.closest('.command-item');
      if (!row) return;
      const command = commands.find((item) => item.id === row.dataset.id);
      if (!command) return;
      if (event.shiftKey) {
        event.preventDefault();
        const result = Domain.updateRangeSelection(
          commands.map((item) => item.id),
          [...commandSelection],
          command.id,
          commandSelectionAnchor,
          true
        );
        commandSelection = new Set(result.selected);
        commandSelectionAnchor = result.anchor;
        renderCommands();
        return;
      }
      commandSelectionAnchor = command.id;
      const action = event.target.closest('[data-action]');
      if (!action) return;
      if (action.dataset.action === 'edit-command') editCommand(row);
      if (action.dataset.action === 'delete-command') {
        commands = commands.filter((item) => item.id !== command.id);
        commandSelection.delete(command.id);
        persistCommands();
        renderCommands();
      }
      if (action.dataset.action === 'copy-command' && window.notchAPI) {
        const copied = await window.notchAPI.writeClipboard({ type: 'text', text: command.text });
        if (copied) {
          row.classList.add('copied');
          setTimeout(() => row.classList.remove('copied'), 700);
        }
      }
    });
  }
  commandBulkDelete?.addEventListener('click', () => {
    if (!commandSelection.size) return;
    commands = commands.filter((command) => !commandSelection.has(command.id));
    commandSelection.clear();
    commandSelectionAnchor = null;
    persistCommands();
    renderCommands();
  });

  document.addEventListener('notch:clear-selection', () => {
    commandSelection.clear();
    commandSelectionAnchor = null;
    renderCommands();
  });

  Kit.parts.commands = { render: renderCommands };
})();
