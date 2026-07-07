import Phaser from 'phaser';
import './styles.css';

type Direction = 'N' | 'S' | 'E' | 'W';

type Vec2 = {
  x: number;
  y: number;
};

type Rect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type Cell = {
  x: number;
  y: number;
};

type ShapeButton = {
  type: 'rowWidth' | 'columnHeight';
  index: number;
  delta: -1 | 1;
};

type JetMount = {
  wallX: number;
  wallY: number;
  direction: Direction;
};

type Jet = JetMount & {
  presetId: PresetId;
  angleOffset: number;
  age: number;
  power: number;
  range: number;
  streamWidth: number;
  basePower: number;
  baseRange: number;
  baseStreamWidth: number;
  powerDecay: number;
  rangeDecay: number;
  widthDecay: number;
  decayEase: number;
};

type Controls = {
  gridColumns: number;
  gridRows: number;
  jetPower: number;
  powerDecay: number;
  decayEase: number;
  jetRange: number;
  rangeDecay: number;
  streamWidth: number;
  widthDecay: number;
  waterDrag: number;
  bounciness: number;
  showDebugOverlay: boolean;
};

type PresetId =
  | 'jet1'
  | 'jet2'
  | 'jet3'
  | 'jet4'
  | 'bomb1'
  | 'bomb2'
  | 'bomb3'
  | 'bomb4'
  | 'bouncer';
type JetBehavior = 'jet' | 'bomb' | 'bouncer';
type ActionMode = 'add' | 'remove';

type JetPreset = Pick<
  Controls,
  | 'jetPower'
  | 'powerDecay'
  | 'decayEase'
  | 'jetRange'
  | 'rangeDecay'
  | 'streamWidth'
  | 'widthDecay'
  | 'waterDrag'
  | 'bounciness'
> & {
  id: PresetId;
  behavior: JetBehavior;
  label: string;
  shortLabel: string;
  description: string;
  color: number;
  baseCost: number;
  powerLevel: number;
};

type InventorySlot = Record<string, never>;

type LevelRoom = Cell & {
  id: number;
  rx: number;
  ry: number;
};

type GeneratedLevel = {
  seed: number;
  name: string;
  mask: Uint8Array;
  start: Cell;
  goal: Cell;
  stats: {
    attempts: number;
    rooms: number;
    waterTiles: number;
    reachableWater: number;
    jetSlots: number;
    loops: number;
    checksum: number;
    genMs: number;
  };
};

const maxWaterColumns = 10;
const maxWaterRows = 10;
const cellSize = 56;
const tuberRadiusCells = 0.34;
const origin = { x: 36, y: 36 };
const boardOrigin = { ...origin };
const boardPixelWidth = (maxWaterColumns + 2) * cellSize;
const boardPixelHeight = (maxWaterRows + 2) * cellSize;
const inventoryGap = 18;
const inventoryHeight = 300;
const powerBudget = 12;
const anglePowerSurcharge = 2;
const aimStepRadians = Math.PI / 8;
const aimMaxRadians = Math.PI / 4;
const aimOffsets = [-aimMaxRadians, -aimStepRadians, 0, aimStepRadians, aimMaxRadians] as const;
const jetRetireRangeCells = 0.75;
const jetRetirePowerRatio = 0.16;
const jetRetireVisualEnergy = 0.18;
const jetRetireStreamWidthCells = 0.12;
const cornerSlideStepCells = 0.04;
const cornerSlideAttempts = 7;
const cornerSlideVelocityKeep = 0.65;
const minimumWallBounceSpeed = 0.9;
const cornerSlideVelocityIntent = 0.04;
const cornerSlideForceIntent = 0.25;
const allowManualShapeEditing = false;
const canvasWidth = origin.x * 2 + boardPixelWidth;
const canvasHeight = origin.y * 2 + boardPixelHeight + inventoryGap + inventoryHeight;

// These are WATER counts. Wall cells are generated around the resulting water shape.
const rowWidths = Array.from({ length: maxWaterRows }, () => maxWaterColumns);
const columnHeights = Array.from({ length: maxWaterColumns }, () => maxWaterRows);
let customWaterMask: Uint8Array | null = null;
let currentLevelName = 'Manual basin';
let currentGeneratorStats = 'Manual editor mode.';

const directionVectors: Record<Direction, Vec2> = {
  N: { x: 0, y: -1 },
  S: { x: 0, y: 1 },
  E: { x: 1, y: 0 },
  W: { x: -1, y: 0 }
};

const controls: Controls = {
  gridColumns: 10,
  gridRows: 8,
  jetPower: 8,
  powerDecay: 0.9,
  decayEase: 1.8,
  jetRange: 7,
  rangeDecay: 0.65,
  streamWidth: 1.4,
  widthDecay: 0.55,
  waterDrag: 0.65,
  bounciness: 0.82,
  showDebugOverlay: true
};

const presetIds = [
  'jet1',
  'jet2',
  'jet3',
  'jet4',
  'bomb1',
  'bomb2',
  'bomb3',
  'bomb4',
  'bouncer'
] as const satisfies readonly PresetId[];
let selectedActionMode: ActionMode = 'add';

const jetPresets: Record<PresetId, JetPreset> = {
  jet1: {
    id: 'jet1',
    behavior: 'jet',
    label: 'Jet P1',
    shortLabel: 'J1',
    description: '1-cell push',
    color: 0x7cecff,
    baseCost: 1,
    powerLevel: 1,
    jetPower: 2,
    powerDecay: 0.9,
    decayEase: 2.3,
    jetRange: 1.5,
    rangeDecay: 0.62,
    streamWidth: 1.15,
    widthDecay: 0.42,
    waterDrag: 0.65,
    bounciness: 0.82
  },
  jet2: {
    id: 'jet2',
    behavior: 'jet',
    label: 'Jet P2',
    shortLabel: 'J2',
    description: '2-cell push',
    color: 0x7cecff,
    baseCost: 2,
    powerLevel: 2,
    jetPower: 4,
    powerDecay: 0.9,
    decayEase: 2.3,
    jetRange: 3,
    rangeDecay: 0.62,
    streamWidth: 1.15,
    widthDecay: 0.42,
    waterDrag: 0.65,
    bounciness: 0.82
  },
  jet3: {
    id: 'jet3',
    behavior: 'jet',
    label: 'Jet P3',
    shortLabel: 'J3',
    description: '3-cell push',
    color: 0x7cecff,
    baseCost: 3,
    powerLevel: 3,
    jetPower: 6,
    powerDecay: 0.9,
    decayEase: 2.3,
    jetRange: 4.5,
    rangeDecay: 0.62,
    streamWidth: 1.15,
    widthDecay: 0.42,
    waterDrag: 0.65,
    bounciness: 0.82
  },
  jet4: {
    id: 'jet4',
    behavior: 'jet',
    label: 'Jet P4',
    shortLabel: 'J4',
    description: 'full straight shot',
    color: 0x7cecff,
    baseCost: 4,
    powerLevel: 4,
    jetPower: 8,
    powerDecay: 0.9,
    decayEase: 2.3,
    jetRange: 6,
    rangeDecay: 0.62,
    streamWidth: 1.15,
    widthDecay: 0.42,
    waterDrag: 0.65,
    bounciness: 0.82
  },
  bomb1: {
    id: 'bomb1',
    behavior: 'bomb',
    label: 'Bomb P1',
    shortLabel: 'B1',
    description: '1 ripple',
    color: 0xfff36d,
    baseCost: 3,
    powerLevel: 1,
    jetPower: 2.2,
    powerDecay: 1.05,
    decayEase: 2,
    jetRange: 2.2,
    rangeDecay: 0.72,
    streamWidth: 1.4,
    widthDecay: 0.48,
    waterDrag: 0.65,
    bounciness: 0.82
  },
  bomb2: {
    id: 'bomb2',
    behavior: 'bomb',
    label: 'Bomb P2',
    shortLabel: 'B2',
    description: '2 ripples',
    color: 0xfff36d,
    baseCost: 6,
    powerLevel: 2,
    jetPower: 3.6,
    powerDecay: 1.05,
    decayEase: 2,
    jetRange: 3,
    rangeDecay: 0.72,
    streamWidth: 1.75,
    widthDecay: 0.48,
    waterDrag: 0.65,
    bounciness: 0.82
  },
  bomb3: {
    id: 'bomb3',
    behavior: 'bomb',
    label: 'Bomb P3',
    shortLabel: 'B3',
    description: '3 ripples',
    color: 0xfff36d,
    baseCost: 9,
    powerLevel: 3,
    jetPower: 4.8,
    powerDecay: 1.05,
    decayEase: 2,
    jetRange: 3.8,
    rangeDecay: 0.72,
    streamWidth: 2.1,
    widthDecay: 0.48,
    waterDrag: 0.65,
    bounciness: 0.82
  },
  bomb4: {
    id: 'bomb4',
    behavior: 'bomb',
    label: 'Bomb P4',
    shortLabel: 'B4',
    description: '4 ripples',
    color: 0xfff36d,
    baseCost: 12,
    powerLevel: 4,
    jetPower: 5.8,
    powerDecay: 1.05,
    decayEase: 2,
    jetRange: 4.6,
    rangeDecay: 0.72,
    streamWidth: 2.45,
    widthDecay: 0.48,
    waterDrag: 0.65,
    bounciness: 0.82
  },
  bouncer: {
    id: 'bouncer',
    behavior: 'bouncer',
    label: 'Bouncer',
    shortLabel: 'BO',
    description: '10-cell launch',
    color: 0xa6ff8f,
    baseCost: 8,
    powerLevel: 4,
    jetPower: 18,
    powerDecay: 1.15,
    decayEase: 2.1,
    jetRange: 10,
    rangeDecay: 0.82,
    streamWidth: 1.5,
    widthDecay: 0.52,
    waterDrag: 0.55,
    bounciness: 0.9
  }
};

const readout = document.querySelector<HTMLDivElement>('#readout');
const selectedJetStatus = document.querySelector<HTMLParagraphElement>('#selectedJetStatus');
const generatorStatus = document.querySelector<HTMLParagraphElement>('#generatorStatus');

const tunableSliderIds = [
  'jetPower',
  'powerDecay',
  'decayEase',
  'jetRange',
  'rangeDecay',
  'streamWidth',
  'widthDecay',
  'waterDrag',
  'bounciness'
] as const satisfies Array<keyof Controls>;

const defaultSliderRanges = Object.fromEntries(
  tunableSliderIds.map((id) => {
    const input = document.querySelector<HTMLInputElement>(`#${id}`);
    if (!input) {
      throw new Error(`Missing slider ${id}`);
    }

    return [
      id,
      {
        min: Number(input.min),
        max: Number(input.max)
      }
    ];
  })
) as Record<(typeof tunableSliderIds)[number], { min: number; max: number }>;

