import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import {
  get_big_small,
  diablo_detailed_telemetry,
  computeSameSideSingleNumber,
  HistoryLogEntry,
  EngineStats,
  DetailedEngineTelemetry,
} from './src/engine/jujustuEngine.ts';

export type GameMode = '30S' | '1M';

const API_URLS: Record<GameMode, string> = {
  '30S': 'https://draw.ar-lottery01.com/WinGo/WinGo_30S/GetHistoryIssuePage.json?ts=',
  '1M': 'https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json?ts=',
};

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 10)',
  Referer: 'https://hgnice.biz',
};

interface RawWinGoItem {
  issueNumber: string;
  number: string;
  color?: string;
  premium?: string;
}

interface ModeEngineState {
  mode: GameMode;
  stats: EngineStats;
  history_log: HistoryLogEntry[];
  current_prediction: {
    period?: string;
    prediction?: 'BIG' | 'SMALL';
    singleNumber?: number;
    reason?: string;
    confidence?: number;
  };
  seen_periods: Set<string>;
  last_results_ints: number[];
  prev_prediction: 'BIG' | 'SMALL' | null;
  latest_telemetry: DetailedEngineTelemetry | null;
  last_sync_time: string;
  server_active: boolean;
  raw_api_feed: RawWinGoItem[];
}

function createEmptyModeState(mode: GameMode): ModeEngineState {
  return {
    mode,
    stats: { wins: 0, losses: 0, total: 0 },
    history_log: [],
    current_prediction: {},
    seen_periods: new Set<string>(),
    last_results_ints: [],
    prev_prediction: null,
    latest_telemetry: null,
    last_sync_time: new Date().toISOString(),
    server_active: true,
    raw_api_feed: [],
  };
}

const engines: Record<GameMode, ModeEngineState> = {
  '30S': createEmptyModeState('30S'),
  '1M': createEmptyModeState('1M'),
};

async function fetchWinGoData(mode: GameMode): Promise<RawWinGoItem[]> {
  try {
    const ts = Date.now();
    const url = `${API_URLS[mode]}${ts}`;
    const response = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const result: any = await response.json();
    if (result && result.data && Array.isArray(result.data.list)) {
      const formatted: RawWinGoItem[] = result.data.list.map((item: any) => ({
        issueNumber: String(item.issueNumber || ''),
        number: String(item.number || ''),
        color: String(item.color || ''),
        premium: String(item.premium || ''),
      }));
      engines[mode].raw_api_feed = formatted;
      engines[mode].server_active = true;
      engines[mode].last_sync_time = new Date().toISOString();
      return formatted;
    }
    throw new Error('Invalid API structure');
  } catch {
    return [];
  }
}

function processPeriodStep(
  mode: GameMode,
  current_period: string,
  result_number: string,
  timestampStr?: string
) {
  const state = engines[mode];
  if (!current_period || state.seen_periods.has(current_period)) {
    return;
  }
  state.seen_periods.add(current_period);
  const timeLabel = timestampStr || new Date().toLocaleTimeString([], { hour12: false });

  // 1. Check pending prediction (Exact match to Python script)
  if (
    state.current_prediction &&
    state.current_prediction.period === current_period &&
    state.current_prediction.prediction
  ) {
    const pred_val = state.current_prediction.prediction;
    const actual_val = get_big_small(result_number);
    const outcome: 'WIN' | 'LOSE' = pred_val === actual_val ? 'WIN' : 'LOSE';

    if (outcome === 'WIN') {
      state.stats.wins += 1;
    } else {
      state.stats.losses += 1;
    }
    state.stats.total += 1;

    for (let i = state.history_log.length - 1; i >= 0; i--) {
      const entry = state.history_log[i];
      if (entry.period === current_period) {
        entry.actual = actual_val;
        entry.actualNumber = result_number;
        entry.outcome = outcome;

        const win_rate =
          state.stats.total > 0 ? (state.stats.wins / state.stats.total) * 100 : 0;
        const stats_str = `(${state.stats.wins}W/${state.stats.losses}L) ×${state.stats.wins}`;
        entry.stats_str = `${win_rate.toFixed(1)}% ${stats_str}`;
        entry.timestamp = timeLabel;
        break;
      }
    }

    state.prev_prediction = pred_val;
    state.current_prediction = {};
  }

  // 2. Automatically generate new prediction for next_period (Exact Python script order)
  if (/^\d+$/.test(current_period)) {
    const next_period = (BigInt(current_period) + 1n).toString();
    const telemetry = diablo_detailed_telemetry(
      current_period,
      state.last_results_ints,
      state.prev_prediction
    );
    const next_pred = telemetry.final_pred;
    const reason = telemetry.combined_reason;
    const confidence = telemetry.confidence;
    // Strictly same-side single number: 5..9 for BIG, 0..4 for SMALL
    const singleNumber = computeSameSideSingleNumber(telemetry, next_pred);

    state.latest_telemetry = telemetry;

    state.current_prediction = {
      period: next_period,
      prediction: next_pred,
      singleNumber,
      reason,
      confidence,
    };

    state.history_log.push({
      period: next_period,
      pred: next_pred,
      singleNumber,
      actual: '?',
      actualNumber: '?',
      outcome: 'PENDING',
      reason,
      confidence,
      stats_str: '',
      timestamp: timeLabel,
    });
  }

  // 3. Update historical ints
  const parsedNum = parseInt(result_number, 10);
  if (!isNaN(parsedNum)) {
    state.last_results_ints.push(parsedNum);
    if (state.last_results_ints.length > 50) {
      state.last_results_ints.shift();
    }
  }
}

