import React, { useState, useMemo } from 'react';
import {
  Calculator,
  Bookmark,
  Trash2,
  Download,
  Terminal,
  Copy,
  Check,
  Volume2,
  VolumeX,
  Plus,
} from 'lucide-react';
import { HistoryLogEntry, EngineStats } from '../engine/jujustuEngine';

export interface PersonalTrade {
  id: string;
  period: string;
  side: 'BIG' | 'SMALL';
  amount: number;
  outcome: 'WIN' | 'LOSE';
  profit: number;
  time: string;
}

interface MyTabProps {
  stats: EngineStats;
  historyLog: HistoryLogEntry[];
  currentPrediction: {
    period?: string;
    prediction?: 'BIG' | 'SMALL';
    reason?: string;
    confidence?: number;
  };
  bookmarkedEntries: HistoryLogEntry[];
  onRemoveBookmark: (period: string) => void;
  onClearBookmarks: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  pollIntervalMs: number;
  onChangePollInterval: (ms: number) => void;
  defaultNewestAtBottom: boolean;
  onToggleDefaultOrder: () => void;
  onExportCSV: () => void;
  onExportJSON: () => void;
  personalTrades: PersonalTrade[];
  onAddTrade: (trade: Omit<PersonalTrade, 'id' | 'time' | 'profit'>) => void;
  onDeleteTrade: (id: string) => void;
}