function bindRange(id: keyof Controls, decimals = 2): void {
  const input = document.querySelector<HTMLInputElement>(`#${id}`);
  const output = document.querySelector<HTMLOutputElement>(`#${id}Value`);

  if (!input || !output) {
    throw new Error(`Missing control ${id}`);
  }

  const sync = () => {
    controls[id] = Number(input.value) as never;
    output.value = Number(input.value).toFixed(decimals);
  };

  input.addEventListener('input', sync);
  sync();
}

function bindCheckbox(id: keyof Controls): void {
  const input = document.querySelector<HTMLInputElement>(`#${id}`);

  if (!input) {
    throw new Error(`Missing checkbox ${id}`);
  }

  const sync = () => {
    controls[id] = input.checked as never;
  };

  input.addEventListener('input', sync);
  sync();
}

function setSliderValue(id: keyof Controls, value: number): void {
  const input = document.querySelector<HTMLInputElement>(`#${id}`);

  if (!input) {
    throw new Error(`Missing slider ${id}`);
  }

  input.value = String(clamp(value, Number(input.min), Number(input.max)));
  input.dispatchEvent(new Event('input'));
}

function setupPresets(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((button) => {
    button.addEventListener('click', () => {
      const presetId = button.dataset.preset as PresetId;
      if (!jetPresets[presetId]) {
        return;
      }

      applyPresetToSliders(presetId);
    });
  });
}

function setupGeneratorControls(): void {
  const seedInput = document.querySelector<HTMLInputElement>('#levelSeed');
  const generateButton = document.querySelector<HTMLButtonElement>('#generateLevel');
  const randomSeedButton = document.querySelector<HTMLButtonElement>('#randomSeed');

  if (!seedInput || !generateButton || !randomSeedButton) {
    throw new Error('Missing procedural generator controls');
  }

  const dispatchGenerate = () => {
    const seed = Number(seedInput.value);
    window.dispatchEvent(
      new CustomEvent('aquerra:generate-level', {
        detail: Number.isFinite(seed) ? Math.trunc(seed) : 1337
      })
    );
  };

  generateButton.addEventListener('click', dispatchGenerate);
  randomSeedButton.addEventListener('click', () => {
    seedInput.value = String(Math.floor(Math.random() * 999_999_999));
    dispatchGenerate();
  });
}

function setupActionControls(): void {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-action-mode]'));

  const sync = () => {
    for (const button of buttons) {
      const isActive = button.dataset.actionMode === selectedActionMode;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    }
  };

  for (const button of buttons) {
    button.addEventListener('click', () => {
      const mode = button.dataset.actionMode as ActionMode;
      if (mode !== 'add' && mode !== 'remove') {
        return;
      }

      selectedActionMode = mode;
      sync();
    });
  }

  sync();
}

function applyPresetToSliders(presetId: PresetId): void {
  const preset = jetPresets[presetId];

  for (const id of tunableSliderIds) {
    setSliderValue(id, preset[id]);
  }
}

function setupRangeEditor(): void {
  const fields = document.querySelector<HTMLDivElement>('#rangeEditorFields');
  const resetButton = document.querySelector<HTMLButtonElement>('#resetSliderRanges');

  if (!fields || !resetButton) {
    throw new Error('Missing range editor UI');
  }

  for (const id of tunableSliderIds) {
    const slider = document.querySelector<HTMLInputElement>(`#${id}`);
    if (!slider) {
      throw new Error(`Missing slider ${id}`);
    }

    const row = document.createElement('div');
    row.className = 'range-editor-row';

    const label = document.createElement('span');
    label.textContent = slider.closest('label')?.childNodes[0]?.textContent?.trim() || id;

    const min = document.createElement('input');
    min.type = 'number';
    min.id = `${id}Min`;
    min.step = slider.step || '0.05';
    min.value = slider.min;
    min.setAttribute('aria-label', `${label.textContent} minimum`);

    const max = document.createElement('input');
    max.type = 'number';
    max.id = `${id}Max`;
    max.step = slider.step || '0.05';
    max.value = slider.max;
    max.setAttribute('aria-label', `${label.textContent} maximum`);

    const syncSliderRange = () => {
      const minValue = Number(min.value);
      const maxValue = Number(max.value);

      if (!Number.isFinite(minValue) || !Number.isFinite(maxValue) || maxValue <= minValue) {
        return;
      }

      slider.min = String(minValue);
      slider.max = String(maxValue);
      slider.value = String(clamp(Number(slider.value), minValue, maxValue));
      slider.dispatchEvent(new Event('input'));
    };

    min.addEventListener('input', syncSliderRange);
    max.addEventListener('input', syncSliderRange);

    row.append(label, min, max);
    fields.append(row);
  }

  resetButton.addEventListener('click', () => {
    for (const id of tunableSliderIds) {
      const slider = document.querySelector<HTMLInputElement>(`#${id}`);
      const min = document.querySelector<HTMLInputElement>(`#${id}Min`);
      const max = document.querySelector<HTMLInputElement>(`#${id}Max`);
      const defaults = defaultSliderRanges[id];

      if (!slider || !min || !max) {
        continue;
      }

      min.value = String(defaults.min);
      max.value = String(defaults.max);
      slider.min = String(defaults.min);
      slider.max = String(defaults.max);
      slider.value = String(clamp(Number(slider.value), defaults.min, defaults.max));
      slider.dispatchEvent(new Event('input'));
    }
  });
}

bindRange('gridColumns', 0);
bindRange('gridRows', 0);
bindRange('jetPower');
bindRange('powerDecay');
bindRange('decayEase');
bindRange('jetRange');
bindRange('rangeDecay');
bindRange('streamWidth');
bindRange('widthDecay');
bindRange('waterDrag');
bindRange('bounciness');
bindCheckbox('showDebugOverlay');
setupRangeEditor();
setupPresets();
setupGeneratorControls();
setupActionControls();

class PrototypeScene extends Phaser.Scene {
  private readonly tuber = {
    position: centeredStartPosition(),
    velocity: { x: 0, y: 0 }
  };

  private readonly jets: Jet[] = [];
  private readonly inventory = createInventory();
  private readonly inventoryTexts = new Map<PresetId, Phaser.GameObjects.Text>();

  private graphics!: Phaser.GameObjects.Graphics;
  private inventoryTitleText?: Phaser.GameObjects.Text;
  private inventoryHintText?: Phaser.GameObjects.Text;
  private lastForce: Vec2 = { x: 0, y: 0 };
  private hoverMount: JetMount | null = null;
  private hoverBombCell: Cell | null = null;
  private hoverShapeButton: ShapeButton | null = null;
  private hoverInventoryPreset: PresetId | null = null;
  private selectedJet: Jet | null = null;
  private selectedPreset: PresetId = 'jet4';
  private goal = centeredGoalPosition();
  private goalReached = false;
  private currentSeed = 1337;
  private winQueued = false;
  private flowActive = false;

  constructor() {
    super('PrototypeScene');
  }

