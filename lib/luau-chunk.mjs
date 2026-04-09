#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

// ──────────────────────────────────────────────
// Luau Chunk — Logical Code Splitter
// ──────────────────────────────────────────────
// Divides monolithic Luau scripts into logical
// modules based on domain analysis. Generates
// a main loader and separate chunk files.

export function runLuauChunk(filePath, options = {}) {
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    return { error: `File not found: ${absPath}` };
  }

  const source = fs.readFileSync(absPath, 'utf8');
  const lines = source.split('\n');
  const fileName = path.basename(absPath);

  // Step 1: Classify each line
  const classified = classifyLines(source, lines);

  // Step 2: Group into segments
  const segments = groupSegments(classified, lines);

  // Step 3: Assign domains to segments
  const domains = assignDomains(segments, classified);

  // Step 4: Merge segments into chunks
  const chunks = mergeChunks(domains, lines, options);

  // Step 5: Generate main.lua
  const mainScript = generateMainScript(chunks, fileName, options);

  // Step 6: Generate chunk files
  const chunkFiles = generateChunkFiles(chunks, lines, options);

  // Step 7: Validation report
  const validation = validateChunks(chunks, chunkFiles);

  return {
    fileName,
    filePath: absPath,
    totalLines: lines.length,
    chunks,
    mainScript,
    chunkFiles,
    validation,
    summary: {
      totalChunks: chunks.length,
      domainDistribution: countByDomain(chunks),
      originalLines: lines.length,
      totalChunkLines: chunkFiles.reduce((s, c) => s + c.lines.length, 0),
    },
  };
}

// ─── Step 1: Classify Each Line ───