export const MyTab: React.FC<MyTabProps> = ({
  stats,
  historyLog,
  currentPrediction,
  bookmarkedEntries,
  onRemoveBookmark,
  onClearBookmarks,
  soundEnabled,
  onToggleSound,
  pollIntervalMs,
  onChangePollInterval,
  defaultNewestAtBottom,
  onToggleDefaultOrder,
  onExportCSV,
  onExportJSON,
  personalTrades,
  onAddTrade,
  onDeleteTrade,
}) => {
  // 1. Capital & 7-Level Martingale Planner State
  const [totalBankroll, setTotalBankroll] = useState<number>(10000);
  const [baseBet, setBaseBet] = useState<number>(100);
  const [multiplier, setMultiplier] = useState<number>(2.2);
  const [payoutRate, setPayoutRate] = useState<number>(1.96);

  // 2. Personal Trade Logger Form State
  const [tradeAmount, setTradeAmount] = useState<string>('100');
  const [tradeSide, setTradeSide] = useState<'BIG' | 'SMALL'>(
    currentPrediction.prediction || 'BIG'
  );
  const [tradeOutcome, setTradeOutcome] = useState<'WIN' | 'LOSE'>('WIN');
  const [copiedConsole, setCopiedConsole] = useState<boolean>(false);

  // Calculate current consecutive loss count from live history to highlight active Martingale level
  const consecutiveLosses = useMemo(() => {
    const evaluated = historyLog.filter((h) => h.outcome === 'WIN' || h.outcome === 'LOSE');
    let losses = 0;
    for (let i = evaluated.length - 1; i >= 0; i--) {
      if (evaluated[i].outcome === 'LOSE') losses++;
      else break;
    }
    return losses;
  }, [historyLog]);

  // Build 7-step level table
  const levelPlan = useMemo(() => {
    const levels = [];
    let cumulativeCost = 0;
    for (let lvl = 1; lvl <= 7; lvl++) {
      const bet = Math.round(baseBet * Math.pow(multiplier, lvl - 1));
      cumulativeCost += bet;
      const grossReturn = Math.round(bet * payoutRate);
      const netProfit = grossReturn - cumulativeCost;
      const withinBankroll = cumulativeCost <= totalBankroll;
      levels.push({
        level: lvl,
        bet,
        cumulativeCost,
        grossReturn,
        netProfit,
        withinBankroll,
      });
    }
    return levels;
  }, [totalBankroll, baseBet, multiplier, payoutRate]);

  // Personal Trade Ledger Summary
  const personalSummary = useMemo(() => {
    const totalWins = personalTrades.filter((t) => t.outcome === 'WIN').length;
    const totalNet = personalTrades.reduce((acc, t) => acc + t.profit, 0);
    const winPct =
      personalTrades.length > 0
        ? ((totalWins / personalTrades.length) * 100).toFixed(1)
        : '0.0';
    return { totalWins, totalNet, winPct };
  }, [personalTrades]);

  const handleLogTrade = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Math.max(1, Number(tradeAmount) || 100);
    onAddTrade({
      period: currentPrediction.period || 'Manual',
      side: tradeSide,
      amount: amt,
      outcome: tradeOutcome,
    });
  };

  // Classic Console Text Replica (Matches render_dashboard in Python script)
  const consoleSnapshot = useMemo(() => {
    const lines: string[] = [];
    lines.push('🔥 JUJUSTU SCRIPT V3 ');
    lines.push('POWER BY @AJAYTREDERKING');
    lines.push('');
    lines.push(
      `${'PERIOD'.padEnd(18)} ${'PRED'.padEnd(8)} ${'ACTUAL'.padEnd(12)} ${'RESULT'.padEnd(28)} ${'WIN RATE'}`
    );
    lines.push('-'.repeat(85));

    const display_history = historyLog.slice(-25);
    for (const entry of display_history) {
      const period = entry.period.padEnd(18);
      const pred = entry.pred.padEnd(8);
      const isPending = entry.actual === '?' || entry.outcome === 'PENDING';
      const actualStr = isPending ? '...waiting  ' : entry.actual.padEnd(12);
      const reasonStr = entry.reason.slice(0, 27).padEnd(28);
      const icon = isPending ? ' ' : entry.outcome === 'WIN' ? '✅' : '❌';
      const outDisplay = isPending ? 'pending' : entry.outcome.padEnd(5);
      lines.push(
        `${period} ${pred} ${actualStr} ${reasonStr} ${icon} ${outDisplay} ${entry.stats_str}`
      );
    }

    lines.push('-'.repeat(85));
    const total = stats.wins + stats.losses;
    const wr = total > 0 ? ((stats.wins / total) * 100).toFixed(1) : '0.0';
    lines.push(
      `Server: ACTIVE | Total Predictions: ${total} | Overall Accuracy: ${wr}%`
    );
    return lines.join('\n');
  }, [historyLog, stats]);

  const copyConsoleToClipboard = () => {
    navigator.clipboard.writeText(consoleSnapshot);
    setCopiedConsole(true);
    setTimeout(() => setCopiedConsole(false), 2000);
  };

  const activeRecommendedLevel = Math.min(7, consecutiveLosses + 1);

  return (
    <div className="space-y-8">
      {/* SECTION 1: MY CAPITAL & 7-LEVEL MARTINGALE COMPOUNDING CALCULATOR */}
      <section className="rounded-xl border border-red-900/40 bg-[#120A0C] p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-red-950/60">
          <div>
            <div className="text-xs text-red-400 mb-1">
              01. Capital Allocation & Risk Shield
            </div>
            <h2 className="font-display text-2xl font-bold text-white tracking-tight">
              7-Level Dynamic Martingale & Fund Calculator
            </h2>
            <p className="text-xs text-neutral-400 mt-1">
              Automatically highlights the recommended step based on the live engine’s consecutive loss count (Currently: Level {activeRecommendedLevel})
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] text-neutral-400 mb-1">
                Total Capital
              </label>
              <input
                type="number"
                value={totalBankroll}
                onChange={(e) => setTotalBankroll(Math.max(100, Number(e.target.value)))}
                className="w-full px-3 py-1.5 text-xs font-mono bg-[#090607] border border-red-950/80 rounded-lg text-white focus:outline-none focus:border-red-600 tabular-nums"
              />
            </div>

            <div>
              <label className="block text-[11px] text-neutral-400 mb-1">
                Level 1 Base Bet
              </label>
              <input
                type="number"
                value={baseBet}
                onChange={(e) => setBaseBet(Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-1.5 text-xs font-mono bg-[#090607] border border-red-950/80 rounded-lg text-white focus:outline-none focus:border-red-600 tabular-nums"
              />
            </div>

            <div>
              <label className="block text-[11px] text-neutral-400 mb-1">
                Step Multiplier
              </label>
              <select
                value={multiplier}
                onChange={(e) => setMultiplier(Number(e.target.value))}
                className="w-full px-3 py-1.5 text-xs font-mono bg-[#090607] border border-red-950/80 rounded-lg text-white focus:outline-none focus:border-red-600"
              >
                <option value={2.0}>2.0x (Standard)</option>
                <option value={2.2}>2.2x (Recommended)</option>
                <option value={2.5}>2.5x (Aggressive)</option>
                <option value={3.0}>3.0x (Triple)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-neutral-400 mb-1">
                WinGo Payout
              </label>
              <input
                type="number"
                step="0.01"
                value={payoutRate}
                onChange={(e) => setPayoutRate(Math.max(1.1, Number(e.target.value)))}
                className="w-full px-3 py-1.5 text-xs font-mono bg-[#090607] border border-red-950/80 rounded-lg text-white focus:outline-none focus:border-red-600 tabular-nums"
              />
            </div>
          </div>
        </div>

        {/* 7-Level Table */}
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left border-collapse font-mono text-xs sm:text-sm tabular-nums">
            <thead>
              <tr className="border-b border-red-950/60 text-neutral-400 text-xs">
                <th className="py-2.5 px-4">STEP LEVEL</th>
                <th className="py-2.5 px-4 text-right">BET AMOUNT</th>
                <th className="py-2.5 px-4 text-right">CUMULATIVE COST</th>
                <th className="py-2.5 px-4 text-right">WIN PAYOUT</th>
                <th className="py-2.5 px-4 text-right">NET PROFIT</th>
                <th className="py-2.5 px-4 text-right">CAPITAL STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-950/30">
              {levelPlan.map((row) => {
                const isActiveStep = row.level === activeRecommendedLevel;
                return (
                  <tr
                    key={row.level}
                    className={
                      isActiveStep
                        ? 'bg-red-950/35 text-white font-semibold'
                        : 'text-neutral-300 hover:bg-white/[0.02]'
                    }
                  >
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span>Level {row.level}</span>
                      {isActiveStep && (
                        <span className="ml-2 text-xs text-yellow-400">
                          · Active Live Step
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right text-yellow-400 font-bold whitespace-nowrap">
                      {row.bet.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      {row.cumulativeCost.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4 text-right text-emerald-400 whitespace-nowrap">
                      {row.grossReturn.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4 text-right text-emerald-400 font-bold whitespace-nowrap">
                      +{row.netProfit.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      {row.withinBankroll ? (
                        <span className="text-emerald-400">Covered</span>
                      ) : (
                        <span className="text-red-400">Exceeds Capital</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* SECTION 2: BOOKMARKED PERIODS & PERSONAL TRADE EXECUTION LEDGER */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Saved / Bookmarked Periods (Left 6 Cols) */}
        <div className="lg:col-span-6 rounded-xl border border-red-900/40 bg-[#120A0C] p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-red-950/60">
              <div>
                <div className="text-xs text-red-400">02. Saved Signals</div>
                <h3 className="font-display text-lg font-bold text-white">
                  Bookmarked Periods ({bookmarkedEntries.length})
                </h3>
              </div>
              {bookmarkedEntries.length > 0 && (
                <button
                  onClick={onClearBookmarks}
                  className="text-xs text-neutral-400 hover:text-red-400 transition-colors cursor-pointer"
                >
                  Clear All
                </button>
              )}
            </div>

            <div className="mt-4 max-h-72 overflow-y-auto divide-y divide-red-950/40 font-mono text-xs tabular-nums">
              {bookmarkedEntries.length === 0 ? (
                <div className="py-12 text-center text-neutral-500 font-sans">
                  No periods bookmarked yet. Click the bookmark icon on any row in the Dashboard to pin key rounds here.
                </div>
              ) : (
                bookmarkedEntries.map((item) => (
                  <div
                    key={item.period}
                    className="py-3 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="text-white font-semibold">{item.period}</div>
                      <div className="text-neutral-500 text-[11px]">{item.reason}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-yellow-400 font-bold">{item.pred}</span>
                      <span
                        className={
                          item.outcome === 'WIN'
                            ? 'text-emerald-400 font-bold'
                            : item.outcome === 'LOSE'
                            ? 'text-red-400 font-bold'
                            : 'text-neutral-400'
                        }
                      >
                        {item.outcome}
                      </span>
                      <button
                        onClick={() => onRemoveBookmark(item.period)}
                        className="text-neutral-500 hover:text-red-400 transition-colors cursor-pointer"
                        title="Remove bookmark"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Personal Trade Execution Logger (Right 6 Cols) */}
        <div className="lg:col-span-6 rounded-xl border border-red-900/40 bg-[#120A0C] p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-red-950/60">
              <div>
                <div className="text-xs text-red-400">03. Personal Profit Tracker</div>
                <h3 className="font-display text-lg font-bold text-white">
                  My Executed Rounds
                </h3>
              </div>
              <div className="font-mono text-xs tabular-nums">
                Net P/L:{' '}
                <strong
                  className={
                    personalSummary.totalNet >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }
                >
                  {personalSummary.totalNet >= 0 ? '+' : ''}
                  {personalSummary.totalNet.toLocaleString()}
                </strong>{' '}
                · {personalSummary.winPct}% Win
              </div>
            </div>

            <form
              onSubmit={handleLogTrade}
              className="mt-4 grid grid-cols-1 sm:grid-cols-4 gap-2.5"
            >
              <input
                type="number"
                value={tradeAmount}
                onChange={(e) => setTradeAmount(e.target.value)}
                placeholder="Bet Amount"
                className="px-3 py-1.5 text-xs font-mono bg-[#090607] border border-red-950/80 rounded-lg text-white focus:outline-none focus:border-red-600 tabular-nums"
              />
              <select
                value={tradeSide}
                onChange={(e) => setTradeSide(e.target.value as 'BIG' | 'SMALL')}
                className="px-3 py-1.5 text-xs font-mono bg-[#090607] border border-red-950/80 rounded-lg text-yellow-400 focus:outline-none focus:border-red-600"
              >
                <option value="BIG">PRED: BIG</option>
                <option value="SMALL">PRED: SMALL</option>
              </select>
              <select
                value={tradeOutcome}
                onChange={(e) => setTradeOutcome(e.target.value as 'WIN' | 'LOSE')}
                className="px-3 py-1.5 text-xs font-mono bg-[#090607] border border-red-950/80 rounded-lg text-white focus:outline-none focus:border-red-600"
              >
                <option value="WIN">Outcome: WIN</option>
                <option value="LOSE">Outcome: LOSE</option>
              </select>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Log Trade</span>
              </button>
            </form>

            <div className="mt-4 max-h-52 overflow-y-auto divide-y divide-red-950/40 font-mono text-xs tabular-nums">
              {personalTrades.length === 0 ? (
                <div className="py-8 text-center text-neutral-500 font-sans">
                  Log your personal entries above to track real session profit and loss.
                </div>
              ) : (
                personalTrades.map((t) => (
                  <div
                    key={t.id}
                    className="py-2.5 flex items-center justify-between gap-2"
                  >
                    <div>
                      <span className="text-neutral-300">{t.period.slice(-6)}</span>
                      <span className="mx-2 text-yellow-400 font-bold">{t.side}</span>
                      <span className="text-neutral-500">Amt: {t.amount}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={
                          t.outcome === 'WIN'
                            ? 'text-emerald-400 font-bold'
                            : 'text-red-400 font-bold'
                        }
                      >
                        {t.profit >= 0 ? `+${t.profit}` : t.profit}
                      </span>
                      <button
                        onClick={() => onDeleteTrade(t.id)}
                        className="text-neutral-500 hover:text-red-400 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: PREFERENCES, AUDIO ALERTS & DATA EXPORT */}
      <section className="rounded-xl border border-red-900/40 bg-[#120A0C] p-6">
        <div className="pb-4 border-b border-red-950/60">
          <div className="text-xs text-red-400">04. System Preferences & Data Tools</div>
          <h3 className="font-display text-lg font-bold text-white">
            Sync Cadence, Audio Alerts & History Exports
          </h3>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Audio Alert Control */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-[#090607] border border-red-950/80">
            <div>
              <div className="text-sm font-medium text-white">Draw Settlement Chime</div>
              <div className="text-xs text-neutral-400">
                Synthesized audio tone when a new period resolves
              </div>
            </div>
            <button
              onClick={onToggleSound}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                soundEnabled
                  ? 'bg-red-600 text-white'
                  : 'bg-neutral-900 text-neutral-400 border border-red-950'
              }`}
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Active</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-3.5 h-3.5" />
                  <span>Muted</span>
                </>
              )}
            </button>
          </div>

          {/* Poll Interval Control */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-[#090607] border border-red-950/80">
            <div>
              <div className="text-sm font-medium text-white">API Poll Cadence</div>
              <div className="text-xs text-neutral-400">
                Python script default is 3.0 seconds
              </div>
            </div>
            <select
              value={pollIntervalMs}
              onChange={(e) => onChangePollInterval(Number(e.target.value))}
              className="px-3 py-1.5 text-xs font-mono bg-[#120A0C] border border-red-900/50 rounded-lg text-white focus:outline-none"
            >
              <option value={1500}>1.5s (Turbo)</option>
              <option value={3000}>3.0s (Script Default)</option>
              <option value={5000}>5.0s (Relaxed)</option>
            </select>
          </div>

          {/* Export Unlimited History */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-[#090607] border border-red-950/80">
            <div>
              <div className="text-sm font-medium text-white">Export Session Ledger</div>
              <div className="text-xs text-neutral-400">
                Download all {historyLog.length} recorded periods
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onExportCSV}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-red-950/60 hover:bg-red-900 text-red-200 border border-red-800/40 rounded-lg transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>CSV</span>
              </button>
              <button
                onClick={onExportJSON}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-[#120A0C] hover:bg-red-950/40 text-neutral-300 border border-red-950 rounded-lg transition-colors cursor-pointer"
              >
                <span>JSON</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: CLASSIC PYTHON TERMINAL CONSOLE REPLICA */}
      <section className="rounded-xl border border-red-900/40 bg-[#0A0506] overflow-hidden">
        <div className="px-6 py-4 bg-[#120A0C] border-b border-red-950/70 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Terminal className="w-4 h-4 text-red-400" />
            <h3 className="font-display text-sm font-bold text-white">
              Classic Terminal Output Replica (`render_dashboard`)
            </h3>
          </div>

          <button
            onClick={copyConsoleToClipboard}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-950/50 hover:bg-red-900/60 text-red-200 border border-red-800/40 rounded-lg transition-colors cursor-pointer"
          >
            {copiedConsole ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Copied Output</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Terminal Text</span>
              </>
            )}
          </button>
        </div>

        <div className="p-6 overflow-x-auto">
          <pre className="font-mono text-xs leading-relaxed text-neutral-200 tabular-nums">
            {consoleSnapshot}
          </pre>
        </div>
      </section>
    </div>
  );
};