  create(): void {
    this.graphics = this.add.graphics();
    this.setupInventoryText();
    this.game.canvas.addEventListener('contextmenu', (event) => event.preventDefault());

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.hoverInventoryPreset = hitInventorySlot(pointer.x, pointer.y);
      this.hoverShapeButton = this.hoverInventoryPreset ? null : hitShapeButton(pointer.x, pointer.y);
      this.hoverBombCell =
        this.hoverInventoryPreset || this.hoverShapeButton || !isBombPreset(this.selectedPreset)
          ? null
          : findWaterCellAt(pointer.x, pointer.y);
      this.hoverMount =
        this.hoverInventoryPreset || this.hoverShapeButton || isBombPreset(this.selectedPreset)
          ? null
          : findJetMountAt(pointer.x, pointer.y);
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const event = pointer.event as MouseEvent | undefined;
      const inventoryPreset = hitInventorySlot(pointer.x, pointer.y);

      if (inventoryPreset) {
        this.selectedPreset = inventoryPreset;
        return;
      }

      const shapeButton = allowManualShapeEditing ? hitShapeButton(pointer.x, pointer.y) : null;

      if (shapeButton) {
        this.updateShapeFromButton(shapeButton);
        return;
      }

      const gridPos = screenToGrid(pointer.x, pointer.y);
      const cellX = Math.floor(gridPos.x);
      const cellY = Math.floor(gridPos.y);
      const shouldMoveTuber = event?.button === 2 || event?.shiftKey === true;
      const hitJet = this.findJetAt(pointer.x, pointer.y);

      if (hitJet) {
        if (selectedActionMode === 'remove') {
          this.deleteJet(hitJet);
          return;
        }

        if (isBombPreset(hitJet.presetId)) {
          this.selectedJet = hitJet;
          this.setFlowActive(false);
          return;
        }

        this.cycleJetAim(hitJet);
        this.selectedJet = hitJet;
        this.setFlowActive(false);
        return;
      }

      if (event?.altKey === true) {
        if (isWaterCell(cellX, cellY)) {
          this.placeGoal(cellX, cellY);
        }
        return;
      }

      if (shouldMoveTuber) {
        if (isWaterCell(cellX, cellY)) {
          this.placeTuber(cellX, cellY);
        }
        return;
      }

      if (selectedActionMode === 'add' && isBombPreset(this.selectedPreset) && isWaterCell(cellX, cellY)) {
        if (!this.spendInventory(this.selectedPreset)) {
          return;
        }

        const jet = makeBomb({ x: cellX, y: cellY }, this.selectedPreset);
        this.jets.push(jet);
        this.selectedJet = jet;
        this.setFlowActive(false);
        return;
      }

      const mount = findJetMountAt(pointer.x, pointer.y);
      if (mount) {
        if (selectedActionMode !== 'add') {
          return;
        }

        if (!this.spendInventory(this.selectedPreset)) {
          return;
        }

        const jet = makeJet(mount, this.selectedPreset);
        this.jets.push(jet);
        this.selectedJet = jet;
        this.setFlowActive(false);
      }
    });

    document.querySelector<HTMLButtonElement>('#toggleFlow')?.addEventListener('click', () => {
      this.setFlowActive(!this.flowActive);
    });
    document.querySelector('#resetTuber')?.addEventListener('click', () => this.resetTuber());
    document.querySelector('#clearJets')?.addEventListener('click', () => {
      this.clearJets(true);
    });
    document.querySelector('#resetShape')?.addEventListener('click', () => this.resetShape());
    document.querySelector('#resetGoal')?.addEventListener('click', () => this.resetGoal());
    document.querySelector('#applySelectedJet')?.addEventListener('click', () => this.applySlidersToSelectedJet());
    document.querySelector('#deleteSelectedJet')?.addEventListener('click', () => this.deleteSelectedJet());
    window.addEventListener('aquerra:generate-level', (event) => {
      const seed = (event as CustomEvent<number>).detail;
      this.applyGeneratedLevel(generatePuzzleLevel(seed));
    });
    this.applyGeneratedLevel(generatePuzzleLevel(this.currentSeed));
  }

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 1 / 30);

    normalizeShape();
    this.updateInventory();
    this.keepEntitiesInsideShape();
    if (this.flowActive) {
      this.decayJets(dt);
    }
    this.stepSimulation(dt);
    this.draw();
    this.updateReadout();
  }

  private resetTuber(): void {
    this.tuber.position = centeredStartPosition();
    this.tuber.velocity = { x: 0, y: 0 };
  }

  private placeTuber(cellX: number, cellY: number): void {
    this.tuber.position = { x: cellX + 0.5, y: cellY + 0.5 };
    this.tuber.velocity = { x: 0, y: 0 };
  }

  private placeGoal(cellX: number, cellY: number): void {
    this.goal = { x: cellX + 0.5, y: cellY + 0.5 };
    this.goalReached = false;
  }

  private resetGoal(): void {
    this.goal = centeredGoalPosition();
    this.goalReached = false;
  }

  private resetShape(): void {
    customWaterMask = null;
    currentLevelName = 'Manual basin';
    currentGeneratorStats = 'Manual editor mode.';
    if (generatorStatus) {
      generatorStatus.textContent = currentGeneratorStats;
    }

    for (let y = 0; y < maxWaterRows; y += 1) {
      rowWidths[y] = controls.gridColumns;
    }

    for (let x = 0; x < maxWaterColumns; x += 1) {
      columnHeights[x] = controls.gridRows;
    }

    normalizeShape();
    this.keepEntitiesInsideShape();
  }

  private applyGeneratedLevel(level: GeneratedLevel): void {
    customWaterMask = level.mask;
    this.currentSeed = level.seed;
    this.winQueued = false;
    currentLevelName = level.name;
    currentGeneratorStats = `Seed ${level.seed} · ${level.stats.waterTiles} water · ${level.stats.jetSlots} jet slots · ${level.stats.loops} loop · ${level.stats.genMs.toFixed(1)}ms`;

    if (generatorStatus) {
      generatorStatus.textContent = `${level.name} — ${currentGeneratorStats}`;
    }

    syncShapeExtentsFromMask(level.mask);
    this.clearJets(false);
    resetInventory(this.inventory);
    this.selectedJet = null;
    this.tuber.position = { x: level.start.x + 0.5, y: level.start.y + 0.5 };
    this.tuber.velocity = { x: 0, y: 0 };
    this.goal = { x: level.goal.x + 0.5, y: level.goal.y + 0.5 };
    this.goalReached = false;
    this.setFlowActive(false);

    console.info('[Aquerra generator]', level.name, level.stats);
  }

  private setupInventoryText(): void {
    const panel = inventoryPanelRect();
    this.inventoryTitleText = this.add.text(panel.left + 14, panel.top + 12, 'Jet stock', {
      color: '#ffe9fb',
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '18px',
      fontStyle: 'bold'
    });

    this.inventoryHintText = this.add.text(panel.left + 14, panel.top + panel.height - 24, 'Tap stock to choose', {
      color: '#b8c2d8',
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '12px'
    });

    for (const presetId of presetIds) {
      const rect = inventorySlotRect(presetId);
      const text = this.add.text(rect.left + 54, rect.top + 14, '', {
        color: '#f4f7fb',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '13px',
        lineSpacing: 3
      });
      this.inventoryTexts.set(presetId, text);
    }
  }

  private updateInventory(): void {
    // Power is derived from placed tools, so there is no per-type stock to update.
  }

  private spendInventory(presetId: PresetId): boolean {
    if (powerUsed(this.jets) + jetCost(presetId) > powerBudget) {
      return false;
    }

    return true;
  }

  private refundPower(_presetId: PresetId): void {
    // Deleting a tool simply frees its power cost.
  }

  private clearJets(refundPressure: boolean): void {
    for (let i = this.jets.length - 1; i >= 0; i -= 1) {
      this.removeJetAt(i, refundPressure);
    }
  }

  private updateShapeFromButton(button: ShapeButton): void {
    if (customWaterMask) {
      customWaterMask = null;
      currentLevelName = 'Manual edit from generated basin';
      currentGeneratorStats = 'Generated mask cleared by wall arrow edit.';
      if (generatorStatus) {
        generatorStatus.textContent = currentGeneratorStats;
      }
    }

    if (button.type === 'rowWidth') {
      rowWidths[button.index] += button.delta;
      normalizeShape();
      return;
    }

    columnHeights[button.index] += button.delta;
    normalizeShape();
  }

  private keepEntitiesInsideShape(): void {
    if (!isTuberFullyInWater(this.tuber.position)) {
      this.tuber.position = nearestWaterCellCenter(this.tuber.position);
      this.tuber.velocity = { x: 0, y: 0 };
    }

    if (!isWaterPoint(this.goal)) {
      this.resetGoal();
    }

    for (let i = this.jets.length - 1; i >= 0; i -= 1) {
      const jet = this.jets[i];
      if (!isValidPlacedJet(jet)) {
        this.removeJetAt(i, true);
      }
    }
  }

  private decayJets(dt: number): void {
    for (let i = this.jets.length - 1; i >= 0; i -= 1) {
      const jet = this.jets[i];
      jet.age += dt;
      jet.power = jet.basePower * easedDecay(jet.age, jet.powerDecay, jet.decayEase);
      jet.range = jet.baseRange * easedDecay(jet.age, jet.rangeDecay, jet.decayEase);
      jet.streamWidth = jet.baseStreamWidth * easedDecay(jet.age, jet.widthDecay, jet.decayEase);

      if (shouldRetireJet(jet)) {
        this.removeJetAt(i, true);
      }
    }
  }

  private stepSimulation(dt: number): void {
    if (!isTuberFullyInWater(this.tuber.position)) {
      this.tuber.velocity = { x: 0, y: 0 };
      this.lastForce = { x: 0, y: 0 };
      return;
    }

    const force = this.flowActive
      ? this.jets.reduce(
          (total, jet) => {
            const jetForce = getJetForce(jet, this.tuber.position, this.tuber.velocity);
            total.x += jetForce.x;
            total.y += jetForce.y;
            return total;
          },
          { x: 0, y: 0 }
        )
      : { x: 0, y: 0 };

    this.lastForce = force;
    this.tuber.velocity.x += force.x * dt;
    this.tuber.velocity.y += force.y * dt;

    const dragFactor = Math.max(0, 1 - controls.waterDrag * dt);
    this.tuber.velocity.x *= dragFactor;
    this.tuber.velocity.y *= dragFactor;

    const nextPosition = {
      x: this.tuber.position.x + this.tuber.velocity.x * dt,
      y: this.tuber.position.y + this.tuber.velocity.y * dt
    };

    this.moveAxis('x', nextPosition.x);
    this.moveAxis('y', nextPosition.y);
    this.goalReached = Math.hypot(this.tuber.position.x - this.goal.x, this.tuber.position.y - this.goal.y) < 0.45;
    if (this.goalReached && !this.winQueued) {
      this.queueWinAndNextLevel();
    }
  }

  private queueWinAndNextLevel(): void {
    this.winQueued = true;
    currentGeneratorStats = `You won! Generating basin ${this.currentSeed + 1}...`;
    if (generatorStatus) {
      generatorStatus.textContent = currentGeneratorStats;
    }

    this.time.delayedCall(1200, () => {
      const nextSeed = this.currentSeed + 1;
      const seedInput = document.querySelector<HTMLInputElement>('#levelSeed');
      if (seedInput) {
        seedInput.value = String(nextSeed);
      }
      this.applyGeneratedLevel(generatePuzzleLevel(nextSeed));
    });
  }

  private moveAxis(axis: 'x' | 'y', value: number): void {
    const next = { ...this.tuber.position, [axis]: value };

    if (!isTuberFullyInWater(next)) {
      if (this.tryCornerSlide(axis, value)) {
        this.tuber.velocity[axis] *= cornerSlideVelocityKeep;
        return;
      }

      const wallDirection = value > this.tuber.position[axis] ? 1 : -1;
      const awayDirection = -wallDirection;
      const reboundSpeed = Math.max(Math.abs(this.tuber.velocity[axis]) * controls.bounciness, minimumWallBounceSpeed);
      this.tuber.velocity[axis] = awayDirection * reboundSpeed;
      return;
    }

    this.tuber.position[axis] = value;
  }

  private tryCornerSlide(axis: 'x' | 'y', value: number): boolean {
    const perpendicularAxis = axis === 'x' ? 'y' : 'x';
    const velocityIntent = this.tuber.velocity[perpendicularAxis];
    const forceIntent = this.lastForce[perpendicularAxis];
    const hasTangentialIntent =
      Math.abs(velocityIntent) > cornerSlideVelocityIntent || Math.abs(forceIntent) > cornerSlideForceIntent;
    const probeDistance = cornerSlideStepCells * cornerSlideAttempts;
    const positiveProbe = { ...this.tuber.position, [perpendicularAxis]: this.tuber.position[perpendicularAxis] + probeDistance };
    const negativeProbe = { ...this.tuber.position, [perpendicularAxis]: this.tuber.position[perpendicularAxis] - probeDistance };
    const canSlidePositive = isTuberFullyInWater(positiveProbe);
    const canSlideNegative = isTuberFullyInWater(negativeProbe);
    const isCornerPinch = canSlidePositive !== canSlideNegative;

    if (!hasTangentialIntent && !isCornerPinch) {
      return false;
    }

    const preferredDirection = hasTangentialIntent
      ? Math.sign(velocityIntent || forceIntent)
      : canSlidePositive
        ? 1
        : -1;
    const axisStart = this.tuber.position[axis];
    const axisDelta = value - axisStart;
    const axisFractions = [1, 0.75, 0.5, 0.25, 0];

    for (let attempt = 1; attempt <= cornerSlideAttempts; attempt += 1) {
      const distance = cornerSlideStepCells * attempt;
      const directions = [preferredDirection, -preferredDirection];

      for (const fraction of axisFractions) {
        for (const direction of directions) {
          const candidate = {
            ...this.tuber.position,
            [axis]: axisStart + axisDelta * fraction,
            [perpendicularAxis]: this.tuber.position[perpendicularAxis] + distance * direction
          };

          if (isTuberFullyInWater(candidate)) {
            this.tuber.position = candidate;
            return true;
          }
        }
      }
    }

    return false;
  }

  private draw(): void {
    this.graphics.clear();
    this.drawBackdrop();
    this.drawInventory();
    this.drawGrid();
    if (allowManualShapeEditing) {
      this.drawWallControls();
      this.drawShapeControlHover();
    }
    this.drawJetMountHints();
    this.drawGoal();
    this.drawJetPlacementPreview();
    this.drawJets();
    this.drawTuber();
    this.drawDebugOverlay();
  }

  private drawBackdrop(): void {
    this.graphics.fillStyle(0x11131a, 1);
    this.graphics.fillRect(origin.x, origin.y, boardColumns() * cellSize, boardRows() * cellSize);
  }

  private drawInventory(): void {
    const panel = inventoryPanelRect();
    const usedPower = powerUsed(this.jets);
    this.graphics.fillStyle(0x151823, 1);
    this.graphics.fillRoundedRect(panel.left, panel.top, panel.width, panel.height, 16);
    this.graphics.lineStyle(1, 0x33384e, 1);
    this.graphics.strokeRoundedRect(panel.left, panel.top, panel.width, panel.height, 16);

    this.inventoryTitleText?.setPosition(panel.left + 14, panel.top + 12).setText(`Jet stock · Power ${usedPower}/${powerBudget}`);
    this.inventoryHintText?.setPosition(panel.left + 14, panel.top + panel.height - 24);

    const powerBar = {
      left: panel.left + 14,
      top: panel.top + 40,
      width: panel.width - 28,
      height: 10
    };
    this.graphics.fillStyle(0x0b0d14, 0.95);
    this.graphics.fillRoundedRect(powerBar.left, powerBar.top, powerBar.width, powerBar.height, 5);
    this.graphics.fillStyle(0x7cecff, 0.9);
    this.graphics.fillRoundedRect(
      powerBar.left,
      powerBar.top,
      powerBar.width * clamp(usedPower / powerBudget, 0, 1),
      powerBar.height,
      5
    );
    this.graphics.lineStyle(1, 0x7cecff, 0.65);
    this.graphics.strokeRoundedRect(powerBar.left, powerBar.top, powerBar.width, powerBar.height, 5);

    for (const presetId of presetIds) {
      const preset = jetPresets[presetId];
      const rect = inventorySlotRect(presetId);
      const selected = this.selectedPreset === presetId;
      const hovered = this.hoverInventoryPreset === presetId;
      const canAfford = usedPower + jetCost(presetId) <= powerBudget || selected;

      this.graphics.fillStyle(selected ? 0x222638 : hovered ? 0x1b2131 : 0x10131d, 1);
      this.graphics.fillRoundedRect(rect.left, rect.top, rect.width, rect.height, 12);
      this.graphics.lineStyle(selected ? 3 : 1, selected ? preset.color : hovered ? 0x7cecff : 0x353b51, 1);
      this.graphics.strokeRoundedRect(rect.left, rect.top, rect.width, rect.height, 12);

      drawPowerMeter(this.graphics, rect.left + 27, rect.top + 28, 16, preset.powerLevel, preset.color, canAfford ? 0.95 : 0.3);

      this.inventoryTexts
        .get(presetId)
        ?.setText(
          `${preset.label}\n${preset.description} · Cost ${jetCost(presetId)}`
        )
        .setAlpha(canAfford ? 1 : 0.58);
    }
  }

  private drawWallControls(): void {
    for (let x = 0; x < controls.gridColumns; x += 1) {
      const rect = columnHeaderRect(x);
      const trackX = rect.left + rect.width / 2;
      this.graphics.fillStyle(0x86f6ff, columnHeights[x] < controls.gridRows ? 0.95 : 0.3);
      drawTriangle(this.graphics, trackX, rect.top + 16, 'up');
      this.graphics.fillStyle(0x86f6ff, columnHeights[x] > 1 ? 0.95 : 0.3);
      drawTriangle(this.graphics, trackX, rect.top + rect.height - 16, 'down');
      drawTinyNumber(this.graphics, columnHeights[x], rect.left + rect.width / 2, rect.top + rect.height / 2);
    }

    for (let y = 0; y < controls.gridRows; y += 1) {
      const rect = rowHeaderRect(y);
      const trackY = rect.top + rect.height / 2;
      this.graphics.fillStyle(0xffc3e8, rowWidths[y] > 1 ? 0.95 : 0.3);
      drawTriangle(this.graphics, rect.left + 15, trackY, 'left');
      this.graphics.fillStyle(0xffc3e8, rowWidths[y] < controls.gridColumns ? 0.95 : 0.3);
      drawTriangle(this.graphics, rect.left + rect.width - 15, trackY, 'right');
      drawTinyNumber(this.graphics, rowWidths[y], rect.left + rect.width / 2, rect.top + rect.height / 2);
    }
  }

  private drawShapeControlHover(): void {
    if (!this.hoverShapeButton) {
      return;
    }

    this.graphics.fillStyle(0xffffff, 0.14);

    if (this.hoverShapeButton.type === 'rowWidth') {
      const y = this.hoverShapeButton.index + 1;

      for (let x = 1; x <= rowWidths[this.hoverShapeButton.index]; x += 1) {
        if (isWaterCell(x, y)) {
          const rect = cellRect(x, y);
          this.graphics.fillRect(rect.left + 4, rect.top + 4, rect.width - 10, rect.height - 10);
        }
      }

      return;
    }

    const x = this.hoverShapeButton.index + 1;

    for (let y = 1; y <= columnHeights[this.hoverShapeButton.index]; y += 1) {
      if (isWaterCell(x, y)) {
        const rect = cellRect(x, y);
        this.graphics.fillRect(rect.left + 4, rect.top + 4, rect.width - 10, rect.height - 10);
      }
    }
  }

  private drawGrid(): void {
    for (let y = 0; y < boardRows(); y += 1) {
      for (let x = 0; x < boardColumns(); x += 1) {
        const rect = cellRect(x, y);

        if (!isActiveCell(x, y)) {
          this.graphics.fillStyle(0x151823, 0.55);
          this.graphics.fillRect(rect.left, rect.top, rect.width - 2, rect.height - 2);
          this.graphics.lineStyle(1, 0x23293a, 0.6);
          this.graphics.strokeRect(rect.left, rect.top, rect.width - 2, rect.height - 2);
          continue;
        }

        const isWall = isWallCell(x, y);
        const isWater = isWaterCell(x, y);
        const checker = (x + y) % 2 === 0;
        const fill = isWall ? 0x34455e : checker ? 0x1b9aaa : 0x218aa0;

        this.graphics.fillStyle(fill, isWater ? 0.94 : 1);
        this.graphics.fillRect(rect.left, rect.top, rect.width - 2, rect.height - 2);
        this.graphics.lineStyle(1, isWall ? 0xffe473 : 0x687189, isWall ? 0.9 : 0.7);
        this.graphics.strokeRect(rect.left, rect.top, rect.width - 2, rect.height - 2);

        if (isWall) {
          this.graphics.lineStyle(2, 0x151823, 0.75);
          this.graphics.lineBetween(rect.left + 12, rect.top + rect.height - 12, rect.left + rect.width - 12, rect.top + 12);
        }

        this.graphics.fillStyle(isWall ? 0xffe473 : 0xd9ffff, 0.8);
        this.graphics.fillCircle(rect.left + 10, rect.top + 10, isWall ? 4 : 3);
      }
    }
  }

  private drawJetMountHints(): void {
    if (isBombPreset(this.selectedPreset)) {
      return;
    }

    for (const mount of allJetMounts()) {
      const edge = jetEdgePoint(mount);
      const pos = gridToScreen(edge.x, edge.y);
      const dir = directionVectors[mount.direction];

      this.graphics.lineStyle(3, 0xfff36d, 0.65);
      this.graphics.lineBetween(pos.x - dir.y * 12, pos.y + dir.x * 12, pos.x + dir.y * 12, pos.y - dir.x * 12);
    }
  }

  private drawGoal(): void {
    const pos = gridToScreen(this.goal.x, this.goal.y);
    const pulse = this.goalReached ? 1 : 0.65 + Math.sin(this.time.now / 180) * 0.12;

    this.graphics.lineStyle(4, this.goalReached ? 0xfff36d : 0xa6ff8f, 0.9);
    this.graphics.strokeCircle(pos.x, pos.y, 21 + (this.goalReached ? 4 : 0));
    this.graphics.fillStyle(this.goalReached ? 0xfff36d : 0x61ff9d, pulse);
    this.graphics.fillCircle(pos.x, pos.y, 12);
    this.graphics.lineStyle(2, 0x0c2417, 0.75);
    this.graphics.lineBetween(pos.x - 9, pos.y, pos.x + 9, pos.y);
    this.graphics.lineBetween(pos.x, pos.y - 9, pos.x, pos.y + 9);
  }

  private drawJetPlacementPreview(): void {
    if (this.hoverBombCell) {
      const ghostJet = makeBomb(this.hoverBombCell, this.selectedPreset);
      const canPlace = powerUsed(this.jets) + jetCost(this.selectedPreset) <= powerBudget;
      const color = canPlace ? jetPresets[this.selectedPreset].color : 0xff5c7a;

      this.drawJetStream(ghostJet, {
        color,
        alphaScale: canPlace ? 0.55 : 0.22,
        widthScale: 0.85
      });

      const pos = bombCenterPoint(ghostJet);
      const screenPos = gridToScreen(pos.x, pos.y);
      this.graphics.lineStyle(2, color, 0.95);
      this.graphics.strokeCircle(screenPos.x, screenPos.y, 16);
      return;
    }

    if (!this.hoverMount) {
      return;
    }

    const selected = this.findJetAtMount(this.hoverMount);
    const ghostJet = selected ?? makePreviewJet(this.hoverMount, this.selectedPreset);
    const canPlace = selected || powerUsed(this.jets) + jetCost(this.selectedPreset) <= powerBudget;
    const color = selected ? 0xffc3e8 : canPlace ? jetPresets[this.selectedPreset].color : 0xff5c7a;

    this.drawJetStream(ghostJet, {
      color,
      alphaScale: selected ? 0.35 : canPlace ? 0.55 : 0.22,
      widthScale: selected ? 1.05 : 0.85
    });

    const edge = jetEdgePoint(this.hoverMount);
    const pos = gridToScreen(edge.x, edge.y);
    this.graphics.lineStyle(2, color, 0.95);
    this.graphics.strokeCircle(pos.x, pos.y, selected ? 19 : 16);
  }

  private drawJets(): void {
    for (const jet of this.jets) {
      const anchor = placedJetAnchorPoint(jet);
      const center = gridToScreen(anchor.x, anchor.y);
      const powerRatio = clamp(jet.power / Math.max(jet.basePower, 0.001), 0, 1);
      const preset = jetPresets[jet.presetId];

      drawPowerMeter(this.graphics, center.x, center.y, 7 + powerRatio * 7, preset.powerLevel, preset.color, 0.35 + powerRatio * 0.65);

      this.drawJetStream(jet, { color: preset.color });

      if (!isBombPreset(jet.presetId)) {
        const dir = jetDirection(jet);
        const edge = jetEdgePoint(jet);
        const arrowEnd = gridToScreen(edge.x + dir.x * 0.45, edge.y + dir.y * 0.45);
        this.graphics.lineStyle(2, 0xffffff, 0.45 + powerRatio * 0.4);
        this.graphics.lineBetween(center.x, center.y, arrowEnd.x, arrowEnd.y);
      }

      if (this.selectedJet === jet) {
        this.graphics.lineStyle(4, 0xffc3e8, 0.95);
        this.graphics.strokeCircle(center.x, center.y, 20);
      }
    }
  }

  private drawJetStream(
    jet: Jet,
    options: { color?: number; alphaScale?: number; widthScale?: number } = {}
  ): void {
    const dir = jetDirection(jet);
    const powerRatio = clamp(jet.power / Math.max(jet.basePower, 0.001), 0, 1);
    const rangeRatio = clamp(jet.range / Math.max(jet.baseRange, 0.001), 0, 1);
    const widthRatio = clamp(jet.streamWidth / Math.max(jet.baseStreamWidth, 0.001), 0, 1);
    const segmentCount = Math.ceil(jet.range);
    const color = options.color ?? 0x7cecff;
    const alphaScale = options.alphaScale ?? 1;
    const widthScale = options.widthScale ?? 1;
    const preset = jetPresets[jet.presetId];

    if (preset.behavior === 'bomb') {
      const impact = bombCenterPoint(jet);
      const impactScreen = gridToScreen(impact.x, impact.y);
      const rippleRadius = bombRippleRadius(preset) * cellSize * widthRatio;

      for (let i = 1; i <= preset.powerLevel; i += 1) {
        this.graphics.lineStyle(Math.max(2, 3 * widthScale), color, 0.42 * alphaScale * powerRatio * (1 - (i - 1) / 5));
        this.graphics.strokeCircle(impactScreen.x, impactScreen.y, rippleRadius * (i / preset.powerLevel));
      }
      return;
    }

    const edge = jetEdgePoint(jet);

    for (let i = 0; i < segmentCount; i += 1) {
      const t = i / Math.max(segmentCount - 1, 1);
      const alpha = 0.58 * alphaScale * powerRatio * rangeRatio * (1 - t);
      const start = gridToScreen(edge.x + dir.x * i, edge.y + dir.y * i);
      const end = gridToScreen(edge.x + dir.x * (i + 0.75), edge.y + dir.y * (i + 0.75));

      this.graphics.lineStyle(Math.max(2, jet.streamWidth * 8 * widthScale * widthRatio * (1 - t)), color, alpha);
      this.graphics.lineBetween(start.x, start.y, end.x, end.y);
    }
  }

  private drawTuber(): void {
    const pos = gridToScreen(this.tuber.position.x, this.tuber.position.y);
    const speed = Math.hypot(this.tuber.velocity.x, this.tuber.velocity.y);

    this.graphics.lineStyle(5, 0xffc3e8, 1);
    this.graphics.strokeCircle(pos.x, pos.y, 17);
    this.graphics.fillStyle(0xfff4a8, 1);
    this.graphics.fillCircle(pos.x, pos.y, 10);

    this.graphics.lineStyle(3, 0xff5cc8, 0.9);
    this.graphics.lineBetween(
      pos.x,
      pos.y,
      pos.x + this.tuber.velocity.x * 14,
      pos.y + this.tuber.velocity.y * 14
    );

    this.graphics.lineStyle(2, 0xffffff, 0.7);
    this.graphics.strokeCircle(pos.x, pos.y, 18 + Math.min(speed * 2, 8));
  }

  private drawDebugOverlay(): void {
    if (!controls.showDebugOverlay) {
      return;
    }

    const tuberPos = gridToScreen(this.tuber.position.x, this.tuber.position.y);
    drawVectorArrow(this.graphics, tuberPos, this.tuber.velocity, 18, 0xff5cc8, 0.9);
    drawVectorArrow(this.graphics, tuberPos, this.lastForce, 10, 0xffffff, 0.85);

    for (const jet of this.jets) {
      if (isBombPreset(jet.presetId)) {
        const center = bombCenterPoint(jet);
        const start = gridToScreen(center.x, center.y);
        const rippleRadius = bombRippleRadius(jetPresets[jet.presetId]) * cellSize;

        this.graphics.lineStyle(1, 0xffffff, this.selectedJet === jet ? 0.45 : 0.18);
        this.graphics.strokeCircle(start.x, start.y, rippleRadius);
        continue;
      }

      const edge = jetEdgePoint(jet);
      const start = gridToScreen(edge.x, edge.y);
      const dir = jetDirection(jet);
      const end = gridToScreen(edge.x + dir.x * jet.range, edge.y + dir.y * jet.range);

      this.graphics.lineStyle(1, 0xffffff, this.selectedJet === jet ? 0.55 : 0.22);
      this.graphics.lineBetween(start.x, start.y, end.x, end.y);

      for (let i = 1; i <= Math.floor(jet.range); i += 1) {
        const tick = gridToScreen(edge.x + dir.x * i, edge.y + dir.y * i);
        this.graphics.fillStyle(0xffffff, this.selectedJet === jet ? 0.55 : 0.25);
        this.graphics.fillCircle(tick.x, tick.y, 2);
      }
    }
  }

  private findJetAt(screenX: number, screenY: number): Jet | null {
    let best: { jet: Jet; distance: number } | null = null;

    for (const jet of this.jets) {
      const anchor = placedJetAnchorPoint(jet);
      const edge = gridToScreen(anchor.x, anchor.y);
      const distance = Math.hypot(screenX - edge.x, screenY - edge.y);

      if (distance <= 22 && (!best || distance < best.distance)) {
        best = { jet, distance };
      }
    }

    return best?.jet ?? null;
  }

  private findJetAtMount(mount: JetMount): Jet | null {
    return (
      this.jets.find(
        (jet) => jet.wallX === mount.wallX && jet.wallY === mount.wallY && jet.direction === mount.direction
      ) ?? null
    );
  }

  private applySlidersToSelectedJet(): void {
    if (!this.selectedJet) {
      return;
    }

    this.selectedJet.basePower = controls.jetPower;
    this.selectedJet.baseRange = controls.jetRange;
    this.selectedJet.baseStreamWidth = controls.streamWidth;
    this.selectedJet.powerDecay = controls.powerDecay;
    this.selectedJet.rangeDecay = controls.rangeDecay;
    this.selectedJet.widthDecay = controls.widthDecay;
    this.selectedJet.decayEase = controls.decayEase;
    this.restartJet(this.selectedJet);
  }

  private restartJet(jet: Jet): void {
    jet.age = 0;
    jet.power = jet.basePower;
    jet.range = jet.baseRange;
    jet.streamWidth = jet.baseStreamWidth;
  }

  private cycleJetAim(jet: Jet): void {
    const currentIndex = aimOffsets.findIndex((offset) => Math.abs(offset - jet.angleOffset) < 0.001);
    const startIndex = currentIndex < 0 ? 0 : currentIndex;

    for (let step = 1; step <= aimOffsets.length; step += 1) {
      const nextOffset = aimOffsets[(startIndex + step) % aimOffsets.length];
      if (powerUsedWithAim(this.jets, jet, nextOffset) <= powerBudget) {
        jet.angleOffset = nextOffset;
        return;
      }
    }
  }

  private deleteSelectedJet(): void {
    if (!this.selectedJet) {
      return;
    }

    this.deleteJet(this.selectedJet);
  }

  private deleteJet(jet: Jet): void {
    const index = this.jets.indexOf(jet);
    if (index >= 0) {
      this.removeJetAt(index, true);
      this.setFlowActive(false);
    }
  }

  private removeJetAt(index: number, refundPower: boolean): void {
    const jet = this.jets[index];

    if (!jet) {
      return;
    }

    if (refundPower) {
      this.refundPower(jet.presetId);
    }

    if (this.selectedJet === jet) {
      this.selectedJet = null;
    }

    this.jets.splice(index, 1);
  }

  private setFlowActive(active: boolean): void {
    this.flowActive = active;
    const button = document.querySelector<HTMLButtonElement>('#toggleFlow');
    if (button) {
      button.textContent = active ? 'Pause flow' : 'Start flow';
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    }
  }

  private updateReadout(): void {
    if (selectedJetStatus) {
      selectedJetStatus.textContent = this.selectedJet
        ? `${jetPresets[this.selectedJet.presetId].label} at ${this.selectedJet.wallX}, ${this.selectedJet.wallY}${isBombPreset(this.selectedJet.presetId) ? '' : ` firing ${this.selectedJet.direction} · aim ${radiansToDegrees(this.selectedJet.angleOffset)}°`} · cost ${placedJetCost(this.selectedJet)}`
        : 'No jet selected.';
    }

    if (!readout) {
      return;
    }

    const cell = getCell(this.tuber.position);
    const speed = Math.hypot(this.tuber.velocity.x, this.tuber.velocity.y);
    const force = Math.hypot(this.lastForce.x, this.lastForce.y);
    const strongestJet = this.jets.reduce((max, jet) => Math.max(max, jet.power), 0);
    const usedPower = powerUsed(this.jets);
    const waterTiles = countWaterTiles();
    const wallTiles = countWallTiles();
    const rowShape = rowWidths.slice(0, controls.gridRows).join(', ');
    const inventoryShape = presetIds
      .map((presetId) => `${jetPresets[presetId].shortLabel}:${jetCost(presetId)}`)
      .join(' ');

    readout.innerHTML = `
      <strong>Debug</strong>
      <span>Level: ${currentLevelName}</span>
      <span>Generator: ${currentGeneratorStats}</span>
      <span>Water max: ${controls.gridColumns} × ${controls.gridRows}</span>
      <span>Water / wall: ${waterTiles} / ${wallTiles}</span>
      <span>Water row widths: ${rowShape}</span>
      <span>Tuber: ${this.tuber.position.x.toFixed(2)}, ${this.tuber.position.y.toFixed(2)}</span>
      <span>Tuber radius: ${tuberRadiusCells.toFixed(2)} cell</span>
      <span>Cell: ${cell ? `${cell.x}, ${cell.y}` : 'outside'}</span>
      <span>Speed: ${speed.toFixed(2)}</span>
      <span>Force: ${force.toFixed(2)}</span>
      <span>Goal: ${this.goalReached ? 'reached' : `${this.goal.x.toFixed(1)}, ${this.goal.y.toFixed(1)}`}</span>
      <span>Flow: ${this.flowActive ? 'running' : 'paused'}</span>
      <span>Bounciness: ${controls.bounciness.toFixed(2)}</span>
      <span>Jet mounts: ${allJetMounts().length}</span>
      <span>Jets: ${this.jets.length}</span>
      <span>Power: ${usedPower}/${powerBudget} · costs ${inventoryShape}</span>
      <span>Action: ${selectedActionMode}</span>
      <span>Selected jet type: ${jetPresets[this.selectedPreset].label}</span>
      <span>Selected jet: ${this.selectedJet ? `${this.selectedJet.wallX}, ${this.selectedJet.wallY}${isBombPreset(this.selectedJet.presetId) ? ', bomb' : `, ${this.selectedJet.direction}, ${radiansToDegrees(this.selectedJet.angleOffset)}°`}` : 'none'}</span>
      <span>Jet cutoff: range ≤ ${jetRetireRangeCells.toFixed(1)} or visual energy ≤ ${jetRetireVisualEnergy.toFixed(2)}</span>
      <span>Strongest jet: ${strongestJet.toFixed(2)}</span>
    `;
  }
}

