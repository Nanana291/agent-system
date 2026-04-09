#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

// ──────────────────────────────────────────────
// Luau UI Map — UI Structure Extractor
// ──────────────────────────────────────────────

export function runLuauUIMap(filePath) {
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    return { fileName: path.basename(filePath), error: `File not found: ${absPath}` };
  }

  const source = fs.readFileSync(absPath, 'utf8');
  const lines = source.split('\n');

  const framework = detectFramework(source);
  const tree = buildUITree(source, lines, framework);
  const controlStats = countControls(tree);
  const wiring = extractWiring(source, lines, framework);

  return {
    fileName: path.basename(filePath),
    filePath: absPath,
    totalLines: lines.length,
    framework,
    tree,
    controlStats,
    wiring,
  };
}

// ─── Framework Detection ───

function detectFramework(source) {
  if (/LibSixtyTen|createLibSixtyTen/.test(source)) return 'LibSixtyTen';
  if (/Obsidian|obsidian\.luau/.test(source)) return 'Obsidian';
  if (/OrionLib|loadstring.*Orion/.test(source)) return 'Orion';
  if (/FluentLua|Fluent/.test(source)) return 'Fluent';
  if (/RayField/.test(source)) return 'RayField';
  if (/CreateWindow|New.*Frame/.test(source)) return 'Custom';
  return 'Unknown';
}

// ─── UI Tree Building ───

