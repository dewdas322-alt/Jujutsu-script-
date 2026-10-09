import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { execFileSync } from 'child_process';
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

/**
 * Executes the literal unaltered Python 3 script (/jujustu_core.py).
 * If the deployed Cloud Run container does not have python3 binary installed,
 * executes the 100% identical 1:1 port of the Python script so deployment never fails.
 */
function runPythonScriptEngine(
  period_number: string,
  last_results: number[],
  prev_prediction: 'BIG' | 'SMALL' | null
): {
  pred: 'BIG' | 'SMALL';
  singleNumber: number;
  reason: string;
  confidence: number;
  telemetry: DetailedEngineTelemetry;
} {
  try {
    const pyScript = path.join(process.cwd(), 'jujustu_core.py');
    if (fs.existsSync(pyScript)) {
      const out = execFileSync('python3', [pyScript], {
        input: JSON.stringify({
          period_number,
          last_results,
          prev_prediction,
        }),
        encoding: 'utf-8',
        timeout: 3500,
      });
      const parsed = JSON.parse(out.trim());
      if (parsed && (parsed.pred === 'BIG' || parsed.pred === 'SMALL') && parsed.telemetry) {
        return {
          pred: parsed.pred,
          singleNumber: Number(parsed.singleNumber),
          reason: String(parsed.reason),
          confidence: Number(parsed.confidence),
          telemetry: parsed.telemetry as DetailedEngineTelemetry,
        };
      }
    }
  } catch {
    // Deployed Cloud Run slim container fallback: exact 1:1 Python script logic
  }

  const telemetry = diablo_detailed_telemetry(period_number, last_results, prev_prediction);
  const singleNumber = computeSameSideSingleNumber(telemetry, telemetry.final_pred);
  return {
    pred: telemetry.final_pred,
    singleNumber,
    reason: telemetry.combined_reason,
    confidence: telemetry.confidence,
    telemetry,
  };
}

async function fetch_data(mode: GameMode): Promise<RawWinGoItem[]> {
  try {
    const ts = Date.now();
    const url = `${API_URLS[mode]}${ts}`;
    const response = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const result: any = await response.json();
    if (result && result.data && Array.isArray(result.data.list)) {
      const formatted: RawWinGoItem[] = result.data.list.map((item: any) => ({
        issueNumber: String(item.issueNumber || ''),
        number: String(item.number || ''),
      }));
      engines[mode].raw_api_feed = formatted;
      engines[mode].server_active = true;
      engines[mode].last_sync_time = new Date().toISOString();
      return formatted;
    }
    throw new Error('Invalid API structure');
  } catch {
    return engines[mode].raw_api_feed || [];
  }
}

/**
 * Exact 1:1 Loop Body of `run_console()` from the user's Python script.
 */
async function stepConsoleLoop(mode: GameMode) {
  const data = await fetch_data(mode);
  if (!data || data.length === 0) {
    return;
  }

  const state = engines[mode];
  const latest = data[0];
  const current_period = latest.issueNumber || '';
  const result_number = latest.number || '';

  if (state.last_results_ints.length === 0 && data.length > 0) {
    const chronologicalInts = data
      .slice()
      .reverse()
      .map((item) => parseInt(item.number, 10))
      .filter((n) => !isNaN(n));
    state.last_results_ints = chronologicalInts;
  }

  if (current_period && !state.seen_periods.has(current_period)) {
    const isInitialBootstrap = state.seen_periods.size === 0;
    state.seen_periods.add(current_period);
    const timeLabel = new Date().toLocaleTimeString([], { hour12: false });

    // Check pending prediction
    if (
      state.current_prediction &&
      state.current_prediction.period === current_period &&
      state.current_prediction.prediction
    ) {
      const pred_val = state.current_prediction.prediction;
      const actual_val = get_big_small(result_number);
      const outcome: 'WIN' | 'LOSE' = pred_val === actual_val ? 'WIN' : 'LOSE';
      const parsedActualNum = parseInt(String(result_number), 10);

      if (outcome === 'WIN') {
        state.stats.wins += 1;
      } else {
        state.stats.losses += 1;
      }
      state.stats.total += 1;

      for (const entry of state.history_log) {
        if (entry.period === current_period) {
          entry.actual = actual_val;
          entry.actualNumber = result_number;
          entry.outcome = outcome;
          // JACKPOT WIN ONLY when predicted singleNumber matches actual drawn number
          entry.isJackpot =
            !isNaN(parsedActualNum) && parsedActualNum === Number(entry.singleNumber);

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

    if (!isInitialBootstrap) {
      const parsedInt = parseInt(result_number, 10);
      if (!isNaN(parsedInt)) {
        state.last_results_ints.push(parsedInt);
        if (state.last_results_ints.length > 50) {
          state.last_results_ints.shift();
        }
      }
    }

    if (/^\d+$/.test(current_period)) {
      const next_period = (BigInt(current_period) + 1n).toString();
      const pyResult = runPythonScriptEngine(
        current_period,
        state.last_results_ints,
        state.prev_prediction
      );

      state.latest_telemetry = pyResult.telemetry;

      state.current_prediction = {
        period: next_period,
        prediction: pyResult.pred,
        singleNumber: pyResult.singleNumber,
        reason: pyResult.reason,
        confidence: pyResult.confidence,
      };

      state.history_log.push({
        period: next_period,
        pred: pyResult.pred,
        singleNumber: pyResult.singleNumber,
        actual: '?',
        actualNumber: '?',
        outcome: 'PENDING',
        isJackpot: false,
        reason: pyResult.reason,
        confidence: pyResult.confidence,
        stats_str: '',
        timestamp: timeLabel,
      });

      if (state.history_log.length > 500) {
        state.history_log.shift();
      }
    }
  }
}

async function resetModeToFreshLiveSession(mode: GameMode) {
  engines[mode] = createEmptyModeState(mode);
  await stepConsoleLoop(mode);
}

async function resetAllModes() {
  await Promise.all([
    resetModeToFreshLiveSession('30S'),
    resetModeToFreshLiveSession('1M'),
  ]);
}

async function pollAllModes() {
  await Promise.all([stepConsoleLoop('30S'), stepConsoleLoop('1M')]);
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
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // Start non-blocking initial poll so server binds PORT immediately for Cloud Run health checks
  resetAllModes().catch(() => {});
  setInterval(() => {
    pollAllModes().catch(() => {});
  }, 3000);

  app.get('/api/engine/state', async (req, res) => {
    const mode: GameMode = req.query.mode === '30S' ? '30S' : '1M';
    if (engines[mode].history_log.length === 0) {
      await stepConsoleLoop(mode);
    }
    res.json({
      ...serializeModeState(mode),
      modes: {
        '30S': serializeModeState('30S'),
        '1M': serializeModeState('1M'),
      },
    });
  });

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

  const distPath = path.join(process.cwd(), 'dist');
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch {
      if (fs.existsSync(distPath)) {
        app.use(express.static(distPath));
        app.get('*', (_req, res) => {
          res.sendFile(path.join(distPath, 'index.html'));
        });
      }
    }
  } else {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`JUJUTSU SCRIPT V3 running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