function makeJet(mount: JetMount, presetId: PresetId): Jet {
  const preset = jetPresets[presetId];

  return {
    ...mount,
    presetId,
    angleOffset: 0,
    age: 0,
    power: preset.jetPower,
    range: preset.jetRange,
    streamWidth: preset.streamWidth,
    basePower: preset.jetPower,
    baseRange: preset.jetRange,
    baseStreamWidth: preset.streamWidth,
    powerDecay: preset.powerDecay,
    rangeDecay: preset.rangeDecay,
    widthDecay: preset.widthDecay,
    decayEase: preset.decayEase
  };
}

function makeBomb(cell: Cell, presetId: PresetId): Jet {
  return makeJet({ wallX: cell.x, wallY: cell.y, direction: 'N' }, presetId);
}

function makePreviewJet(mount: JetMount, presetId: PresetId): Jet {
  const preset = jetPresets[presetId];

  return {
    ...mount,
    presetId,
    angleOffset: 0,
    age: 0,
    power: preset.jetPower,
    range: preset.jetRange,
    streamWidth: preset.streamWidth,
    basePower: preset.jetPower,
    baseRange: preset.jetRange,
    baseStreamWidth: preset.streamWidth,
    powerDecay: preset.powerDecay,
    rangeDecay: preset.rangeDecay,
    widthDecay: preset.widthDecay,
    decayEase: preset.decayEase
  };
}