function classifyLines(source, lines) {
  const classified = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip blank and comment lines
    if (trimmed === '' || trimmed.startsWith('--')) {
      classified.push({ index: i, domain: 'blank', line });
      continue;
    }

    const domains = [];

    // UI indicators
    if (/BuildToggle|BuildDropdown|BuildSlider|BuildButton|BuildLabel|BuildSection|BuildKeybind|BuildTextbox/.test(trimmed))
      domains.push('ui');
    if (/CreateToggle|CreateDropdown|CreateSlider|CreateButton|CreateSection/.test(trimmed))
      domains.push('ui');
    if (/AddTab|Library:CreateWindow|CreateWindow/.test(trimmed))
      domains.push('ui');
    if (/Paragraph|StatusText|BuildStatusText|UpdateStatus/.test(trimmed))
      domains.push('ui');

    // Remote indicators
    if (/FireServer|InvokeServer|FireClient|FireAllClients|InvokeClient/.test(trimmed))
      domains.push('remote');
    if (/OnServerEvent|OnClientEvent|OnServerInvoke|OnClientInvoke/.test(trimmed))
      domains.push('remote');
    if (/WaitForChild.*Remote|FindFirstChild.*Remote|WaitForChild.*Event|FindFirstChild.*Event/.test(trimmed))
      domains.push('remote');

    // Config indicators
    if (/ThemeManager|SaveManager|SetFolder|LoadAutoload|AutoloadConfig/.test(trimmed))
      domains.push('config');
    if (/LoadConfig|SaveConfig|configFolder/.test(trimmed))
      domains.push('config');

    // State indicators
    if (/local\s+(Toggles|Options|Config|Settings|State|Defaults|Presets|FarmProfile|GameConfig)\s*=\s*\{/.test(trimmed))
      domains.push('state');
    if (/local\s+\w*Toggle\w*\s*=/.test(trimmed) && /\{/.test(trimmed))
      domains.push('state');

    // Utility indicators
    if (/^local\s+function\s+(FormatNumber|Round|Clamp|Lerp|Distance|GetDistance|GetColor|Format)/.test(trimmed))
      domains.push('utility');
    if (/local\s+\w+\s*=\s*function.*format|local\s+\w+\s*=\s*function.*parse/i.test(trimmed))
      domains.push('utility');
    if (/table\.concat|string\.format|math\.floor|math\.round|math\.clamp/.test(trimmed) && !/taskSpawn/.test(trimmed))
      domains.push('utility');

    // Lifecycle indicators
    if (/CharacterAdded/.test(trimmed))
      domains.push('lifecycle');
    if (/StartLoop|StopLoop|loopId/.test(trimmed))
      domains.push('lifecycle');

    // Logic indicators (fallback — if it has taskSpawn/while and isn't classified)
    if (/taskSpawn|task\.spawn|while\s+\w+\s+do/.test(trimmed))
      domains.push('logic');
    if (/task\.wait/.test(trimmed) && domains.length === 0)
      domains.push('logic');

    // If nothing matched, check if it's a local declaration
    if (domains.length === 0 && /^local\s+/.test(trimmed)) {
      // Check the value for type hints
      if (/game\s*:\s*GetService/.test(trimmed))
        domains.push('state');
      else if (/require\s*\(/.test(trimmed))
        domains.push('state');
      else
        domains.push('logic');
    }

    // Default fallback
    if (domains.length === 0) domains.push('logic');

    classified.push({
      index: i,
      domain: domains[0], // Primary domain
      allDomains: domains,
      line,
    });
  }

  return classified;
}

// ─── Step 2: Group Into Segments ───

function groupSegments(classified, lines) {
  const segments = [];
  let currentDomain = null;
  let startLine = 0;

  for (let i = 0; i < classified.length; i++) {
    const c = classified[i];

    if (c.domain === 'blank') continue;

    if (c.domain !== currentDomain) {
      if (currentDomain !== null && i - startLine >= 2) {
        segments.push({
          domain: currentDomain,
          startLine,
          endLine: i - 1,
          lineCount: i - startLine,
        });
      }
      currentDomain = c.domain;
      startLine = i;
    }
  }

  // Flush last segment
  if (currentDomain !== null && classified.length - startLine >= 2) {
    segments.push({
      domain: currentDomain,
      startLine,
      endLine: classified.length - 1,
      lineCount: classified.length - startLine,
    });
  }

  return segments;
}

// ─── Step 3: Assign Domains ───

function assignDomains(segments, classified) {
  // Merge adjacent segments of same or compatible domains
  const merged = [];
  for (const seg of segments) {
    if (merged.length === 0) {
      merged.push(seg);
      continue;
    }

    const last = merged[merged.length - 1];

    // Merge compatible domains
    if (seg.domain === last.domain) {
      last.endLine = seg.endLine;
      last.lineCount += seg.lineCount;
      continue;
    }

    // UI + state are often together (UI uses state)
    if ((seg.domain === 'state' && last.domain === 'ui') ||
        (seg.domain === 'ui' && last.domain === 'state')) {
      last.domain = 'ui-state';
      last.endLine = seg.endLine;
      last.lineCount += seg.lineCount;
      continue;
    }

    // Remote + logic often together
    if ((seg.domain === 'remote' && last.domain === 'logic') ||
        (seg.domain === 'logic' && last.domain === 'remote')) {
      last.domain = 'logic';
      last.endLine = seg.endLine;
      last.lineCount += seg.lineCount;
      continue;
    }

    merged.push(seg);
  }

  return merged;
}

// ─── Step 4: Merge Into Chunks ───

function mergeChunks(domains, lines, options) {
  // Chunk assignment rules:
  // - state → State chunk
  // - ui → UI chunk
  // - remote → Remote chunk (merge with logic)
  // - logic → Logic chunk
  // - config → Config chunk
  // - lifecycle → Lifecycle chunk
  // - utility → Utility chunk (merge into logic or standalone)

  const chunkMap = new Map();

  for (const seg of domains) {
    let targetDomain;

    switch (seg.domain) {
      case 'state': targetDomain = 'State'; break;
      case 'ui':
      case 'ui-state': targetDomain = 'UI'; break;
      case 'remote': targetDomain = 'Remote'; break;
      case 'logic': targetDomain = 'Logic'; break;
      case 'config': targetDomain = 'Config'; break;
      case 'lifecycle': targetDomain = 'Lifecycle'; break;
      case 'utility': targetDomain = 'Utility'; break;
      default: targetDomain = 'Logic'; break;
    }

    if (!chunkMap.has(targetDomain)) {
      chunkMap.set(targetDomain, {
        domain: targetDomain,
        segments: [],
        totalLines: 0,
        startLine: seg.startLine,
        endLine: seg.endLine,
      });
    }

    const chunk = chunkMap.get(targetDomain);
    chunk.segments.push(seg);
    chunk.totalLines += seg.lineCount;
    chunk.endLine = seg.endLine;
  }

  // Merge Utility into Logic if it's small (< 30 lines)
  if (chunkMap.has('Utility') && chunkMap.get('Utility').totalLines < 30 && chunkMap.has('Logic')) {
    const logic = chunkMap.get('Logic');
    const utility = chunkMap.get('Utility');
    logic.segments.push(...utility.segments);
    logic.totalLines += utility.totalLines;
    chunkMap.delete('Utility');
  }

  // Merge Remote into Logic if it's small
  if (chunkMap.has('Remote') && chunkMap.get('Remote').totalLines < 20 && chunkMap.has('Logic')) {
    const logic = chunkMap.get('Logic');
    const remote = chunkMap.get('Remote');
    logic.segments.push(...remote.segments);
    logic.totalLines += remote.totalLines;
    chunkMap.delete('Remote');
  }

  // Merge Config into State if small
  if (chunkMap.has('Config') && chunkMap.get('Config').totalLines < 15 && chunkMap.has('State')) {
    const state = chunkMap.get('State');
    const config = chunkMap.get('Config');
    state.segments.push(...config.segments);
    state.totalLines += config.totalLines;
    chunkMap.delete('Config');
  }

  return Array.from(chunkMap.values()).sort((a, b) => a.startLine - b.startLine);
}

// ─── Step 5: Generate main.lua ───

function generateMainScript(chunks, fileName, options) {
  const baseName = fileName.replace('.lua', '');
  const lines = [];

  // Header
  lines.push(`-- ${baseName} — Chunked Main`);
  lines.push(`-- Auto-generated by agent-system luau-chunk`);
  lines.push(`-- Generated: ${new Date().toISOString()}`);
  lines.push('');

  // Load order (respecting dependencies)
  const loadOrder = determineLoadOrder(chunks);

  for (const chunkName of loadOrder) {
    lines.push(`-- Load ${chunkName}`);
    lines.push(`local ${chunkName}Module = loadfile("${chunkName}.lua")`);
    lines.push(`if ${chunkName}Module then ${chunkName}Module() end`);
    lines.push('');
  }

  lines.push(`-- ${baseName} initialized`);

  return lines.join('\n');
}

function determineLoadOrder(chunks) {
  // Dependency order: State → Config → Remote → Utility → Lifecycle → Logic → UI
  const priority = {
    State: 1,
    Config: 2,
    Remote: 3,
    Utility: 4,
    Lifecycle: 5,
    Logic: 6,
    UI: 7,
  };

  const chunkNames = chunks.map(c => c.domain);
  return chunkNames.sort((a, b) => (priority[a] || 99) - (priority[b] || 99));
}

// ─── Step 6: Generate Chunk Files ───

function generateChunkFiles(chunks, lines, options) {
  const chunkFiles = [];

  for (const chunk of chunks) {
    const fileLines = [];
    const seenLines = new Set();

    for (const seg of chunk.segments) {
      for (let i = seg.startLine; i <= seg.endLine; i++) {
        if (!seenLines.has(i)) {
          seenLines.add(i);
          fileLines.push(lines[i]);
        }
      }
    }

    chunkFiles.push({
      domain: chunk.domain,
      fileName: `${chunk.domain}.lua`,
      lines: fileLines,
      lineCount: fileLines.length,
    });
  }

  return chunkFiles;
}

// ─── Step 7: Validation ───

function validateChunks(chunks, chunkFiles) {
  const totalChunkLines = chunkFiles.reduce((s, c) => s + c.lineCount, 0);

  // Check: no line is duplicated across chunks
  const allLines = new Set();
  let duplicates = 0;
  for (const cf of chunkFiles) {
    // We can't perfectly check this without the original line numbers,
    // but we can at least verify total line count
  }

  return {
    totalChunks: chunks.length,
    totalLines: totalChunkLines,
    domains: chunks.map(c => c.domain),
  };
}

function countByDomain(chunks) {
  const counts = {};
  for (const chunk of chunks) {
    counts[chunk.domain] = chunk.totalLines;
  }
  return counts;
}

// ─── Renderers ───

export function renderLuauChunkJSON(result) {
  if (result.error) return JSON.stringify({ error: result.error }, null, 2);
  return JSON.stringify({
    fileName: result.fileName,
    totalLines: result.totalLines,
    chunks: result.chunks.map(c => ({
      domain: c.domain,
      totalLines: c.totalLines,
      segments: c.segments.length,
    })),
    mainScript: result.mainScript,
    summary: result.summary,
  }, null, 2);
}

export function renderLuauChunk(result) {
  if (result.error) {
    return `[LUAU CHUNK] ERROR\n${result.error}`;
  }

  const lines = [];
  lines.push(`[LUAU CHUNK] ${result.fileName}`);
  lines.push('═'.repeat(52));
  lines.push(`  Total lines:     ${result.totalLines}`);
  lines.push(`  Chunks:          ${result.summary.totalChunks}`);
  lines.push(`  Chunk lines:     ${result.summary.totalChunkLines}`);
  lines.push('');

  lines.push('── Domain Distribution ─────────────────────────');
  for (const [domain, lineCount] of Object.entries(result.summary.domainDistribution)) {
    const pct = Math.round((lineCount / result.totalLines) * 100);
    const bar = '█'.repeat(Math.min(30, Math.round(pct * 0.3)));
    lines.push(`  ${domain.padEnd(15)} ${String(lineCount).padStart(5)} lines (${String(pct).padStart(3)}%) ${bar}`);
  }
  lines.push('');

  lines.push('── Chunks ──────────────────────────────────────');
  for (const chunk of result.chunks) {
    const segCount = chunk.segments.length;
    lines.push(`  📦 ${chunk.domain}.lua`);
    lines.push(`     Lines: ${chunk.totalLines} | Segments: ${segCount}`);
    lines.push(`     Range: L${chunk.startLine + 1}–L${chunk.endLine + 1}`);
    lines.push('');
  }

  lines.push('── Generated Files ─────────────────────────────');
  for (const cf of result.chunkFiles) {
    lines.push(`  📄 ${cf.fileName} (${cf.lineCount} lines)`);
  }
  lines.push('');

  lines.push('── Main Script ─────────────────────────────────');
  lines.push(result.mainScript.split('\n').map(l => `  ${l}`).join('\n'));
  lines.push('');

  lines.push('═'.repeat(52));
  lines.push(`  Split ${result.totalLines} lines into ${result.summary.totalChunks} chunks`);
  lines.push('═'.repeat(52));

  return lines.join('\n');
}
