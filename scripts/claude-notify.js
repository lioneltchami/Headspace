#!/usr/bin/env node
'use strict';

// Claude Code Stop hook: forward task-complete to the panel local notify service.
// Covers terminal CLI, VS Code / JetBrains plugins, and desktop — same CLI kernel,
// so registering a Stop hook in ~/.claude/settings.json invokes this script.
// Must fail silently: never block Claude turn-end.

const fs = require('node:fs');
const http = require('node:http');

const NOTCH_HOST = '127.0.0.1';
const NOTCH_PORT = 43821;
const REQUEST_TIMEOUT_MS = 900;
const STDIN_TIMEOUT_MS = 1500;
// Read only the transcript tail so long sessions stay in memory bounds.
const TRANSCRIPT_TAIL_BYTES = 256 * 1024;
const TRANSCRIPT_RETRIES = 3;
const TRANSCRIPT_RETRY_DELAY_MS = 120;

function exitQuietly() {
  process.exit(0);
}

function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }
    const chunks = [];
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(Buffer.concat(chunks).toString('utf8'));
    };
    const timer = setTimeout(finish, STDIN_TIMEOUT_MS);
    timer.unref();
    process.stdin.on('data', (chunk) => chunks.push(chunk));
    process.stdin.on('end', finish);
    process.stdin.on('error', finish);
  });
}

function textFromContent(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((block) => block && block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n')
    .trim();
}

// Walk JSONL backward for the last mainline assistant text message.
function lastAssistantMessage(transcriptPath) {
  if (typeof transcriptPath !== 'string' || !transcriptPath.trim()) return '';
  let handle;
  try {
    handle = fs.openSync(transcriptPath, 'r');
  } catch (error) {
    return '';
  }
  try {
    const size = fs.fstatSync(handle).size;
    if (!size) return '';
    const length = Math.min(size, TRANSCRIPT_TAIL_BYTES);
    const buffer = Buffer.allocUnsafe(length);
    fs.readSync(handle, buffer, 0, length, size - length);
    const lines = buffer.toString('utf8').split('\n');
    // Truncated reads may start mid-line; JSON.parse failures are skipped.
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      const line = lines[index].trim();
      if (!line) continue;
      let entry;
      try {
        entry = JSON.parse(line);
      } catch (error) {
        continue;
      }
      if (!entry || typeof entry !== 'object') continue;
      if (entry.type !== 'assistant') continue;
      // Subagent rows share the file; isSidechain marks non-mainline.
      if (entry.isSidechain === true || entry.isMeta === true) continue;
      const text = textFromContent(entry.message && entry.message.content);
      if (text) return text;
    }
    return '';
  } catch (error) {
    return '';
  } finally {
    try { fs.closeSync(handle); } catch (error) {}
  }
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function post(payload) {
  return new Promise((resolve) => {
    let body;
    try {
      body = Buffer.from(JSON.stringify(payload));
    } catch (error) {
      resolve();
      return;
    }
    const request = http.request({
      hostname: NOTCH_HOST,
      port: NOTCH_PORT,
      path: '/notify/claude',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': body.length,
      },
    }, (response) => {
      response.resume();
      response.on('end', resolve);
    });
    request.setTimeout(REQUEST_TIMEOUT_MS, () => request.destroy());
    request.on('error', () => resolve());
    request.on('close', resolve);
    request.end(body);
  });
}

async function main() {
  // Cloud / Web sessions: 127.0.0.1 is not this Mac — bail.
  if (String(process.env.CLAUDE_CODE_REMOTE || '').toLowerCase() === 'true') return;

  let payload;
  try {
    payload = JSON.parse(await readStdin());
  } catch (error) {
    payload = null;
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) payload = {};

  // Subagent end must not toast; main process filters again.
  if (payload.agent_id) return;

  let title = '';
  for (let attempt = 0; attempt < TRANSCRIPT_RETRIES; attempt += 1) {
    title = lastAssistantMessage(payload.transcript_path);
    if (title) break;
    // Transcript is async; the hook may run before the last message lands.
    await sleep(TRANSCRIPT_RETRY_DELAY_MS);
  }

  await post({
    source: 'claude',
    session_id: typeof payload.session_id === 'string' ? payload.session_id : '',
    cwd: typeof payload.cwd === 'string' ? payload.cwd : '',
    last_assistant_message: title,
  });
}

main().then(exitQuietly, exitQuietly);