function getJetForce(jet: Jet, point: Vec2, velocity: Vec2): Vec2 {
  const preset = jetPresets[jet.presetId];

  if (preset.behavior === 'bomb') {
    const impact = bombCenterPoint(jet);
    const away = { x: point.x - impact.x, y: point.y - impact.y };
    const distance = Math.hypot(away.x, away.y);
    const rippleRadius = bombRippleRadius(preset);

    if (distance < 0.001 || distance > rippleRadius) {
      return { x: 0, y: 0 };
    }

    const falloff = Math.max(0, 1 - distance / rippleRadius);
    const strength = jet.power * falloff;
    return {
      x: (away.x / distance) * strength,
      y: (away.y / distance) * strength
    };
  }

  const dir = jetDirection(jet);
  const originPoint = jetEdgePoint(jet);
  const relative = { x: point.x - originPoint.x, y: point.y - originPoint.y };
  const forward = relative.x * dir.x + relative.y * dir.y;
  const sideways = Math.abs(relative.x * -dir.y + relative.y * dir.x);

  if (forward < 0 || forward > jet.range || sideways > jet.streamWidth / 2) {
    return { x: 0, y: 0 };
  }

  const falloff = Math.max(0, 1 - forward / Math.max(jet.range, 0.001));
  const strength = jet.power * falloff;
  const launchMultiplier = preset.behavior === 'bouncer' ? 1.35 : 1;

  return {
    x: dir.x * strength * launchMultiplier,
    y: dir.y * strength * launchMultiplier
  };
}

