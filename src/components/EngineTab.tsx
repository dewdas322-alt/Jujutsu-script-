import React, { useState, useMemo } from 'react';
import {
  Cpu,
  Play,
  Code2,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from 'lucide-react';
import {
  DetailedEngineTelemetry,
  diablo_detailed_telemetry,
  get_big_small,
} from '../engine/jujustuEngine';

interface EngineTabProps {
  latestTelemetry: DetailedEngineTelemetry | null;
  lastResultsInts: number[];
  prevPrediction: 'BIG' | 'SMALL' | null;
}

const EXACT_PYTHON_LOGIC_SOURCE = `# ==================================================
# 🧮 OLD CORE LOGIC 1: Master Calculation (UNCHANGED)
# ==================================================
def master_calculation_prediction(period_number, last_results):
    n = int(period_number)
    last_ints = [int(x) for x in last_results] if last_results else [0]

    base_calc = ((n * 73) - (n % 43)) % 10
    history_factor = sum(last_ints) % 10
    math_modifier = (n ** 2) % 9
    statistical_mean = int(statistics.mean(last_ints[-5:])) % 10 if len(last_ints) >= 5 else 0
    method1 = (base_calc + history_factor + math_modifier + statistical_mean) % 10

    shift = (n % 7) + (len(last_ints) % 3)
    trend_factor = (sum(last_ints[-3:]) if len(last_ints) >= 3 else sum(last_ints)) % 10
    method2 = (n + shift + trend_factor) % 10

    mirror = int(str(n)[::-1]) % 10 if len(str(n)) > 1 else n % 10
    reverse_factor = (mirror + (sum(last_ints[-4:]) if len(last_ints) >= 4 else 0)) % 10
    method3 = (reverse_factor * 3 + n) % 10

    weights = [0.2, 0.15, 0.25, 0.1, 0.3]
    if len(last_ints) >= 5:
        weighted_sum = sum(int(x) * w for x, w in zip(last_ints[-5:], weights))
    else:
        weighted_sum = sum(last_ints) * 0.5
    method4 = int(weighted_sum + n % 5) % 10

    avg_last = int(statistics.mean(last_ints)) % 10 if last_ints else 0
    chaos = (n * 97 + sum(last_ints) * 31) % 10
    method5 = (avg_last + chaos + n) % 10

    results = [
        "BIG" if method1 >= 5 else "SMALL",
        "BIG" if method2 >= 5 else "SMALL",
        "BIG" if method3 >= 5 else "SMALL",
        "BIG" if method4 >= 5 else "SMALL",
        "BIG" if method5 >= 5 else "SMALL",
    ]
    big_count = results.count("BIG")
    small_count = results.count("SMALL")
    if big_count > small_count:
        return "BIG"
    elif small_count > big_count:
        return "SMALL"
    else:
        return "BIG" if method5 >= 5 else "SMALL"

# ==================================================
# 🥋 DIABLO PREMIUM ENSEMBLE PREDICTOR (UNCHANGED)
# ==================================================
def diablo_premium_predictor(period_number, last_results, prev_prediction):
    sb_pred, sb_reason = streak_break_prediction(last_results)
    mom_pred, mom_reason = momentum_prediction(last_results)
    mk_pred, mk_reason = markov_chain_decay(last_results)
    fb_pred, fb_reason = freq_balance_prediction(last_results)
    p_hybrid = hybrid_prediction(period_number, last_results, prev_prediction)
    p_master = master_calculation_prediction(period_number, last_results)

    if sb_pred is not None:
        if sb_pred == mk_pred:
            return sb_pred, f"{sb_reason} + {mk_reason}", 92
        elif sb_pred == mom_pred:
            return sb_pred, f"{sb_reason} + {mom_reason}", 88
        else:
            return sb_pred, f"{sb_reason}", 85

    votes = {"BIG": 0.0, "SMALL": 0.0}
    weighted_logics = [
        (mom_pred, 2.5, mom_reason),
        (mk_pred, 2.0, mk_reason),
        (fb_pred, 1.5, fb_reason),
        (p_hybrid, 1.0, "fallback-hybrid"),
        (p_master, 1.0, "fallback-master")
    ]
    ...`;

export const EngineTab: React.FC<EngineTabProps> = ({
  latestTelemetry,
  lastResultsInts,
  prevPrediction,
}) => {
  // Interactive Sandbox state for testing custom period & historical sequence
  const [simPeriod, setSimPeriod] = useState<string>(
    latestTelemetry?.period_number || '20261008100011088'
  );
  const [simSequence, setSimSequence] = useState<string>(
    lastResultsInts.length > 0
      ? lastResultsInts.slice(-15).join(', ')
      : '3, 0, 8, 8, 7, 8, 4, 7, 0, 2, 6, 9, 1, 5, 3'
  );
  const [simPrevPred, setSimPrevPred] = useState<'BIG' | 'SMALL' | 'NONE'>(
    prevPrediction || 'BIG'
  );
  const [useSandboxMode, setUseSandboxMode] = useState<boolean>(false);
  const [showSourceCode, setShowSourceCode] = useState<boolean>(false);

  const parsedSandboxTelemetry = useMemo(() => {
    const nums = simSequence
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n >= 0 && n <= 9);
    const cleanP = simPeriod.replace(/\D/g, '') || '20261008100011088';
    return diablo_detailed_telemetry(
      cleanP,
      nums.length > 0 ? nums : [5],
      simPrevPred === 'NONE' ? null : simPrevPred
    );
  }, [simPeriod, simSequence, simPrevPred]);

  const activeTelemetry = useSandboxMode
    ? parsedSandboxTelemetry
    : latestTelemetry || parsedSandboxTelemetry;

  const totalVotes =
    activeTelemetry.votes.BIG + activeTelemetry.votes.SMALL || 1;
  const bigVotePct = Math.round((activeTelemetry.votes.BIG / totalVotes) * 100);
  const smallVotePct = 100 - bigVotePct;

  const syncSandboxWithLive = () => {
    if (latestTelemetry) {
      setSimPeriod(latestTelemetry.period_number);
    }
    if (lastResultsInts.length > 0) {
      setSimSequence(lastResultsInts.slice(-15).join(', '));
    }
    setSimPrevPred(prevPrediction || 'NONE');
    setUseSandboxMode(false);
  };

  return (
    <div className="space-y-8">
      {/* SECTION 1: ENSEMBLE ARCHITECTURE & WEIGHTED VOTING MATRIX */}
      <section className="rounded-xl border border-red-900/40 bg-[#120A0C] p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-red-950/60">
          <div>
            <div className="flex items-center gap-2 text-xs text-red-400 mb-1">
              <span>01. Diablo Premium Ensemble Predictor</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">
                {useSandboxMode ? 'SANDBOX SIMULATION MODE' : 'LIVE TELEMETRY STREAM'}
              </span>
            </div>
            <h2 className="font-display text-2xl font-bold text-white tracking-tight">
              Multi-Layer Weighted Consensus & Priority Trend Lock
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setUseSandboxMode(false)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                !useSandboxMode
                  ? 'bg-red-600 text-white'
                  : 'bg-[#090607] text-neutral-400 hover:text-neutral-200 border border-red-950/80'
              }`}
            >
              Live Stream State
            </button>
            <button
              onClick={() => setUseSandboxMode(true)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                useSandboxMode
                  ? 'bg-red-600 text-white'
                  : 'bg-[#090607] text-neutral-400 hover:text-neutral-200 border border-red-950/80'
              }`}
            >
              Interactive Simulator
            </button>
          </div>
        </div>

        {/* Weighted Vote Bar & Final Decision */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-8 space-y-4">
            <div className="flex items-center justify-between text-xs font-mono tabular-nums">
              <span className="text-emerald-400 font-semibold">
                BIG WEIGHT: {activeTelemetry.votes.BIG.toFixed(1)} pts ({bigVotePct}%)
              </span>
              <span className="text-neutral-400">
                Max Ensemble Weight: 8.0 pts
              </span>
              <span className="text-red-400 font-semibold">
                SMALL WEIGHT: {activeTelemetry.votes.SMALL.toFixed(1)} pts ({smallVotePct}%)
              </span>
            </div>

            <div className="h-3.5 w-full rounded-lg bg-[#090607] border border-red-950/80 overflow-hidden flex">
              <div
                className="h-full bg-emerald-500 transition-all duration-200"
                style={{ width: `${bigVotePct}%` }}
              />
              <div
                className="h-full bg-red-600 transition-all duration-200"
                style={{ width: `${smallVotePct}%` }}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-400 pt-1">
              <div>
                Formula:{' '}
                <code className="text-neutral-200">
                  confidence = clamp(60, 99, int(50 + (win_prob * 15)))
                </code>
              </div>
              <div>
                Priority Lock:{' '}
                <strong
                  className={
                    activeTelemetry.trend_lock_triggered
                      ? 'text-yellow-400'
                      : 'text-neutral-300'
                  }
                >
                  {activeTelemetry.trend_lock_triggered
                    ? 'ENGAGED (Streak >= 4 Override)'
                    : 'Normal Weighted Voting'}
                </strong>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 lg:border-l lg:border-red-950/60 lg:pl-6 flex items-center justify-between">
            <div>
              <div className="text-xs text-neutral-400">Evaluated Target</div>
              <div className="font-mono text-sm font-semibold text-white tabular-nums mt-0.5">
                {activeTelemetry.next_period}
              </div>
              <div className="text-xs font-mono text-red-300 mt-1">
                {activeTelemetry.combined_reason}
              </div>
            </div>

            <div className="text-right">
              <div className="font-display text-3xl font-extrabold text-yellow-400">
                {activeTelemetry.final_pred}
              </div>
              <div className="font-mono text-xs text-neutral-400 tabular-nums mt-0.5">
                {activeTelemetry.confidence}% Confidence
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: FOUR NEW ADVANCED DIABLO PATTERN LOGICS */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-white">
            02. Diablo Pattern AI Sub-Engines (Real-Time Weights & Signals)
          </h3>
          <span className="text-xs text-neutral-400">
            Unaltered rules from Python script
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* Card 1: Momentum Prediction */}
          <div className="rounded-xl border border-red-900/40 bg-[#120A0C] p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-neutral-400 mb-2">
                <span>momentum_prediction()</span>
                <span className="font-mono text-red-400 font-semibold">Weight: 2.5x</span>
              </div>
              <div className="font-display text-xl font-bold text-white">
                Momentum Tracker
              </div>
              <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">
                Scans the last 5 results (`recent_5`) to measure active directional run length and rides immediate momentum.
              </p>
            </div>

            <div className="mt-5 pt-4 border-t border-red-950/60 flex items-end justify-between font-mono tabular-nums">
              <div>
                <div className="text-xs text-neutral-500">Current Run</div>
                <div className="text-sm text-neutral-200 font-semibold">
                  {activeTelemetry.sub_engines.momentum.current_streak} consecutive
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-neutral-500">Output</div>
                <div className="text-lg font-bold text-yellow-400">
                  {activeTelemetry.sub_engines.momentum.pred}
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Markov Chain Decay */}
          <div className="rounded-xl border border-red-900/40 bg-[#120A0C] p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-neutral-400 mb-2">
                <span>markov_chain_decay()</span>
                <span className="font-mono text-red-400 font-semibold">Weight: 2.0x</span>
              </div>
              <div className="font-display text-xl font-bold text-white">
                Markov Chain Decay
              </div>
              <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">
                Analyzes 20-period state transitions from current state with linear recency weights (`1..k`).
              </p>
            </div>

            <div className="mt-5 pt-4 border-t border-red-950/60 flex items-end justify-between font-mono tabular-nums">
              <div>
                <div className="text-xs text-neutral-500">Transition Weights</div>
                <div className="text-xs text-neutral-200 font-semibold">
                  B:{activeTelemetry.sub_engines.markov.weighted_big} / S:
                  {activeTelemetry.sub_engines.markov.weighted_small}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-neutral-500">Output</div>
                <div className="text-lg font-bold text-yellow-400">
                  {activeTelemetry.sub_engines.markov.pred}
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Frequency Balance */}
          <div className="rounded-xl border border-red-900/40 bg-[#120A0C] p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-neutral-400 mb-2">
                <span>freq_balance_prediction()</span>
                <span className="font-mono text-red-400 font-semibold">Weight: 1.5x</span>
              </div>
              <div className="font-display text-xl font-bold text-white">
                Frequency Equilibrium
              </div>
              <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">
                Counts 10-period BIG/SMALL ratio. Forces mean-reversion when either side hits &ge;7 occurrences.
              </p>
            </div>

            <div className="mt-5 pt-4 border-t border-red-950/60 flex items-end justify-between font-mono tabular-nums">
              <div>
                <div className="text-xs text-neutral-500">10-Round Split</div>
                <div className="text-sm text-neutral-200 font-semibold">
                  {activeTelemetry.sub_engines.freq_balance.big_count}B /{' '}
                  {activeTelemetry.sub_engines.freq_balance.small_count}S
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-neutral-500">Output</div>
                <div className="text-lg font-bold text-yellow-400">
                  {activeTelemetry.sub_engines.freq_balance.pred}
                </div>
              </div>
            </div>
          </div>

          {/* Card 4: Streak Break Detector */}
          <div className="rounded-xl border border-red-900/40 bg-[#120A0C] p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-neutral-400 mb-2">
                <span>streak_break_prediction()</span>
                <span className="font-mono text-yellow-400 font-semibold">Priority Lock</span>
              </div>
              <div className="font-display text-xl font-bold text-white">
                Streak Break Guard
              </div>
              <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">
                Triggers High-Priority Trend Lock (85%–92% confidence) when consecutive streak reaches &ge;4.
              </p>
            </div>

            <div className="mt-5 pt-4 border-t border-red-950/60 flex items-end justify-between font-mono tabular-nums">
              <div>
                <div className="text-xs text-neutral-500">Streak Status</div>
                <div className="text-sm text-neutral-200 font-semibold">
                  run={activeTelemetry.sub_engines.streak_break.current_streak} / 4
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-neutral-500">Override</div>
                <div className="text-lg font-bold text-yellow-400">
                  {activeTelemetry.sub_engines.streak_break.pred || 'STANDBY'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: CORE LOGIC 1 (MASTER CALCULATION) & CORE LOGIC 2 (HYBRID) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Core Logic 1: 5-Method Master Calculation */}
        <div className="lg:col-span-7 rounded-xl border border-red-900/40 bg-[#120A0C] p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-red-950/60">
            <div>
              <div className="text-xs text-red-400">03. Core Logic 1 · Weight: 1.0x</div>
              <h3 className="font-display text-lg font-bold text-white">
                Master Calculation 5-Method Matrix (`master_calculation_prediction`)
              </h3>
            </div>
            <div className="font-mono text-xs text-neutral-300 tabular-nums">
              Majority:{' '}
              <strong className="text-yellow-400">
                {activeTelemetry.sub_engines.master.final_prediction}
              </strong>{' '}
              ({activeTelemetry.sub_engines.master.big_count}B /{' '}
              {activeTelemetry.sub_engines.master.small_count}S)
            </div>
          </div>

          <div className="mt-4 divide-y divide-red-950/40 font-mono text-xs tabular-nums">
            {[
              {
                name: 'Method 1 (Base + History + Mod + Mean)',
                formula: '((n*73 - n%43)%10 + sum%10 + (n**2)%9 + mean5) % 10',
                val: activeTelemetry.sub_engines.master.method1,
                res: activeTelemetry.sub_engines.master.results[0],
              },
              {
                name: 'Method 2 (Shift + 3-Round Trend)',
                formula: '(n + (n%7 + len%3) + sum(last_3)%10) % 10',
                val: activeTelemetry.sub_engines.master.method2,
                res: activeTelemetry.sub_engines.master.results[1],
              },
              {
                name: 'Method 3 (Mirror Reverse Factor)',
                formula: '(((rev(n)%10 + sum(last_4))%10) * 3 + n) % 10',
                val: activeTelemetry.sub_engines.master.method3,
                res: activeTelemetry.sub_engines.master.results[2],
              },
              {
                name: 'Method 4 (5-Point Weighted Vector)',
                formula: 'int(dot(last_5, [0.2, 0.15, 0.25, 0.1, 0.3]) + n%5) % 10',
                val: activeTelemetry.sub_engines.master.method4,
                res: activeTelemetry.sub_engines.master.results[3],
              },
              {
                name: 'Method 5 (Chaos Prime Tie-Breaker)',
                formula: '(avg_last + (n*97 + sum*31)%10 + n) % 10',
                val: activeTelemetry.sub_engines.master.method5,
                res: activeTelemetry.sub_engines.master.results[4],
              },
            ].map((m, idx) => (
              <div
                key={idx}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <div className="text-neutral-200 font-semibold">{m.name}</div>
                  <div className="text-neutral-500 text-[11px]">{m.formula}</div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <span className="text-neutral-400">
                    Val: <strong className="text-white">{m.val}</strong>
                  </span>
                  <span
                    className={`w-14 text-right font-bold ${
                      m.res === 'BIG' ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {m.res}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Core Logic 2: Hybrid Prediction & Interactive Simulator */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Hybrid Logic Box */}
          <div className="rounded-xl border border-red-900/40 bg-[#120A0C] p-6">
            <div className="pb-4 border-b border-red-950/60 flex items-center justify-between">
              <div>
                <div className="text-xs text-red-400">04. Core Logic 2 · Weight: 1.0x</div>
                <h3 className="font-display text-lg font-bold text-white">
                  Hybrid & Stable Logic (`hybrid_prediction`)
                </h3>
              </div>
              <span className="font-mono text-sm font-bold text-yellow-400">
                {activeTelemetry.sub_engines.hybrid.pred}
              </span>
            </div>

            <div className="mt-4 space-y-2.5 text-xs text-neutral-300">
              <div className="flex items-center justify-between font-mono">
                <span className="text-neutral-400">Deterministic `stable_logic()`:</span>
                <span className="font-bold text-white">
                  {activeTelemetry.sub_engines.hybrid.stable_pred}
                </span>
              </div>
              <div className="flex items-center justify-between font-mono">
                <span className="text-neutral-400">Last-3 Period Parity Check:</span>
                <span className="text-neutral-200">
                  sum(period[-3:]) % 2 == 0
                </span>
              </div>
              <div className="flex items-center justify-between font-mono">
                <span className="text-neutral-400">Master Cross-Injection:</span>
                <span className="text-neutral-200">15% stochastic branch</span>
              </div>
            </div>
          </div>

          {/* Interactive Period & Sequence Sandbox */}
          <div className="rounded-xl border border-red-900/40 bg-[#120A0C] p-6 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs text-red-400 font-medium">
                  05. Live Formula Verification Sandbox
                </div>
                <button
                  onClick={syncSandboxWithLive}
                  className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Load Live Data</span>
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">
                    Test Period Number (`period_number`)
                  </label>
                  <input
                    type="text"
                    value={simPeriod}
                    onChange={(e) => {
                      setSimPeriod(e.target.value);
                      setUseSandboxMode(true);
                    }}
                    className="w-full px-3 py-2 text-xs font-mono bg-[#090607] border border-red-950/80 rounded-lg text-white focus:outline-none focus:border-red-600"
                  />
                </div>

                <div>
                  <label className="block text-xs text-neutral-400 mb-1">
                    Last Results Sequence (Comma-separated digits 0–9)
                  </label>
                  <input
                    type="text"
                    value={simSequence}
                    onChange={(e) => {
                      setSimSequence(e.target.value);
                      setUseSandboxMode(true);
                    }}
                    className="w-full px-3 py-2 text-xs font-mono bg-[#090607] border border-red-950/80 rounded-lg text-white focus:outline-none focus:border-red-600"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-red-950/60 flex items-center justify-between">
              <span className="text-xs text-neutral-400">
                Simulated Output:{' '}
                <strong className="font-mono text-yellow-400">
                  {parsedSandboxTelemetry.final_pred} ({parsedSandboxTelemetry.confidence}%)
                </strong>
              </span>
              <button
                onClick={() => setUseSandboxMode(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors cursor-pointer"
              >
                <Play className="w-3 h-3" />
                <span>Apply to View</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: UNALTERED PYTHON SOURCE INSPECTOR */}
      <section className="rounded-xl border border-red-900/40 bg-[#120A0C] overflow-hidden">
        <button
          onClick={() => setShowSourceCode((prev) => !prev)}
          className="w-full p-5 flex items-center justify-between text-left hover:bg-red-950/20 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <Code2 className="w-5 h-5 text-red-400" />
            <div>
              <h3 className="font-display text-base font-bold text-white">
                View Unaltered Python Core & Ensemble Logic Reference
              </h3>
              <p className="text-xs text-neutral-400">
                Verify 1:1 mathematical parity with the original JUJUSTU SCRIPT V3 source code
              </p>
            </div>
          </div>
          {showSourceCode ? (
            <ChevronUp className="w-4 h-4 text-neutral-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-neutral-400" />
          )}
        </button>

        {showSourceCode && (
          <div className="p-5 border-t border-red-950/60 bg-[#080405] overflow-x-auto">
            <pre className="font-mono text-xs text-neutral-300 leading-relaxed">
              {EXACT_PYTHON_LOGIC_SOURCE}
            </pre>
          </div>
        )}
      </section>
    </div>
  );
};