async function resetModeToFreshLiveSession(mode: GameMode) {
  engines[mode] = createEmptyModeState(mode);
  const state = engines[mode];

  const data = await fetchWinGoData(mode);
  if (data.length > 0) {
    const chronological = [...data].reverse();
    // Warm up last_results_ints with the past 9 draws so Markov/Freq/Master have real history
    for (let i = 0; i < chronological.length - 1; i++) {
      const item = chronological[i];
      state.seen_periods.add(item.issueNumber);
      const n = parseInt(item.number, 10);
      if (!isNaN(n)) {
        state.last_results_ints.push(n);
      }
    }
    // Process only the current latest draw to generate the immediate live auto-prediction
    const latest = chronological[chronological.length - 1];
    processPeriodStep(mode, latest.issueNumber, latest.number);
  }
}

async function resetAllModes() {
  await Promise.all([
    resetModeToFreshLiveSession('30S'),
    resetModeToFreshLiveSession('1M'),
  ]);
}

async function pollMode(mode: GameMode) {
  try {
    const data = await fetchWinGoData(mode);
    if (data && data.length > 0) {
      const state = engines[mode];
      const unseen = data
        .filter((d) => !state.seen_periods.has(d.issueNumber))
        .reverse();
      for (const item of unseen) {
        processPeriodStep(mode, item.issueNumber, item.number);
      }
    }
  } catch {
    // ignore transient network errors
  }
}

async function pollAllModes() {
  await Promise.all([pollMode('30S'), pollMode('1M')]);
}

function serializeModeState(mode: GameMode) {
  const s = engines[mode];
  return {
    mode: s.mode,
    stats: s.stats,
    current_prediction: s.current_prediction,
    history_log: s.history_log,
    last_results_ints: s.last_results_ints,
    prev_prediction: s.prev_prediction,
    latest_telemetry: s.latest_telemetry,
    last_sync_time: s.last_sync_time,
    server_active: s.server_active,
    raw_api_feed: s.raw_api_feed,
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  await resetAllModes();
  // Continuous polling every 2 seconds for both 30S and 1M live feeds
  setInterval(pollAllModes, 2000);

  // Get State for requested mode (plus both modes payload for instant switching)
  app.get('/api/engine/state', async (req, res) => {
    const mode: GameMode = req.query.mode === '30S' ? '30S' : '1M';
    if (engines[mode].history_log.length === 0) {
      await resetModeToFreshLiveSession(mode);
    }
    res.json({
      ...serializeModeState(mode),
      modes: {
        '30S': serializeModeState('30S'),
        '1M': serializeModeState('1M'),
      },
    });
  });

  // Force Immediate Live Sync
  app.post('/api/engine/sync', async (req, res) => {
    const mode: GameMode = req.body?.mode === '30S' ? '30S' : '1M';
    await pollAllModes();
    res.json({
      ...serializeModeState(mode),
      modes: {
        '30S': serializeModeState('30S'),
        '1M': serializeModeState('1M'),
      },
    });
  });

  // Auto-Wipe History & Reset to Fresh Live Session (Triggered on page open / back / exit)
  app.post('/api/engine/reset-live', async (req, res) => {
    const targetMode = req.body?.mode as GameMode | undefined;
    if (targetMode === '30S' || targetMode === '1M') {
      await resetModeToFreshLiveSession(targetMode);
    } else {
      await resetAllModes();
    }
    const activeMode: GameMode = targetMode === '30S' ? '30S' : '1M';
    res.json({
      ...serializeModeState(activeMode),
      modes: {
        '30S': serializeModeState('30S'),
        '1M': serializeModeState('1M'),
      },
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`JUJUTSU SCRIPT V3 (30S + 1M) Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