function jetCost(presetId: PresetId, angleOffset = 0): number {
  const preset = jetPresets[presetId];
  const angledCost = preset.behavior === 'jet' && Math.abs(angleOffset) > 0.001 ? anglePowerSurcharge : 0;
  return preset.baseCost + angledCost;
}

function placedJetCost(jet: Pick<Jet, 'presetId' | 'angleOffset'>): number {
  return jetCost(jet.presetId, jet.angleOffset);
}

function powerUsed(jets: readonly Jet[]): number {
  return jets.reduce((total, jet) => total + placedJetCost(jet), 0);
}

function powerUsedWithAim(jets: readonly Jet[], targetJet: Jet, nextOffset: number): number {
  return jets.reduce((total, jet) => total + (jet === targetJet ? jetCost(jet.presetId, nextOffset) : placedJetCost(jet)), 0);
}

function bombCenterPoint(jet: Pick<Jet, 'wallX' | 'wallY'>): Vec2 {
  return {
    x: jet.wallX + 0.5,
    y: jet.wallY + 0.5
  };
}

function bombRippleRadius(preset: Pick<JetPreset, 'powerLevel'>): number {
  return 0.6 + preset.powerLevel * 0.35;
}

function placedJetAnchorPoint(jet: Jet): Vec2 {
  return isBombPreset(jet.presetId) ? bombCenterPoint(jet) : jetEdgePoint(jet);
}

function isBombPreset(presetId: PresetId): boolean {
  return jetPresets[presetId].behavior === 'bomb';
}

function jetDirection(jet: Pick<Jet, 'direction' | 'angleOffset'>): Vec2 {
  return rotateVec(directionVectors[jet.direction], jet.angleOffset);
}

function rotateVec(vector: Vec2, radians: number): Vec2 {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return {
    x: vector.x * cos - vector.y * sin,
    y: vector.x * sin + vector.y * cos
  };
}

function radiansToDegrees(radians: number): number {
  return Math.round((radians * 180) / Math.PI);
}

function shouldRetireJet(jet: Jet): boolean {
  const powerRatio = jet.power / Math.max(jet.basePower, 0.001);
  const rangeRatio = jet.range / Math.max(jet.baseRange, 0.001);
  const widthRatio = jet.streamWidth / Math.max(jet.baseStreamWidth, 0.001);
  const visualEnergy = powerRatio * rangeRatio * widthRatio;

  return (
    jet.range <= jetRetireRangeCells ||
    powerRatio <= jetRetirePowerRatio ||
    visualEnergy <= jetRetireVisualEnergy ||
    jet.streamWidth <= jetRetireStreamWidthCells
  );
}

function easedDecay(age: number, rate: number, ease = controls.decayEase): number {
  if (rate <= 0) {
    return 1;
  }

  const base = Math.exp(-age * rate);
  return Math.pow(base, 1 / Math.max(0.1, ease));
}

function normalizeShape(): void {
  if (customWaterMask) {
    syncShapeExtentsFromMask(customWaterMask);
    return;
  }

  for (let y = 0; y < maxWaterRows; y += 1) {
    rowWidths[y] = Math.round(clamp(rowWidths[y], 1, controls.gridColumns));
  }

  for (let x = 0; x < maxWaterColumns; x += 1) {
    columnHeights[x] = Math.round(clamp(columnHeights[x], 1, controls.gridRows));
  }
}

function boardColumns(): number {
  return controls.gridColumns + 2;
}

function boardRows(): number {
  return controls.gridRows + 2;
}

function isWaterCell(x: number, y: number): boolean {
  const waterX = x - 1;
  const waterY = y - 1;

  if (waterX < 0 || waterY < 0 || waterX >= controls.gridColumns || waterY >= controls.gridRows) {
    return false;
  }

  if (customWaterMask) {
    return customWaterMask[waterY * maxWaterColumns + waterX] === 1;
  }

  return waterX < rowWidths[waterY] && waterY < columnHeights[waterX];
}

function isWallCell(x: number, y: number): boolean {
  if (!isInsideBoard(x, y) || isWaterCell(x, y)) {
    return false;
  }

  return (
    isWaterCell(x - 1, y) ||
    isWaterCell(x + 1, y) ||
    isWaterCell(x, y - 1) ||
    isWaterCell(x, y + 1)
  );
}

function isActiveCell(x: number, y: number): boolean {
  return isWaterCell(x, y) || isWallCell(x, y);
}

function isInsideBoard(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < boardColumns() && y < boardRows();
}

function createInventory(): Record<PresetId, InventorySlot> {
  return {
    jet1: {},
    jet2: {},
    jet3: {},
    jet4: {},
    bomb1: {},
    bomb2: {},
    bomb3: {},
    bomb4: {},
    bouncer: {}
  };
}

function resetInventory(_inventory: Record<PresetId, InventorySlot>): void {
  // Power is derived from placed tools, so clearing jets resets budget use.
}

function syncShapeExtentsFromMask(mask: Uint8Array): void {
  for (let y = 0; y < maxWaterRows; y += 1) {
    let width = 1;
    for (let x = 0; x < maxWaterColumns; x += 1) {
      if (mask[y * maxWaterColumns + x] === 1) {
        width = Math.max(width, x + 1);
      }
    }
    rowWidths[y] = clamp(width, 1, controls.gridColumns);
  }

  for (let x = 0; x < maxWaterColumns; x += 1) {
    let height = 1;
    for (let y = 0; y < maxWaterRows; y += 1) {
      if (mask[y * maxWaterColumns + x] === 1) {
        height = Math.max(height, y + 1);
      }
    }
    columnHeights[x] = clamp(height, 1, controls.gridRows);
  }
}

function generatePuzzleLevel(seed: number): GeneratedLevel {
  const startTime = performance.now();
  let lastLevel: GeneratedLevel | null = null;

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const level = generatePuzzleLevelOnce(seed + attempt * 9973, seed, attempt, startTime);
    lastLevel = level;

    if (level.stats.reachableWater === level.stats.waterTiles && level.stats.jetSlots >= 6) {
      const a = generatePuzzleLevelOnce(seed + attempt * 9973, seed, attempt, startTime);
      const b = generatePuzzleLevelOnce(seed + attempt * 9973, seed, attempt, startTime);
      const deterministic = a.stats.checksum === level.stats.checksum && b.stats.checksum === level.stats.checksum;
      console.info('[Aquerra generator tests]', {
        reachable: `${level.stats.reachableWater}/${level.stats.waterTiles}`,
        deterministic,
        checksum: level.stats.checksum,
        jetSlots: level.stats.jetSlots,
        loops: level.stats.loops,
        genMs: level.stats.genMs.toFixed(2)
      });
      return level;
    }
  }

  return lastLevel ?? generatePuzzleLevelOnce(seed, seed, 1, startTime);
}

