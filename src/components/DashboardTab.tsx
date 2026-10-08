import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Search,
  ArrowDownToLine,
  ArrowUpToLine,
  Bookmark,
  BookmarkCheck,
  RefreshCw,
  PlusCircle,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  SlidersHorizontal,
} from 'lucide-react';
import { HistoryLogEntry, EngineStats, DetailedEngineTelemetry } from '../engine/jujustuEngine';

interface DashboardTabProps {
  stats: EngineStats;
  currentPrediction: {
    period?: string;
    prediction?: 'BIG' | 'SMALL';
    reason?: string;
    confidence?: number;
  };
  historyLog: HistoryLogEntry[];
  lastResultsInts: number[];
  latestTelemetry: DetailedEngineTelemetry | null;
  serverActive: boolean;
  lastSyncTime: string;
  bookmarkedPeriods: string[];
  onToggleBookmark: (entry: HistoryLogEntry) => void;
  onForceSync: () => void;
  onBackfill: (count: number) => void;
  onResetLive: () => void;
  isSyncing: boolean;
  defaultNewestAtBottom: boolean;
  onNavigateTab: (tab: 'dashboard' | 'engine' | 'my') => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  stats,
  currentPrediction,
  historyLog,
  lastResultsInts,
  latestTelemetry,
  serverActive,
  bookmarkedPeriods,
  onToggleBookmark,
  onForceSync,
  onBackfill,
  onResetLive,
  isSyncing,
  defaultNewestAtBottom,
  onNavigateTab,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'WIN' | 'LOSE' | 'PENDING' | 'BIG' | 'SMALL'>('ALL');
  const [newestAtBottom, setNewestAtBottom] = useState<boolean>(defaultNewestAtBottom);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(60);

  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Sync 60s countdown clock with standard 1-minute WinGo cycle
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const sec = now.getSeconds();
      setSecondsRemaining(60 - sec);
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setNewestAtBottom(defaultNewestAtBottom);
  }, [defaultNewestAtBottom]);

  // Filter and order unlimited history log
  const filteredHistory = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = historyLog.filter((item) => {
      if (statusFilter === 'WIN' && item.outcome !== 'WIN') return false;
      if (statusFilter === 'LOSE' && item.outcome !== 'LOSE') return false;
      if (statusFilter === 'PENDING' && item.outcome !== 'PENDING') return false;
      if (statusFilter === 'BIG' && item.pred !== 'BIG') return false;
      if (statusFilter === 'SMALL' && item.pred !== 'SMALL') return false;

      if (!q) return true;
      return (
        item.period.toLowerCase().includes(q) ||
        item.reason.toLowerCase().includes(q) ||
        item.pred.toLowerCase().includes(q) ||
        item.actual.toLowerCase().includes(q)
      );
    });

    return newestAtBottom ? filtered : [...filtered].reverse();
  }, [historyLog, searchQuery, statusFilter, newestAtBottom]);

  // Auto-scroll to latest row when new prediction arrives
  useEffect(() => {
    if (!autoScroll || !tableContainerRef.current) return;
    const el = tableContainerRef.current;
    if (newestAtBottom) {
      el.scrollTop = el.scrollHeight;
    } else {
      el.scrollTop = 0;
    }
  }, [historyLog.length, newestAtBottom, autoScroll]);

  const scrollToLatest = () => {
    if (!tableContainerRef.current) return;
    const el = tableContainerRef.current;
    if (newestAtBottom) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    } else {
      el.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const winRate = stats.total > 0 ? ((stats.wins / stats.total) * 100).toFixed(1) : '0.0';

  // Calculate current consecutive win/loss streak from evaluated history
  const currentRun = useMemo(() => {
    const evaluated = historyLog.filter((h) => h.outcome === 'WIN' || h.outcome === 'LOSE');
    if (evaluated.length === 0) return { type: 'NONE', count: 0 };
    const lastOutcome = evaluated[evaluated.length - 1].outcome;
    let count = 0;
    for (let i = evaluated.length - 1; i >= 0; i--) {
      if (evaluated[i].outcome === lastOutcome) count++;
      else break;
    }
    return { type: lastOutcome, count };
  }, [historyLog]);

  return (
    <div className="space-y-8">
      {/* SECTION 1: FOCAL ANCHOR — ACTIVE PREDICTION COMMAND DECK */}
      <section className="relative overflow-hidden rounded-xl border border-red-900/40 bg-[#120A0C]">
        {/* Subtle Crimson Ambient Glow */}
        <div
          className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, #DC2626 0%, transparent 70%)' }}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-red-950/60">
          {/* Left 7 Cols: Active Next Period Prediction */}
          <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs text-red-300/70">
                <span className="inline-block h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                <span className="font-medium text-red-200">JUJUSTU SCRIPT V3 LIVE SIGNAL</span>
                <span aria-hidden="true">·</span>
                <span>POWER BY @AJAYTREDERKING</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">WinGo 1M</span>
              </div>

              <div className="flex items-center gap-3 text-xs font-mono tabular-nums text-neutral-400">
                <span>Next Draw Cycle:</span>
                <span
                  className={`font-semibold text-sm ${
                    secondsRemaining <= 10 ? 'text-red-400 animate-pulse' : 'text-neutral-100'
                  }`}
                >
                  00:{String(secondsRemaining).padStart(2, '0')}
                </span>
              </div>
            </div>

            <div className="my-6 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
              <div>
                <div className="text-xs text-neutral-400 mb-1">Target Period Issue</div>
                <div className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-white tabular-nums">
                  {currentPrediction.period ? (
                    <>
                      <span className="text-neutral-500">
                        {currentPrediction.period.slice(0, -4)}
                      </span>
                      <span className="text-red-400">
                        {currentPrediction.period.slice(-4)}
                      </span>
                    </>
                  ) : (
                    'Syncing Period...'
                  )}
                </div>
              </div>

              <div className="flex items-baseline gap-5">
                <div>
                  <div className="text-xs text-neutral-400 mb-1">Predicted Outcome</div>
                  <div className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-yellow-400 tabular-nums">
                    {currentPrediction.prediction || 'WAIT'}
                  </div>
                </div>

                <div className="border-l border-red-950/70 pl-5">
                  <div className="text-xs text-neutral-400 mb-1">Ensemble Confidence</div>
                  <div className="font-mono text-2xl sm:text-3xl font-bold text-red-400 tabular-nums">
                    {currentPrediction.confidence ?? 85}%
                  </div>
                </div>
              </div>
            </div>

            {/* Active Reason & Recent 10 Balls Strip */}
            <div className="pt-4 border-t border-red-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-xs text-neutral-300 flex flex-wrap items-center gap-2">
                <span className="text-neutral-500">Active Engine Logic:</span>
                <span className="font-mono text-red-300 font-medium">
                  {currentPrediction.reason || 'initializing ensemble...'}
                </span>
                {latestTelemetry?.trend_lock_triggered && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-yellow-400 font-medium">
                      Priority Trend Lock Active
                    </span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onNavigateTab('engine')}
                  className="px-3 py-1.5 text-xs font-medium text-red-200 bg-red-950/50 hover:bg-red-900/60 border border-red-800/40 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                >
                  Inspect Math Breakdown
                </button>
              </div>
            </div>
          </div>

          {/* Right 5 Cols: Real-Time Accuracy & Session Telemetry */}
          <div className="lg:col-span-5 p-6 sm:p-8 flex flex-col justify-between bg-[#0E0709]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-400">
                Overall Session Accuracy
              </span>
              <span className="text-xs font-mono text-neutral-400 tabular-nums">
                Server: <strong className={serverActive ? 'text-emerald-400' : 'text-red-400'}>{serverActive ? 'ACTIVE' : 'RETRYING'}</strong>
              </span>
            </div>

            <div className="my-5 grid grid-cols-3 gap-4 border-y border-red-950/60 py-5">
              <div>
                <div className="text-xs text-neutral-400">Win Rate</div>
                <div className="mt-1 font-mono text-2xl sm:text-3xl font-bold text-white tabular-nums">
                  {winRate}%
                </div>
                <div className="mt-0.5 text-xs font-mono text-neutral-500 tabular-nums">
                  ×{stats.wins} multiplier
                </div>
              </div>

              <div>
                <div className="text-xs text-neutral-400">Win / Loss</div>
                <div className="mt-1 font-mono text-2xl sm:text-3xl font-bold tabular-nums">
                  <span className="text-emerald-400">{stats.wins}W</span>
                  <span className="text-neutral-600 mx-1">/</span>
                  <span className="text-red-400">{stats.losses}L</span>
                </div>
                <div className="mt-0.5 text-xs font-mono text-neutral-500 tabular-nums">
                  {stats.total} settled
                </div>
              </div>

              <div>
                <div className="text-xs text-neutral-400">Current Run</div>
                <div
                  className={`mt-1 font-mono text-2xl sm:text-3xl font-bold tabular-nums ${
                    currentRun.type === 'WIN'
                      ? 'text-emerald-400'
                      : currentRun.type === 'LOSE'
                      ? 'text-red-400'
                      : 'text-neutral-400'
                  }`}
                >
                  {currentRun.count > 0 ? `${currentRun.count} ${currentRun.type}` : '—'}
                </div>
                <div className="mt-0.5 text-xs font-mono text-neutral-500 tabular-nums">
                  History: {historyLog.length} rows
                </div>
              </div>
            </div>

            {/* Last 10 Actual Numbers Strip */}
            <div>
              <div className="flex items-center justify-between text-xs text-neutral-400 mb-2">
                <span>Last 10 Drawn Numbers (Oldest → Newest)</span>
                <span className="font-mono text-neutral-500 tabular-nums">
                  Window: {lastResultsInts.length}/50
                </span>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                {lastResultsInts.slice(-10).map((num, idx) => {
                  const isBig = num >= 5;
                  return (
                    <div
                      key={idx}
                      className={`h-7 flex-1 min-w-[28px] rounded flex items-center justify-center font-mono text-xs font-bold tabular-nums border ${
                        isBig
                          ? 'bg-emerald-950/40 border-emerald-700/40 text-emerald-300'
                          : 'bg-red-950/50 border-red-700/40 text-red-300'
                      }`}
                      title={`Number ${num} (${isBig ? 'BIG' : 'SMALL'})`}
                    >
                      {num}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: UNLIMITED SCROLLING HISTORY LEDGER */}
      <section className="rounded-xl border border-red-900/40 bg-[#120A0C] overflow-hidden">
        {/* Table Control Bar */}
        <div className="p-4 sm:p-6 border-b border-red-950/70 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold text-white tracking-tight">
              Unlimited Prediction & Outcome History
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Showing {filteredHistory.length} of {historyLog.length} recorded periods · Exact console columns preserved with full scroll retention
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1 sm:flex-initial sm:w-56">
              <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search period or logic..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#090607] border border-red-950/80 rounded-lg text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-red-600 transition-colors font-mono"
              />
            </div>

            {/* Segmented Outcome Filter */}
            <div className="flex items-center gap-1 p-1 bg-[#090607] border border-red-950/80 rounded-lg">
              {(['ALL', 'WIN', 'LOSE', 'BIG', 'SMALL'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    statusFilter === f
                      ? 'bg-red-600 text-white'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Order Toggle (Console Bottom vs Web Top) */}
            <button
              onClick={() => setNewestAtBottom((prev) => !prev)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#090607] hover:bg-red-950/40 text-neutral-300 border border-red-950/80 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              title="Toggle chronological direction"
            >
              {newestAtBottom ? (
                <>
                  <ArrowDownToLine className="w-3.5 h-3.5 text-red-400" />
                  <span>Newest at Bottom</span>
                </>
              ) : (
                <>
                  <ArrowUpToLine className="w-3.5 h-3.5 text-red-400" />
                  <span>Newest at Top</span>
                </>
              )}
            </button>

            {/* Expand Unlimited History (+25 Rounds) */}
            <button
              onClick={() => onBackfill(25)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-950/40 hover:bg-red-900/50 text-red-200 border border-red-800/40 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              title="Load 25 additional historical periods into the unlimited scroll table"
            >
              <PlusCircle className="w-3.5 h-3.5 text-red-400" />
              <span>+25 History Rows</span>
            </button>

            {/* Reset to Pure Live Stream */}
            <button
              onClick={onResetLive}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#090607] hover:bg-red-950/40 text-neutral-400 hover:text-neutral-200 border border-red-950/80 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              title="Reset table to only the current live API window"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Live Only</span>
            </button>
          </div>
        </div>

        {/* Unlimited Scroll Container */}
        <div
          ref={tableContainerRef}
          className="max-h-[560px] overflow-y-auto overflow-x-auto divide-y divide-red-950/40 scroll-smooth"
        >
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-[#0D0708] border-b border-red-900/50 text-xs font-mono text-neutral-400">
              <tr>
                <th className="py-3 px-4 font-semibold whitespace-nowrap">#</th>
                <th className="py-3 px-4 font-semibold whitespace-nowrap">PERIOD</th>
                <th className="py-3 px-4 font-semibold whitespace-nowrap">PRED</th>
                <th className="py-3 px-4 font-semibold whitespace-nowrap">ACTUAL</th>
                <th className="py-3 px-4 font-semibold whitespace-nowrap">RESULT (ENGINE LOGIC)</th>
                <th className="py-3 px-4 font-semibold whitespace-nowrap">WIN RATE</th>
                <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">SAVE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-950/30 font-mono text-xs sm:text-sm tabular-nums">
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-500">
                    No prediction records match your current filter.
                  </td>
                </tr>
              ) : (
                filteredHistory.map((entry, idx) => {
                  const isPending = entry.actual === '?' || entry.outcome === 'PENDING';
                  const isWin = entry.outcome === 'WIN';
                  const isBookmarked = bookmarkedPeriods.includes(entry.period);
                  const rowNumber = newestAtBottom
                    ? idx + 1
                    : filteredHistory.length - idx;

                  return (
                    <tr
                      key={`${entry.period}-${idx}`}
                      className={`transition-colors ${
                        isPending
                          ? 'bg-red-950/25 hover:bg-red-950/35'
                          : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      {/* Row Index */}
                      <td className="py-2.5 px-4 text-xs text-neutral-500 whitespace-nowrap">
                        {String(rowNumber).padStart(2, '0')}
                      </td>

                      {/* PERIOD */}
                      <td className="py-2.5 px-4 text-neutral-200 whitespace-nowrap">
                        <span className="text-neutral-500">
                          {entry.period.slice(0, -4)}
                        </span>
                        <span className="font-semibold text-white">
                          {entry.period.slice(-4)}
                        </span>
                      </td>

                      {/* PRED (Always Yellow as mandated by Python script: pred_display = f"{YELLOW}{pred:<8}{RESET}") */}
                      <td className="py-2.5 px-4 font-bold text-yellow-400 whitespace-nowrap">
                        {entry.pred}
                      </td>

                      {/* ACTUAL */}
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        {isPending ? (
                          <span className="text-neutral-400 inline-flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-red-400 animate-spin" />
                            <span>...waiting</span>
                          </span>
                        ) : (
                          <span
                            className={`font-bold ${
                              entry.actual === 'BIG' ? 'text-emerald-400' : 'text-red-400'
                            }`}
                          >
                            {entry.actual}
                            {entry.actualNumber && entry.actualNumber !== '?' ? (
                              <span className="ml-1.5 text-xs font-normal text-neutral-400">
                                ({entry.actualNumber})
                              </span>
                            ) : null}
                          </span>
                        )}
                      </td>

                      {/* RESULT / REASON */}
                      <td className="py-2.5 px-4 text-neutral-300 whitespace-nowrap">
                        <span>{entry.reason}</span>
                        <span className="ml-2 text-xs text-neutral-500">
                          · {entry.confidence ?? 85}%
                        </span>
                      </td>

                      {/* WIN RATE (Icon + Outcome + stats_str) */}
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        {isPending ? (
                          <span className="text-neutral-400">pending</span>
                        ) : (
                          <div className="inline-flex items-center gap-2">
                            {isWin ? (
                              <span className="inline-flex items-center gap-1 font-bold text-emerald-400">
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                <span>WIN</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 font-bold text-red-400">
                                <XCircle className="w-3.5 h-3.5 shrink-0" />
                                <span>LOSE</span>
                              </span>
                            )}
                            <span className="text-neutral-300 text-xs">
                              {entry.stats_str}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* BOOKMARK ACTION */}
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => onToggleBookmark(entry)}
                          className={`p-1.5 rounded hover:bg-red-950/50 transition-colors cursor-pointer ${
                            isBookmarked ? 'text-red-400' : 'text-neutral-600 hover:text-neutral-300'
                          }`}
                          title={isBookmarked ? 'Remove from My Saved Periods' : 'Bookmark period to My tab'}
                        >
                          {isBookmarked ? (
                            <BookmarkCheck className="w-4 h-4" />
                          ) : (
                            <Bookmark className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Exact Console-Style Footer Bar */}
        <div className="px-4 sm:px-6 py-3.5 bg-[#0D0708] border-t border-red-950/70 flex flex-wrap items-center justify-between gap-4 text-xs font-mono tabular-nums">
          <div className="flex flex-wrap items-center gap-3 text-neutral-300">
            <span className="text-cyan-400 font-semibold">
              Server: {serverActive ? 'ACTIVE' : 'STANDBY'}
            </span>
            <span className="text-neutral-600">|</span>
            <span>Total Predictions: {stats.total}</span>
            <span className="text-neutral-600">|</span>
            <span>Overall Accuracy: {winRate}%</span>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-neutral-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="accent-red-600 rounded cursor-pointer"
              />
              <span>Auto-scroll to latest</span>
            </label>

            <button
              onClick={scrollToLatest}
              className="px-2.5 py-1 text-xs text-red-300 hover:text-white bg-red-950/50 hover:bg-red-900/60 rounded transition-colors cursor-pointer"
            >
              Jump to Latest
            </button>

            <button
              onClick={onForceSync}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-neutral-300 hover:text-white bg-[#170C0E] border border-red-900/40 rounded transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-red-400' : ''}`} />
              <span>Sync Now</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