function buildUITree(source, lines, framework) {
  const tree = { name: 'Root', type: 'root', children: [] };
  let currentTab = null;
  let currentSection = null;
  let currentSubsection = null;

  // Parse line by line to build hierarchy
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Tabs
    const tabMatch = line.match(/AddTab\s*\(\s*["']([^"']+)["']/);
    if (tabMatch) {
      currentTab = { name: tabMatch[1], type: 'tab', line: i + 1, children: [] };
      tree.children.push(currentTab);
      currentSection = null;
      currentSubsection = null;
      continue;
    }

    // Sections
    const sectionMatch = line.match(/BuildSection\s*\(\s*\{[^}]*Title\s*=\s*["']([^"']+)["']/);
    const obsSectionMatch = line.match(/CreateSection\s*\(\s*["']([^"']+)["']/);
    const sectionName = sectionMatch?.[1] || obsSectionMatch?.[1];

    if (sectionName) {
      currentSection = { name: sectionName, type: 'section', line: i + 1, children: [] };
      if (currentTab) currentTab.children.push(currentSection);
      else tree.children.push(currentSection);
      currentSubsection = null;
      continue;
    }

    // Controls
    const control = parseControl(line, i + 1, framework);
    if (control) {
      const target = currentSubsection || currentSection || currentTab || tree;
      target.children.push(control);
    }

    // Dropdown items (sub-controls)
    const dropdownItem = parseDropdownItem(line, i + 1);
    if (dropdownItem && currentSection) {
      // Attach to last dropdown in current section
      const lastDropdown = findLast(currentSection.children, c => c.type === 'dropdown');
      if (lastDropdown) {
        if (!lastDropdown.children) lastDropdown.children = [];
        lastDropdown.children.push(dropdownItem);
      }
    }
  }

  return tree;
}

function parseControl(line, lineNum, framework) {
  // BuildToggle({ Title = "Auto Block", Default = false })
  const toggleMatch = line.match(/BuildToggle\s*\(\s*\{[^}]*Title\s*=\s*["']([^"']+)["']/);
  if (toggleMatch) {
    const defaultMatch = line.match(/Default\s*=\s*(true|false)/);
    return {
      name: toggleMatch[1],
      type: 'toggle',
      line: lineNum,
      default: defaultMatch ? defaultMatch[1] === 'true' : null,
    };
  }

  // CreateToggle({ Name = "Auto Block" })
  const createToggleMatch = line.match(/CreateToggle\s*\(\s*\{[^}]*Name\s*=\s*["']([^"']+)["']/);
  if (createToggleMatch) {
    return { name: createToggleMatch[1], type: 'toggle', line: lineNum };
  }

  // BuildDropdown({ Title = "Mode", Options = {...} })
  const dropdownMatch = line.match(/BuildDropdown\s*\(\s*\{[^}]*Title\s*=\s*["']([^"']+)["']/);
  if (dropdownMatch) {
    const optionsMatch = line.match(/Options\s*=\s*\{([^}]*)\}/);
    const options = optionsMatch
      ? optionsMatch[1].split(',').map(s => s.trim().replace(/["']/g, '')).filter(Boolean)
      : [];
    return { name: dropdownMatch[1], type: 'dropdown', line: lineNum, options };
  }

  // BuildSlider({ Title = "WalkSpeed", Default = 16, Min = 0, Max = 500 })
  const sliderMatch = line.match(/BuildSlider\s*\(\s*\{[^}]*Title\s*=\s*["']([^"']+)["']/);
  if (sliderMatch) {
    const defaultMatch = line.match(/Default\s*=\s*(\d+)/);
    const minMatch = line.match(/Min\s*=\s*(\d+)/);
    const maxMatch = line.match(/Max\s*=\s*(\d+)/);
    return {
      name: sliderMatch[1],
      type: 'slider',
      line: lineNum,
      default: defaultMatch ? parseInt(defaultMatch[1]) : null,
      min: minMatch ? parseInt(minMatch[1]) : null,
      max: maxMatch ? parseInt(maxMatch[1]) : null,
    };
  }

  // BuildButton({ Title = "Execute" })
  const buttonMatch = line.match(/BuildButton\s*\(\s*\{[^}]*Title\s*=\s*["']([^"']+)["']/);
  if (buttonMatch) {
    return { name: buttonMatch[1], type: 'button', line: lineNum };
  }

  // BuildLabel({ Title = "..." })
  const labelMatch = line.match(/BuildLabel\s*\(\s*\{[^}]*Title\s*=\s*["']([^"']+)["']/);
  if (labelMatch) {
    return { name: labelMatch[1], type: 'label', line: lineNum };
  }

  // BuildKeybind({ Title = "..." })
  const keybindMatch = line.match(/BuildKeybind\s*\(\s*\{[^}]*Title\s*=\s*["']([^"']+)["']/);
  if (keybindMatch) {
    return { name: keybindMatch[1], type: 'keybind', line: lineNum };
  }

  // Obsidian controls
  const obsToggle = line.match(/Toggle\s*\(\s*\{[^}]*Name\s*=\s*["']([^"']+)["']/);
  if (obsToggle) return { name: obsToggle[1], type: 'toggle', line: lineNum };

  return null;
}

function parseDropdownItem(line, lineNum) {
  // Dropdown items are typically just string literals inside Options = {...}
  // But can also be separate AddOption calls
  const optionMatch = line.match(/AddOption\s*\(\s*["']([^"']+)["']/);
  if (optionMatch) {
    return { name: optionMatch[1], type: 'dropdown-item', line: lineNum };
  }
  return null;
}

function findLast(arr, predicate) {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (predicate(arr[i])) return arr[i];
  }
  return null;
}

// ─── Control Statistics ───

function countControls(tree) {
  const counts = {};
  const total = countRecursive(tree, counts);
  return { total: total - 1, byType: counts }; // -1 for root
}

function countRecursive(node, counts) {
  let total = 1;
  for (const child of node.children) {
    counts[child.type] = (counts[child.type] || 0) + 1;
    total += countRecursive(child, counts);
  }
  return total;
}

// ─── Wiring Extraction ───

function extractWiring(source, lines, framework) {
  const wiring = [];

  // Find .Changed:Connect patterns
  const changedRegex = /([\w.]+)\.Changed\s*:\s*Connect\s*\(/g;
  let match;
  while ((match = changedRegex.exec(source)) !== null) {
    const lineNum = source.slice(0, match.index).split('\n').length;
    wiring.push({
      type: 'Changed',
      target: match[1],
      line: lineNum,
    });
  }

  // Find .MouseButton1Click:Connect patterns
  const clickRegex = /([\w.]+)\.MouseButton1Click\s*:\s*Connect\s*\(/g;
  while ((match = clickRegex.exec(source)) !== null) {
    const lineNum = source.slice(0, match.index).split('\n').length;
    wiring.push({
      type: 'Click',
      target: match[1],
      line: lineNum,
    });
  }

  // Find Callback = function patterns
  const callbackRegex = /Callback\s*=\s*function/g;
  while ((match = callbackRegex.exec(source)) !== null) {
    const lineNum = source.slice(0, match.index).split('\n').length;
    wiring.push({
      type: 'Callback',
      line: lineNum,
    });
  }

  // Find taskSpawn loops triggered by toggles
  const spawnRegex = /taskSpawn\s*\(\s*function/g;
  while ((match = spawnRegex.exec(source)) !== null) {
    const lineNum = source.slice(0, match.index).split('\n').length;
    wiring.push({
      type: 'taskSpawn',
      line: lineNum,
    });
  }

  return {
    total: wiring.length,
    byType: countWiringTypes(wiring),
    wiring,
  };
}

function countWiringTypes(wiring) {
  const counts = {};
  for (const w of wiring) {
    counts[w.type] = (counts[w.type] || 0) + 1;
  }
  return counts;
}

// ─── Renderer ───

export function renderLuauUIMap(result) {
  if (result.error) {
    return `[LUAU UI MAP] ERROR\n${result.error}`;
  }

  const lines = [];
  lines.push(`[LUAU UI MAP] ${result.fileName}`);
  lines.push('═'.repeat(52));
  lines.push(`  Framework:       ${result.framework}`);
  lines.push(`  Total lines:     ${result.totalLines}`);
  lines.push(`  Total controls:  ${result.controlStats.total}`);
  lines.push('');

  // Control type breakdown
  lines.push('── Controls by Type ─────────────────────────────');
  for (const [type, count] of Object.entries(result.controlStats.byType).sort((a, b) => b[1] - a[1])) {
    lines.push(`  ${type}:  ${count}`);
  }
  lines.push('');

  // UI Tree
  lines.push('── UI Hierarchy ─────────────────────────────────');
  renderTreeNode(lines, result.tree, '', true);
  lines.push('');

  // Wiring
  if (result.wiring.total > 0) {
    lines.push('── Event Wiring ──────────────────────────────────');
    lines.push(`  Total connections: ${result.wiring.total}`);
    for (const [type, count] of Object.entries(result.wiring.byType)) {
      lines.push(`  ${type}:  ${count}`);
    }
    lines.push('');
  }

  lines.push('═'.repeat(52));
  return lines.join('\n');
}

function renderTreeNode(lines, node, prefix, isLast) {
  if (node.type === 'root') {
    // Render children of root directly
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      const isLastChild = i === node.children.length - 1;
      renderTreeNode(lines, child, '', isLastChild);
    }
    return;
  }

  const connector = isLast ? '└── ' : '├── ';
  const typeIcon = {
    tab: '📑',
    section: '📂',
    toggle: '🔘',
    dropdown: '📋',
    'dropdown-item': '  •',
    slider: '📊',
    button: '🔲',
    label: '📝',
    keybind: '⌨️',
  }[node.type] || '·';

  const lineInfo = node.line ? ` (L${node.line})` : '';
  let extra = '';

  if (node.type === 'slider' && node.default !== null) {
    extra = ` [${node.min ?? '?'}/${node.default}/${node.max ?? '?'}]`;
  }
  if (node.type === 'toggle' && node.default !== null) {
    extra = ` [${node.default ? 'ON' : 'OFF'}]`;
  }
  if (node.type === 'dropdown' && node.options?.length > 0) {
    extra = ` [${node.options.join(', ')}]`;
  }

  lines.push(`${prefix}${connector}${typeIcon} ${node.name}${lineInfo}${extra}`);

  // Render children
  const childPrefix = prefix + (isLast ? '    ' : '│   ');
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    const isLastChild = i === node.children.length - 1;
    renderTreeNode(lines, child, childPrefix, isLastChild);
  }
}