function generatePuzzleLevelOnce(internalSeed: number, displaySeed: number, attempts: number, startTime: number): GeneratedLevel {
  const rng = createRng(internalSeed);
  const W = controls.gridColumns;
  const H = controls.gridRows;
  const mask = new Uint8Array(maxWaterColumns * maxWaterRows);
  const roomTarget = clamp(Math.round((W * H) / 18), 4, 7);
  const rooms: LevelRoom[] = [];

  rooms.push({ id: 0, x: clamp(rng.int(1, 2), 0, W - 1), y: rng.int(1, Math.max(1, H - 2)), rx: 2, ry: 2 });
  rooms.push({ id: 1, x: clamp(W - 2 - rng.int(0, 1), 0, W - 1), y: rng.int(1, Math.max(1, H - 2)), rx: 2, ry: 2 });

  for (let i = 2; i < roomTarget; i += 1) {
    rooms.push({
      id: i,
      x: rng.int(1, Math.max(1, W - 2)),
      y: rng.int(1, Math.max(1, H - 2)),
      rx: rng.int(1, 2),
      ry: rng.int(1, 2)
    });
  }

  for (const room of rooms) {
    carveBlob(mask, W, H, room, rng);
  }

  const sortedRooms = [...rooms].sort((a, b) => a.x - b.x || a.y - b.y);
  for (let i = 1; i < sortedRooms.length; i += 1) {
    carveChannel(mask, W, H, sortedRooms[i - 1], sortedRooms[i], rng, i <= 2 ? 2 : 1);
  }

  let loops = 0;
  if (sortedRooms.length >= 4) {
    const a = sortedRooms[rng.int(0, Math.floor(sortedRooms.length / 2))];
    const b = sortedRooms[rng.int(Math.ceil(sortedRooms.length / 2), sortedRooms.length - 1)];
    carveChannel(mask, W, H, a, b, rng, 1);
    loops = 1;
  }

  roughenMask(mask, W, H, rng);

  const water = waterCellsFromMask(mask, W, H);
  const leftStart = water.reduce((best, cell) => (cell.x < best.x || (cell.x === best.x && cell.y < best.y) ? cell : best), water[0]);
  const bfs = floodMask(mask, W, H, leftStart);
  const reachable = water.filter((cell) => bfs[cell.y * W + cell.x] >= 0);
  const goalWater = reachable.reduce((best, cell) => {
    return bfs[cell.y * W + cell.x] > bfs[best.y * W + best.x] ? cell : best;
  }, leftStart);
  const slots = jetSlotsFromMask(mask, W, H);
  const checksum = checksumMask(mask);
  const name = seededLevelName(displaySeed);

  return {
    seed: displaySeed,
    name,
    mask,
    start: { x: leftStart.x + 1, y: leftStart.y + 1 },
    goal: { x: goalWater.x + 1, y: goalWater.y + 1 },
    stats: {
      attempts,
      rooms: rooms.length,
      waterTiles: water.length,
      reachableWater: reachable.length,
      jetSlots: slots.length,
      loops,
      checksum,
      genMs: performance.now() - startTime
    }
  };
}

function createRng(seed: number): {
  float: (min?: number, max?: number) => number;
  int: (min: number, max: number) => number;
  pick: <T>(items: readonly T[]) => T;
  chance: (p: number) => boolean;
} {
  let state = seed >>> 0;
  const next = () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    float: (min = 0, max = 1) => min + next() * (max - min),
    int: (min, max) => Math.floor(min + next() * (max - min + 1)),
    pick: (items) => items[Math.floor(next() * items.length)],
    chance: (p) => next() < p
  };
}

function carveBlob(
  mask: Uint8Array,
  W: number,
  H: number,
  room: LevelRoom,
  rng: ReturnType<typeof createRng>
): void {
  for (let y = room.y - room.ry - 1; y <= room.y + room.ry + 1; y += 1) {
    for (let x = room.x - room.rx - 1; x <= room.x + room.rx + 1; x += 1) {
      if (x < 0 || y < 0 || x >= W || y >= H) {
        continue;
      }

      const nx = (x - room.x) / Math.max(1, room.rx + rng.float(-0.2, 0.45));
      const ny = (y - room.y) / Math.max(1, room.ry + rng.float(-0.2, 0.45));
      if (nx * nx + ny * ny <= 1.25 || rng.chance(0.12)) {
        mask[y * maxWaterColumns + x] = 1;
      }
    }
  }
}

function carveChannel(
  mask: Uint8Array,
  W: number,
  H: number,
  a: Cell,
  b: Cell,
  rng: ReturnType<typeof createRng>,
  width: number
): void {
  const horizontalFirst = rng.chance(0.5);
  const stamp = (x: number, y: number) => {
    for (let oy = -Math.floor(width / 2); oy <= Math.floor(width / 2); oy += 1) {
      for (let ox = -Math.floor(width / 2); ox <= Math.floor(width / 2); ox += 1) {
        const px = x + ox;
        const py = y + oy;
        if (px >= 0 && py >= 0 && px < W && py < H) {
          mask[py * maxWaterColumns + px] = 1;
        }
      }
    }
  };

  const walk = (from: Cell, to: Cell, axis: 'x' | 'y') => {
    const step = Math.sign(to[axis] - from[axis]);
    const cursor = { ...from };
    stamp(cursor.x, cursor.y);
    while (cursor[axis] !== to[axis]) {
      cursor[axis] += step;
      stamp(cursor.x, cursor.y);
    }
    return cursor;
  };

  const elbow = horizontalFirst ? walk(a, b, 'x') : walk(a, b, 'y');
  walk(elbow, b, horizontalFirst ? 'y' : 'x');
}

function roughenMask(mask: Uint8Array, W: number, H: number, rng: ReturnType<typeof createRng>): void {
  const copy = mask.slice();
  for (let y = 1; y < H - 1; y += 1) {
    for (let x = 1; x < W - 1; x += 1) {
      if (copy[y * maxWaterColumns + x] === 1 || !rng.chance(0.08)) {
        continue;
      }

      const neighbors =
        copy[y * maxWaterColumns + x - 1] +
        copy[y * maxWaterColumns + x + 1] +
        copy[(y - 1) * maxWaterColumns + x] +
        copy[(y + 1) * maxWaterColumns + x];
      if (neighbors >= 2) {
        mask[y * maxWaterColumns + x] = 1;
      }
    }
  }
}

function waterCellsFromMask(mask: Uint8Array, W: number, H: number): Cell[] {
  const cells: Cell[] = [];
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      if (mask[y * maxWaterColumns + x] === 1) {
        cells.push({ x, y });
      }
    }
  }
  return cells;
}

function floodMask(mask: Uint8Array, W: number, H: number, start: Cell): Int16Array {
  const distances = new Int16Array(W * H).fill(-1);
  const queue: Cell[] = [start];
  distances[start.y * W + start.x] = 0;

  for (let i = 0; i < queue.length; i += 1) {
    const cell = queue[i];
    for (const dir of Object.values(directionVectors)) {
      const x = cell.x + dir.x;
      const y = cell.y + dir.y;
      const index = y * W + x;
      if (x < 0 || y < 0 || x >= W || y >= H || distances[index] >= 0 || mask[y * maxWaterColumns + x] !== 1) {
        continue;
      }
      distances[index] = distances[cell.y * W + cell.x] + 1;
      queue.push({ x, y });
    }
  }

  return distances;
}

function jetSlotsFromMask(mask: Uint8Array, W: number, H: number): JetMount[] {
  const slots: JetMount[] = [];
  for (let wallY = 0; wallY < H + 2; wallY += 1) {
    for (let wallX = 0; wallX < W + 2; wallX += 1) {
      const waterX = wallX - 1;
      const waterY = wallY - 1;
      if (waterX >= 0 && waterY >= 0 && waterX < W && waterY < H && mask[waterY * maxWaterColumns + waterX] === 1) {
        continue;
      }

      for (const direction of ['N', 'S', 'E', 'W'] as Direction[]) {
        const vector = directionVectors[direction];
        const adjacentWaterX = wallX + vector.x - 1;
        const adjacentWaterY = wallY + vector.y - 1;
        if (
          adjacentWaterX >= 0 &&
          adjacentWaterY >= 0 &&
          adjacentWaterX < W &&
          adjacentWaterY < H &&
          mask[adjacentWaterY * maxWaterColumns + adjacentWaterX] === 1
        ) {
          slots.push({ wallX, wallY, direction });
        }
      }
    }
  }
  return slots;
}

function checksumMask(mask: Uint8Array): number {
  let hash = 2166136261;
  for (const value of mask) {
    hash ^= value;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededLevelName(seed: number): string {
  const rng = createRng(seed ^ 0xa717e22a);
  const moods = ['Whispering', 'Sunken', 'Crooked', 'Moonlit', 'Restless', 'Tidal'];
  const forms = ['Basin', 'Grotto', 'Runnel', 'Vault', 'Channel', 'Pool'];
  const names = ['Nara', 'Voss', 'Kelm', 'Auri', 'Tarn', 'Luma'];
  return `The ${rng.pick(moods)} ${rng.pick(forms)} of ${rng.pick(names)}`;
}

function inventoryPanelRect(): Rect {
  return {
    left: origin.x,
    top: origin.y + boardRows() * cellSize + inventoryGap,
    width: boardPixelWidth,
    height: inventoryHeight
  };
}

function inventorySlotRect(presetId: PresetId): Rect {
  const panel = inventoryPanelRect();
  const index = presetIds.indexOf(presetId);
  const columns = 3;
  const slotHeight = 58;
  const gap = 10;
  const column = index % columns;
  const row = Math.floor(index / columns);
  const slotWidth = (panel.width - 24 - gap * (columns - 1)) / columns;

  return {
    left: panel.left + 12 + column * (slotWidth + gap),
    top: panel.top + 70 + row * (slotHeight + gap),
    width: slotWidth,
    height: slotHeight
  };
}

function hitInventorySlot(x: number, y: number): PresetId | null {
  for (const presetId of presetIds) {
    if (pointInsideRect(x, y, inventorySlotRect(presetId))) {
      return presetId;
    }
  }

  return null;
}

function adjacentWaterDirections(wallX: number, wallY: number): Direction[] {
  const directions: Direction[] = [];

  for (const direction of ['N', 'S', 'E', 'W'] as Direction[]) {
    const vector = directionVectors[direction];
    if (isWaterCell(wallX + vector.x, wallY + vector.y)) {
      directions.push(direction);
    }
  }

  return directions;
}

function isValidJetMount(mount: JetMount): boolean {
  const vector = directionVectors[mount.direction];
  return isWallCell(mount.wallX, mount.wallY) && isWaterCell(mount.wallX + vector.x, mount.wallY + vector.y);
}

function isValidPlacedJet(jet: Jet): boolean {
  return isBombPreset(jet.presetId) ? isWaterCell(jet.wallX, jet.wallY) : isValidJetMount(jet);
}

function allJetMounts(): JetMount[] {
  const mounts: JetMount[] = [];

  for (let y = 0; y < boardRows(); y += 1) {
    for (let x = 0; x < boardColumns(); x += 1) {
      if (!isWallCell(x, y)) {
        continue;
      }

      for (const direction of adjacentWaterDirections(x, y)) {
        mounts.push({ wallX: x, wallY: y, direction });
      }
    }
  }

  return mounts;
}

function findWaterCellAt(screenX: number, screenY: number): Cell | null {
  const gridPos = screenToGrid(screenX, screenY);
  const cell = { x: Math.floor(gridPos.x), y: Math.floor(gridPos.y) };
  return isWaterCell(cell.x, cell.y) ? cell : null;
}

function findJetMountAt(screenX: number, screenY: number): JetMount | null {
  const gridPos = screenToGrid(screenX, screenY);
  const cellX = Math.floor(gridPos.x);
  const cellY = Math.floor(gridPos.y);

  if (!isWallCell(cellX, cellY)) {
    return nearestJetMountByEdge(screenX, screenY);
  }

  const localX = gridPos.x - cellX;
  const localY = gridPos.y - cellY;
  const candidates = adjacentWaterDirections(cellX, cellY);

  if (candidates.length === 0) {
    return null;
  }

  const direction = candidates.reduce((best, current) => {
    return edgeDistance(current, localX, localY) < edgeDistance(best, localX, localY) ? current : best;
  });

  return { wallX: cellX, wallY: cellY, direction };
}

function nearestJetMountByEdge(screenX: number, screenY: number): JetMount | null {
  const pointer = { x: screenX, y: screenY };
  const mounts = allJetMounts();
  let best: { mount: JetMount; distance: number } | null = null;

  for (const mount of mounts) {
    const edge = gridToScreen(jetEdgePoint(mount).x, jetEdgePoint(mount).y);
    const distance = Math.hypot(pointer.x - edge.x, pointer.y - edge.y);

    if (distance <= 14 && (!best || distance < best.distance)) {
      best = { mount, distance };
    }
  }

  return best?.mount ?? null;
}

function edgeDistance(direction: Direction, localX: number, localY: number): number {
  switch (direction) {
    case 'N':
      return localY;
    case 'S':
      return 1 - localY;
    case 'E':
      return 1 - localX;
    case 'W':
      return localX;
  }
}

function jetEdgePoint(mount: JetMount): Vec2 {
  const dir = directionVectors[mount.direction];
  return {
    x: mount.wallX + 0.5 + dir.x * 0.5,
    y: mount.wallY + 0.5 + dir.y * 0.5
  };
}

function waterCells(): Array<{ x: number; y: number }> {
  const cells: Array<{ x: number; y: number }> = [];

  for (let y = 0; y < boardRows(); y += 1) {
    for (let x = 0; x < boardColumns(); x += 1) {
      if (isWaterCell(x, y)) {
        cells.push({ x, y });
      }
    }
  }

  return cells;
}

function countWaterTiles(): number {
  return waterCells().length;
}

function countWallTiles(): number {
  let count = 0;

  for (let y = 0; y < boardRows(); y += 1) {
    for (let x = 0; x < boardColumns(); x += 1) {
      if (isWallCell(x, y)) {
        count += 1;
      }
    }
  }

  return count;
}

function centeredStartPosition(): Vec2 {
  return nearestWaterCellCenter({ x: 3.5, y: controls.gridRows / 2 + 1 });
}

function centeredGoalPosition(): Vec2 {
  return nearestWaterCellCenter({ x: controls.gridColumns + 0.5, y: controls.gridRows / 2 + 1 });
}

function nearestWaterCellCenter(point: Vec2): Vec2 {
  const cells = waterCells();

  if (cells.length === 0) {
    return { x: 1.5, y: 1.5 };
  }

  const nearest = cells.reduce((best, cell) => {
    const distance = Math.hypot(point.x - (cell.x + 0.5), point.y - (cell.y + 0.5));
    return distance < best.distance ? { cell, distance } : best;
  }, { cell: cells[0], distance: Number.POSITIVE_INFINITY });

  return { x: nearest.cell.x + 0.5, y: nearest.cell.y + 0.5 };
}

function isWaterPoint(point: Vec2): boolean {
  return isWaterCell(Math.floor(point.x), Math.floor(point.y));
}

function isTuberFullyInWater(point: Vec2): boolean {
  const samples: Vec2[] = [
    point,
    { x: point.x + tuberRadiusCells, y: point.y },
    { x: point.x - tuberRadiusCells, y: point.y },
    { x: point.x, y: point.y + tuberRadiusCells },
    { x: point.x, y: point.y - tuberRadiusCells },
    { x: point.x + tuberRadiusCells * 0.7, y: point.y + tuberRadiusCells * 0.7 },
    { x: point.x - tuberRadiusCells * 0.7, y: point.y + tuberRadiusCells * 0.7 },
    { x: point.x + tuberRadiusCells * 0.7, y: point.y - tuberRadiusCells * 0.7 },
    { x: point.x - tuberRadiusCells * 0.7, y: point.y - tuberRadiusCells * 0.7 }
  ];

  return samples.every(isWaterPoint);
}

function getCell(point: Vec2): { x: number; y: number } | null {
  const x = Math.floor(point.x);
  const y = Math.floor(point.y);

  if (!isActiveCell(x, y)) {
    return null;
  }

  return { x, y };
}

function hitShapeButton(x: number, y: number): ShapeButton | null {
  for (let row = 0; row < controls.gridRows; row += 1) {
    const rect = rowHeaderRect(row);
    const verticalHit = y >= rect.top + 10 && y <= rect.top + rect.height - 10;

    if (verticalHit && x >= rect.left + 3 && x <= rect.left + 28) {
      return {
        type: 'rowWidth',
        index: row,
        delta: -1
      };
    }

    if (verticalHit && x >= rect.left + rect.width - 28 && x <= rect.left + rect.width - 3) {
      return {
        type: 'rowWidth',
        index: row,
        delta: 1
      };
    }
  }

  for (let column = 0; column < controls.gridColumns; column += 1) {
    const rect = columnHeaderRect(column);
    const horizontalHit = x >= rect.left + 10 && x <= rect.left + rect.width - 10;

    if (horizontalHit && y >= rect.top + 3 && y <= rect.top + 28) {
      return {
        type: 'columnHeight',
        index: column,
        delta: -1
      };
    }

    if (horizontalHit && y >= rect.top + rect.height - 28 && y <= rect.top + rect.height - 3) {
      return {
        type: 'columnHeight',
        index: column,
        delta: 1
      };
    }
  }

  return null;
}

function rowHeaderRect(row: number): Rect {
  return {
    left: boardOrigin.x,
    top: boardOrigin.y + (row + 1) * cellSize,
    width: cellSize,
    height: cellSize
  };
}

function columnHeaderRect(column: number): Rect {
  return {
    left: boardOrigin.x + (column + 1) * cellSize,
    top: boardOrigin.y,
    width: cellSize,
    height: cellSize
  };
}

function cellRect(x: number, y: number): Rect {
  return {
    left: boardOrigin.x + x * cellSize,
    top: boardOrigin.y + y * cellSize,
    width: cellSize,
    height: cellSize
  };
}

function gridToScreen(x: number, y: number): Vec2 {
  return {
    x: boardOrigin.x + x * cellSize,
    y: boardOrigin.y + y * cellSize
  };
}

function screenToGrid(x: number, y: number): Vec2 {
  return {
    x: (x - boardOrigin.x) / cellSize,
    y: (y - boardOrigin.y) / cellSize
  };
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}

function pointInsideRect(x: number, y: number, rect: Rect): boolean {
  return x >= rect.left && x <= rect.left + rect.width && y >= rect.top && y <= rect.top + rect.height;
}

function drawTriangle(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  direction: 'up' | 'down' | 'left' | 'right'
): void {
  const size = 8;

  if (direction === 'up') {
    graphics.fillTriangle(x, y - size, x - size, y + size * 0.75, x + size, y + size * 0.75);
    return;
  }

  if (direction === 'down') {
    graphics.fillTriangle(x, y + size, x - size, y - size * 0.75, x + size, y - size * 0.75);
    return;
  }

  if (direction === 'left') {
    graphics.fillTriangle(x - size, y, x + size * 0.75, y - size, x + size * 0.75, y + size);
    return;
  }

  graphics.fillTriangle(x + size, y, x - size * 0.75, y - size, x - size * 0.75, y + size);
}

function drawTinyNumber(graphics: Phaser.GameObjects.Graphics, value: number, x: number, y: number): void {
  const pips = Math.max(1, Math.min(10, Math.round(value)));
  const columns = 5;
  const spacing = 4;
  const startX = x - ((columns - 1) * spacing) / 2;
  const startY = y - 2;

  graphics.fillStyle(0xffffff, 0.88);

  for (let i = 0; i < pips; i += 1) {
    const pipX = startX + (i % columns) * spacing;
    const pipY = startY + Math.floor(i / columns) * spacing;
    graphics.fillCircle(pipX, pipY, 1.4);
  }
}

function drawPowerMeter(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  radius: number,
  powerLevel: number,
  color: number,
  alpha: number
): void {
  graphics.fillStyle(color, alpha * 0.28);
  graphics.fillCircle(x, y, radius - 4);
  graphics.lineStyle(2, 0xffffff, alpha * 0.25);
  graphics.strokeCircle(x, y, radius);

  const segmentGap = 0.08;
  const startAngle = -Math.PI / 2;

  for (let i = 0; i < 4; i += 1) {
    const segmentStart = startAngle + i * (Math.PI / 2) + segmentGap;
    const segmentEnd = startAngle + (i + 1) * (Math.PI / 2) - segmentGap;
    graphics.lineStyle(4, color, i < powerLevel ? alpha : alpha * 0.18);
    graphics.beginPath();
    graphics.arc(x, y, radius, segmentStart, segmentEnd, false);
    graphics.strokePath();
  }
}

function drawVectorArrow(
  graphics: Phaser.GameObjects.Graphics,
  start: Vec2,
  vector: Vec2,
  scale: number,
  color: number,
  alpha: number
): void {
  const length = Math.hypot(vector.x, vector.y);

  if (length < 0.02) {
    return;
  }

  const end = {
    x: start.x + vector.x * scale,
    y: start.y + vector.y * scale
  };
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const head = 9;

  graphics.lineStyle(2, color, alpha);
  graphics.lineBetween(start.x, start.y, end.x, end.y);
  graphics.fillStyle(color, alpha);
  graphics.fillTriangle(
    end.x,
    end.y,
    end.x - Math.cos(angle - 0.55) * head,
    end.y - Math.sin(angle - 0.55) * head,
    end.x - Math.cos(angle + 0.55) * head,
    end.y - Math.sin(angle + 0.55) * head
  );
}

new Phaser.Game({
  type: Phaser.AUTO,
  width: canvasWidth,
  height: canvasHeight,
  backgroundColor: '#11131a',
  parent: 'game-root',
  scene: [PrototypeScene]
});
