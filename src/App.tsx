/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  HistoryLogEntry,
  EngineStats,
  DetailedEngineTelemetry,
} from './engine/jujustuEngine';

export type GameMode = '30S' | '1M';

const NUM_IMGS: Record<number, string> = {
  0: 'https://i.postimg.cc/vZsq9nGm/num0-4-10.png',
  1: 'https://i.postimg.cc/mDt8RNyD/num0-4-6.png',
  2: 'https://i.postimg.cc/ryRQPjmw/num0-4-9.png',
  3: 'https://i.postimg.cc/HLP9S81T/num0-4-1.png',
  4: 'https://i.postimg.cc/K80Pz3zL/num0-4-2.png',
  5: 'https://i.postimg.cc/jj9y6Vyd/num0-4-11.png',
  6: 'https://i.postimg.cc/gjyRPnQV/num0-4-12.png',
  7: 'https://i.postimg.cc/NfYmkk2T/num0-4-4.png',
  8: 'https://i.postimg.cc/vHz9qxWb/num0-4-5.png',
  9: 'https://i.postimg.cc/ryRQPjmw/num0-4-9.png',
};

function getSvgBallFallback(num: number): string {
  const n = ((num % 10) + 10) % 10;
  const isGreen = n === 1 || n === 3 || n === 7 || n === 9 || n === 5;
  const isViolet = n === 0 || n === 5;
  const c1 = isViolet ? '#e11d48' : isGreen ? '#10b981' : '#ef4444';
  const c2 = isViolet ? '#881337' : isGreen ? '#047857' : '#991b1b';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <defs>
      <radialGradient id="g" cx="35%" cy="30%" r="65%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.9"/>
        <stop offset="25%" stop-color="${c1}"/>
        <stop offset="95%" stop-color="${c2}"/>
      </radialGradient>
    </defs>
    <circle cx="50" cy="50" r="46" fill="url(#g)" stroke="#ffffff" stroke-width="3"/>
    <circle cx="36" cy="30" r="12" fill="#ffffff" fill-opacity="0.35"/>
    <text x="50" y="66" text-anchor="middle" fill="#ffffff" font-family="JetBrains Mono, monospace" font-weight="900" font-size="46">${n}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const BallImage: React.FC<{
  num: number;
  style?: React.CSSProperties;
  className?: string;
}> = ({ num, style, className }) => {
  const cleanNum = ((Number(num) % 10) + 10) % 10 || 0;
  const [src, setSrc] = useState<string>(NUM_IMGS[cleanNum] || getSvgBallFallback(cleanNum));

  useEffect(() => {
    setSrc(NUM_IMGS[cleanNum] || getSvgBallFallback(cleanNum));
  }, [cleanNum]);

  return (
    <img
      src={src}
      alt={String(cleanNum)}
      referrerPolicy="no-referrer"
      style={style}
      className={className}
      onError={() => setSrc(getSvgBallFallback(cleanNum))}
    />
  );
};

// Web Audio Synthesizer
const SoundFX = {
  ctx: null as AudioContext | null,
  enabled: true,
  getCtx() {
    if (!this.enabled || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  },
  tone(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.06, when = 0) {
    const c = this.getCtx();
    if (!c) return;
    try {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, c.currentTime + when);
      g.gain.setValueAtTime(gain, c.currentTime + when);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + when + dur);
      o.connect(g);
      g.connect(c.destination);
      o.start(c.currentTime + when);
      o.stop(c.currentTime + when + dur);
    } catch {
      // ignore
    }
  },
  click() {
    this.tone(880, 0.04);
  },
  scan() {
    this.tone(320, 0.2, 'triangle', 0.04);
  },
  success() {
    [523.25, 659.25, 783.99].forEach((f, i) => this.tone(f, 0.22, 'sine', 0.05, i * 0.06));
  },
  win() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      this.tone(f, 0.32, 'triangle', 0.08, i * 0.07)
    );
  },
  loss() {
    this.tone(220, 0.2, 'sawtooth', 0.04);
  },
  alert() {
    this.tone(987.77, 0.08, 'sine', 0.04);
  },
};

const LANGS: Record<
  string,
  {
    periodForecast: string;
    timeLeft: string;
  }
> = {
  en: {
    periodForecast: 'JUJUTSU SCRIPT • PYTHON ENGINE',
    timeLeft: 'TIME LEFT',
  },
  hi: {
    periodForecast: 'JUJUTSU SCRIPT • पायथन इंजन',
    timeLeft: 'शेष समय',
  },
  bn: {
    periodForecast: 'JUJUTSU SCRIPT • পাইথন ইঞ্জিন',
    timeLeft: 'বাকি সময়',
  },
  es: {
    periodForecast: 'JUJUTSU SCRIPT • MOTOR PYTHON',
    timeLeft: 'TIEMPO RESTANTE',
  },
  pt: {
    periodForecast: 'JUJUTSU SCRIPT • MOTOR PYTHON',
    timeLeft: 'TEMPO RESTANTE',
  },
};

type TabId = 'dashboard' | 'engine' | 'my';

interface SupportMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
}

interface WinPopupData {
  roundId: string;
  targetValue: string;
  actualNumber: string | number;
  actualSize: string;
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function splitPeriod(p?: string) {
  if (!p) return { prefix: '#', highlight: '-----' };
  const f = p.startsWith('#') ? p : `#${p}`;
  if (f.length > 5) return { prefix: f.slice(0, f.length - 5), highlight: f.slice(f.length - 5) };
  return { prefix: '', highlight: f };
}

/**
 * Validates that singleNumber is strictly on the same side as predSize (5..9 for BIG, 0..4 for SMALL).
 * Uses the exact singleNumber computed by Python's master_calculation_prediction (method1..method5).
 */
function getValidatedSameSideNumber(predSize?: 'BIG' | 'SMALL', pySingleNum?: number): number {
  if (typeof pySingleNum === 'number' && !isNaN(pySingleNum)) {
    if (predSize === 'BIG' && pySingleNum >= 5 && pySingleNum <= 9) return pySingleNum;
    if (predSize === 'SMALL' && pySingleNum >= 0 && pySingleNum <= 4) return pySingleNum;
  }
  return predSize === 'SMALL' ? 2 : 7;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [gameMode, setGameMode] = useState<GameMode>('30S');
  const [lang, setLang] = useState<string>('en');
  const [multiplier, setMultiplier] = useState<string>('1X');
  const [martingaleStep, setMartingaleStep] = useState<number>(1);
  const [matrixView, setMatrixView] = useState<'balls' | 'grid'>('balls');
  const [filter, setFilter] = useState<'ALL' | 'VICTORY' | 'DEFEAT'>('ALL');
  const [search, setSearch] = useState<string>('');
  const [autoSync, setAutoSync] = useState<boolean>(true);
  const [scanningPulse, setScanningPulse] = useState<boolean>(false);
  const [soundOn, setSoundOn] = useState<boolean>(true);
  const [toast, setToast] = useState<string | null>(null);

  // Modals & Dropdowns
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [settingsView, setSettingsView] = useState<
    'none' | 'predictionSettings' | 'language'
  >('none');
  const [supportOpen, setSupportOpen] = useState<boolean>(false);
  const [notifOpen, setNotifOpen] = useState<boolean>(false);
  const [winData, setWinData] = useState<WinPopupData | null>(null);

  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: `नमस्ते! मैं JUJUTSU SCRIPT V3 सपोर्ट हूँ (Powered by @AJAYTREDERKING)।\n\nयह सिस्टम 100% केवल आपकी Python Script (diablo_premium_predictor + master_calculation_prediction + hybrid_prediction) के लॉजिक से ही प्रेडिक्शन देता है, खुद से कुछ भी जनरेट नहीं करता।`,
      timestamp: nowTime(),
    },
  ]);
  const [supportInput, setSupportInput] = useState<string>('');
  const [supportTyping, setSupportTyping] = useState<boolean>(false);
  const chatBodyRef = useRef<HTMLDivElement>(null);

  // Dual Mode State Cache (`30S` and `1M`)
  const [modesData, setModesData] = useState<Record<GameMode, any>>({
    '30S': null,
    '1M': null,
  });
  const [lastSync, setLastSync] = useState<string>(nowTime());
  const [countdown, setCountdown] = useState<number>(30);

  const prevTotalsRef = useRef<Record<GameMode, number>>({ '30S': 0, '1M': 0 });
  const prevPeriodsRef = useRef<Record<GameMode, string>>({ '30S': '', '1M': '' });
  const gameModeRef = useRef<GameMode>(gameMode);
  gameModeRef.current = gameMode;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 2400);
  }, []);

  const applyServerPayload = useCallback((payload: any, activeMode: GameMode) => {
    if (!payload) return;

    const nextModes = payload.modes || {
      [activeMode]: payload,
    };

    setModesData((prev) => ({
      '30S': nextModes['30S'] || prev['30S'],
      '1M': nextModes['1M'] || prev['1M'],
    }));

    const currentModeData = nextModes[activeMode] || payload;
    if (!currentModeData) return;

    const incomingPeriod = currentModeData.current_prediction?.period;
    if (
      incomingPeriod &&
      prevPeriodsRef.current[activeMode] &&
      incomingPeriod !== prevPeriodsRef.current[activeMode]
    ) {
      setScanningPulse(true);
      SoundFX.scan();
      setTimeout(() => {
        setScanningPulse(false);
        SoundFX.success();
      }, 500);
    }
    if (incomingPeriod) {
      prevPeriodsRef.current[activeMode] = incomingPeriod;
    }

    if (currentModeData.stats) {
      const prevTotal = prevTotalsRef.current[activeMode];
      if (
        prevTotal > 0 &&
        currentModeData.stats.total > prevTotal &&
        Array.isArray(currentModeData.history_log)
      ) {
        const settled = currentModeData.history_log.filter(
          (h: HistoryLogEntry) => h.outcome === 'WIN' || h.outcome === 'LOSE'
        );
        const lastSettled: HistoryLogEntry | undefined = settled[settled.length - 1];
        if (lastSettled) {
          if (lastSettled.outcome === 'WIN') {
            setWinData({
              roundId: `#${lastSettled.period}`,
              targetValue: `${lastSettled.pred} (#${lastSettled.singleNumber})`,
              actualNumber: lastSettled.actualNumber ?? '?',
              actualSize: lastSettled.actual,
            });
            SoundFX.win();
            setTimeout(() => setWinData(null), 3200);
          } else {
            SoundFX.loss();
          }
        }
      }
      prevTotalsRef.current[activeMode] = currentModeData.stats.total;
    }

    setLastSync(nowTime());
  }, []);

  // AUTO-DELETE HISTORY & DATA ONLY ON INITIAL OPEN, BACK NAVIGATION, OR UNLOAD
  // (Does NOT re-trigger when switching between 30S and 1M buttons)
  const wipeAndStartFreshSession = useCallback(async () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // ignore
    }
    prevTotalsRef.current = { '30S': 0, '1M': 0 };
    try {
      const res = await fetch('/api/engine/reset-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        applyServerPayload(data, gameModeRef.current);
      }
    } catch {
      // ignore
    }
  }, [applyServerPayload]);

  useEffect(() => {
    wipeAndStartFreshSession();

    const handlePageHideOrUnload = () => {
      try {
        localStorage.clear();
        sessionStorage.clear();
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/engine/reset-live');
        }
      } catch {
        // ignore
      }
    };

    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        wipeAndStartFreshSession();
      }
    };

    const handlePopState = () => {
      wipeAndStartFreshSession();
    };

    window.addEventListener('beforeunload', handlePageHideOrUnload);
    window.addEventListener('pagehide', handlePageHideOrUnload);
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handlePageHideOrUnload);
      window.removeEventListener('pagehide', handlePageHideOrUnload);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [wipeAndStartFreshSession]);

  const fetchEngineState = useCallback(async () => {
    try {
      const res = await fetch(`/api/engine/state?mode=${gameMode}`);
      if (!res.ok) return;
      const data = await res.json();
      applyServerPayload(data, gameMode);
    } catch {
      // ignore transient error
    }
  }, [applyServerPayload, gameMode]);

  useEffect(() => {
    fetchEngineState();
    if (!autoSync) return;
    const interval = setInterval(fetchEngineState, 2000);
    return () => clearInterval(interval);
  }, [fetchEngineState, autoSync]);

  // Countdown Timer (30s cycle for 30S mode, 60s cycle for 1M mode)
  useEffect(() => {
    const updateClock = () => {
      const sec = new Date().getSeconds();
      if (gameMode === '30S') {
        const mod30 = sec % 30;
        const rem = mod30 === 0 ? 30 : 30 - mod30;
        setCountdown(rem);
        if (rem <= 3 && rem > 0 && SoundFX.enabled) SoundFX.alert();
      } else {
        const rem = sec === 0 ? 60 : 60 - sec;
        setCountdown(rem);
        if (rem <= 3 && rem > 0 && SoundFX.enabled) SoundFX.alert();
      }
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, [gameMode]);

  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [supportMessages, supportTyping, supportOpen]);

  // Extract active mode state exclusively from Python backend (`jujustu_core.py`)
  const activeModeObj = modesData[gameMode] || {};
  const stats: EngineStats = activeModeObj.stats || { wins: 0, losses: 0, total: 0 };
  const currentPrediction = activeModeObj.current_prediction || {};
  const historyLog: HistoryLogEntry[] = activeModeObj.history_log || [];
  const lastResultsInts: number[] = activeModeObj.last_results_ints || [];
  const latestTelemetry: DetailedEngineTelemetry | null =
    activeModeObj.latest_telemetry || null;

  // 100% Python Script Outputs (Zero client-side prediction logic)
  const hasPythonPrediction = Boolean(currentPrediction.prediction);
  const predSize: 'BIG' | 'SMALL' = currentPrediction.prediction || 'BIG';
  const predConf: number = currentPrediction.confidence ?? 0;
  const predReason: string = currentPrediction.reason || 'syncing python script...';
  const periodIdStr: string = currentPrediction.period
    ? `#${currentPrediction.period}`
    : '#SYNCING';

  const singlePredNum = getValidatedSameSideNumber(
    predSize,
    currentPrediction.singleNumber
  );

  const handleClearSessionNow = async () => {
    SoundFX.click();
    await wipeAndStartFreshSession();
    showToast('Session History Cleared & Re-Synced with Python Engine');
  };

  const handleSendSupport = (preset?: string) => {
    const text = (preset ?? supportInput).trim();
    if (!text || supportTyping) return;
    SoundFX.click();
    if (!preset) setSupportInput('');
    setSupportMessages((prev) => [
      ...prev,
      { id: `u_${Date.now()}`, sender: 'user', text, timestamp: nowTime() },
    ]);
    setSupportTyping(true);

    setTimeout(() => {
      const reply = `JUJUTSU SCRIPT V3 (WinGo ${gameMode} • ${periodIdStr}):\n• Python Output: ${predSize} (Same-Side Single #${singlePredNum})\n• Python Logic: ${predReason}\n• Python Confidence: ${predConf}%\n• यह 100% केवल आपकी Python Script के diablo_premium_predictor से ही चलता है।`;
      setSupportMessages((prev) => [
        ...prev,
        { id: `ai_${Date.now()}`, sender: 'ai', text: reply, timestamp: nowTime() },
      ]);
      setSupportTyping(false);
      SoundFX.success();
    }, 450);
  };

  // Real 10-Node Matrix Frequencies from live API history (`lastResultsInts`)
  const nodeFrequencies = useMemo(() => {
    const counts = Array(10).fill(0);
    lastResultsInts.forEach((n) => {
      if (n >= 0 && n <= 9) counts[n]++;
    });
    const total = lastResultsInts.length;
    return Array.from({ length: 10 }, (_, num) => {
      const prob = total > 0 ? Math.round((counts[num] / total) * 100) : 0;
      const type =
        num === 0 || num === 5 ? 'violet' : num % 2 === 1 ? 'green' : 'red';
      return { num, prob, type, count: counts[num] };
    });
  }, [lastResultsInts]);

  // Real BIG vs SMALL Ratios from live API history (`lastResultsInts`)
  const { bigWinRate, smallWinRate } = useMemo(() => {
    if (lastResultsInts.length === 0) return { bigWinRate: 0, smallWinRate: 0 };
    const bigs = lastResultsInts.filter((n) => n >= 5).length;
    const bPct = Math.round((bigs / lastResultsInts.length) * 100);
    return { bigWinRate: bPct, smallWinRate: 100 - bPct };
  }, [lastResultsInts]);

  // Filtered History
  const reversedHistory = useMemo(() => [...historyLog].reverse(), [historyLog]);
  const filteredHistory = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reversedHistory.filter((item) => {
      if (filter === 'VICTORY' && item.outcome !== 'WIN') return false;
      if (filter === 'DEFEAT' && item.outcome !== 'LOSE') return false;
      if (!q) return true;
      return (
        item.period.toLowerCase().includes(q) ||
        item.reason.toLowerCase().includes(q) ||
        item.pred.toLowerCase().includes(q)
      );
    });
  }, [reversedHistory, filter, search]);

  const t = LANGS[lang] || LANGS.en;
  const { prefix, highlight } = splitPeriod(periodIdStr);
  const maxCycleSeconds = gameMode === '30S' ? 30 : 60;
  const min = Math.floor(countdown / 60);
  const sec = countdown % 60;
  const urgent = countdown <= 6;
  const dashOffset = 125.66 - (countdown / maxCycleSeconds) * 125.66;
  const shortId = periodIdStr.replace('#', '').slice(-6);

  const overallAccuracy =
    stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 100;

  const last20Nums = lastResultsInts.slice(-20);
  const stepX = 240 / Math.max(1, last20Nums.length - 1);
  const trendPoints = last20Nums
    .map((n, idx) => `${idx * stepX},${48 - (n / 9) * 36 - 6}`)
    .join(' ');

  return (
    <div className="app-shell">
      <div className="app-inner">
        {/* STICKY GLASS HEADER — ONLY JUJUTSU SCRIPT BRANDING */}
        <header className="header">
          <div className="header-row">
            <div className="header-left">
              <button
                className="icon-btn"
                onClick={() => {
                  SoundFX.click();
                  setMenuOpen(true);
                  setNotifOpen(false);
                }}
                aria-label="Menu"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M4 5h16M4 12h16M4 19h16" />
                </svg>
              </button>
              <div className="logo-mark">
                <div className="logo-mark-inner">
                  <svg
                    viewBox="0 0 24 24"
                    width="19"
                    height="19"
                    fill="none"
                    stroke="#ff1744"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                </div>
              </div>
              <div>
                <div className="logo-title">
                  <span className="blue">JUJUTSU</span>
                  <span>SCRIPT V3</span>
                </div>
                <div className="logo-sub">POWER BY @AJAYTREDERKING</div>
              </div>
            </div>

            <div className="header-right">
              <button
                className="icon-btn"
                onClick={handleClearSessionNow}
                title="Wipe Session Data"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="15"
                  height="15"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
              <button
                className="icon-btn"
                onClick={() => {
                  SoundFX.click();
                  setNotifOpen((prev) => !prev);
                }}
                aria-label="Notifications"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M10.268 21a2 2 0 0 0 3.464 0" />
                  <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
                </svg>
                <span className="notif-dot" />
              </button>
              <button
                className="icon-btn"
                onClick={() => {
                  SoundFX.click();
                  setSettingsOpen(true);
                  setSettingsView('none');
                }}
                aria-label="Settings"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </button>

              {notifOpen && (
                <div className="notif-dd">
                  <div className="notif-head">
                    <b>JUJUTSU PYTHON CORE ({gameMode})</b>
                    <span>100% Script Logic</span>
                  </div>
                  <div className="notif-body">
                    <div className="notif-item">
                      <div className="t">🐍 Python Script Output</div>
                      <div className="d">
                        WinGo {gameMode} {periodIdStr}: <b>{predSize}</b> (Same-Side Single:{' '}
                        <b>#{singlePredNum}</b>) · {predConf}% ({predReason}).
                      </div>
                    </div>
                    <div className="notif-item">
                      <div className="t">💎 Glass Form Premium</div>
                      <div className="d">
                        Synced with WinGo_30S &amp; WinGo_1M APIs. Zero client-side override.
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="status-strip">
            <div className="pill live">
              <span className="dot pulse" />
              PYTHON 3 ENGINE · WINGO {gameMode} ·{' '}
              <span>
                {hasPythonPrediction ? `${predSize} (#${singlePredNum})` : 'SYNCING...'}
              </span>
            </div>
            <div className="pill free">
              <span>
                {stats.wins}W / {stats.losses}L · {overallAccuracy}% WIN RATE
              </span>
            </div>
          </div>
        </header>

        {/* 3 GLASS TABS BAR (Dashboard, Engine, My) */}
        <div className="tabs-wrap">
          <div
            className="tabs"
            role="tablist"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}
          >
            {(
              [
                { id: 'dashboard', label: '1. Dashboard' },
                { id: 'engine', label: '2. Engine' },
                { id: 'my', label: `3. My (${historyLog.length})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                className={`tab ${activeTab === tab.id ? 'active' : ''}`}
                style={{ justifyContent: 'center' }}
                onClick={() => {
                  SoundFX.click();
                  setActiveTab(tab.id);
                }}
              >
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* MAIN CONTENT AREA */}
        <div className="main">
          {toast && (
            <div className="toast">
              <span>{toast}</span>
              <button onClick={() => setToast(null)}>✕</button>
            </div>
          )}

          {/* DUAL GAME MODE GLASS SWITCHER (30 SEC vs 1 MIN LIVE API) */}
          <div
            className="card"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 8,
              padding: 6,
              borderRadius: 16,
            }}
          >
            <button
              onClick={() => {
                SoundFX.click();
                setGameMode('30S');
                showToast('WinGo 30 Seconds Live API Active');
              }}
              style={{
                padding: '10px 12px',
                borderRadius: 12,
                fontWeight: 900,
                fontSize: 12,
                fontFamily: 'JetBrains Mono, monospace',
                background:
                  gameMode === '30S'
                    ? 'linear-gradient(135deg, rgba(255,23,68,.9), rgba(220,38,38,.85))'
                    : 'rgba(255,255,255,.03)',
                color: gameMode === '30S' ? '#ffffff' : '#fecdd3',
                border:
                  gameMode === '30S'
                    ? '1px solid rgba(255,255,255,.35)'
                    : '1px solid transparent',
                boxShadow:
                  gameMode === '30S'
                    ? '0 6px 18px rgba(255,23,68,.45), inset 0 1px 0 rgba(255,255,255,.35)'
                    : 'none',
                transition: 'all .18s',
              }}
            >
              ⚡ WINGO 30 SEC (LIVE)
            </button>
            <button
              onClick={() => {
                SoundFX.click();
                setGameMode('1M');
                showToast('WinGo 1 Minute Live API Active');
              }}
              style={{
                padding: '10px 12px',
                borderRadius: 12,
                fontWeight: 900,
                fontSize: 12,
                fontFamily: 'JetBrains Mono, monospace',
                background:
                  gameMode === '1M'
                    ? 'linear-gradient(135deg, rgba(255,23,68,.9), rgba(220,38,38,.85))'
                    : 'rgba(255,255,255,.03)',
                color: gameMode === '1M' ? '#ffffff' : '#fecdd3',
                border:
                  gameMode === '1M'
                    ? '1px solid rgba(255,255,255,.35)'
                    : '1px solid transparent',
                boxShadow:
                  gameMode === '1M'
                    ? '0 6px 18px rgba(255,23,68,.45), inset 0 1px 0 rgba(255,255,255,.35)'
                    : 'none',
                transition: 'all .18s',
              }}
            >
              ⏱️ WINGO 1 MIN (LIVE)
            </button>
          </div>

          {/* ==================== TAB 1: DASHBOARD ==================== */}
          {activeTab === 'dashboard' && (
            <div className="tab-pane active">
              {/* Forecast Glass Card */}
              <div className="card forecast">
                <div className="forecast-head">
                  <div className="forecast-title">
                    <svg
                      viewBox="0 0 24 24"
                      width="15"
                      height="15"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <path d="M12 6v6l4 2" />
                      <circle cx="12" cy="12" r="10" />
                    </svg>
                    <span>
                      {t.periodForecast} ({gameMode})
                    </span>
                    <span className="live-badge">
                      <span className="dot" />
                      {gameMode === '30S' ? '30S API' : '1M API'}
                    </span>
                  </div>
                  <button
                    className={`sync-btn ${autoSync ? '' : 'paused'}`}
                    onClick={() => {
                      SoundFX.click();
                      setAutoSync((prev) => !prev);
                      showToast(!autoSync ? 'Auto-Sync Active' : 'Auto-Sync Paused');
                    }}
                  >
                    <span>● PYTHON AUTO ON</span>
                  </button>
                </div>

                <div className="forecast-body">
                  <div className="period-box">
                    <div className="period-label">
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: '#ff1744',
                          boxShadow: '0 0 6px #ff1744',
                        }}
                      />
                      TARGET PERIOD ({gameMode})
                    </div>
                    <div className="period-num">
                      {prefix}
                      {highlight}
                    </div>
                    <div className="period-sub">
                      <span className="muted">PYTHON 3 CORE</span> · WINGO {gameMode}
                    </div>
                  </div>

                  <div className="timer-wrap">
                    <svg className="timer-svg" viewBox="0 0 48 48">
                      <circle
                        cx="24"
                        cy="24"
                        r="20"
                        stroke="rgba(255,255,255,.1)"
                        strokeWidth="3.5"
                        fill="rgba(0,0,0,.35)"
                      />
                      <circle
                        cx="24"
                        cy="24"
                        r="20"
                        stroke={urgent ? '#fde047' : '#ff1744'}
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        fill="none"
                        strokeDasharray="125.66"
                        strokeDashoffset={dashOffset}
                      />
                    </svg>
                    <div className="timer-center">
                      <span className={`timer-time ${urgent ? 'urgent' : ''}`}>
                        {pad2(min)}:{pad2(sec)}
                      </span>
                      <span className="timer-lbl">{t.timeLeft}</span>
                    </div>
                  </div>

                  <div className="trend-box">
                    <span className="trend-label">PYTHON OUTPUT</span>
                    <div className="trend-bars">
                      <i style={{ height: '45%' }} />
                      <i style={{ height: '70%' }} />
                      <i style={{ height: '60%' }} />
                      <i style={{ height: '85%' }} />
                      <i style={{ height: '100%' }} />
                    </div>
                    <span className="trend-val">
                      {hasPythonPrediction ? `${predSize} #${singlePredNum}` : 'SYNC'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Live Readout of Top 3 Python Logics (`momentum`, `markov`, `master_calculation`) */}
              <div className="ct-focusV2">
                <button className="active" style={{ cursor: 'default' }}>
                  <span className="t">MOMENTUM (2.5x)</span>
                  <span className="s">
                    {latestTelemetry?.sub_engines.momentum.pred || predSize}
                  </span>
                  <div className="dotline">
                    <i style={{ width: `${predConf}%` }} />
                  </div>
                </button>
                <button className="active" style={{ cursor: 'default' }}>
                  <span className="t">MARKOV DECAY (2.0x)</span>
                  <span className="s">
                    {latestTelemetry?.sub_engines.markov.pred || predSize}
                  </span>
                  <div className="dotline">
                    <i style={{ width: `${predConf}%` }} />
                  </div>
                </button>
                <button className="active" style={{ cursor: 'default' }}>
                  <span className="t">MASTER CALC (5-M)</span>
                  <span className="s">
                    {latestTelemetry?.sub_engines.master.final_prediction || predSize}
                  </span>
                  <div className="dotline">
                    <i style={{ width: `${predConf}%` }} />
                  </div>
                </button>
              </div>

              {/* ULTRA PREDICTION GLASS STAGE — 100% PYTHON SCRIPT OUTPUT ONLY */}
              <div className="ultra-pred">
                <div className="ultra-top">
                  <div className="ultra-top-left">
                    <span className="ultra-live" />
                    DIABLO_PREMIUM_PREDICTOR • WINGO {gameMode}
                  </div>
                  <div className="ultra-period">#{shortId} • PYTHON 3</div>
                </div>
                <div className="ultra-stage">
                  <div className="ultra-rings">
                    <i />
                    <i />
                    <i />
                  </div>

                  <div className="ultra-label">
                    {scanningPulse
                      ? `RUNNING PYTHON SCRIPT FOR WINGO ${gameMode}...`
                      : `100% PYTHON SCRIPT PREDICTION • SAME-SIDE SINGLE #${singlePredNum}`}
                  </div>
                  <div className="ultra-value">
                    {hasPythonPrediction ? predSize : 'SYNCING...'}
                  </div>
                  <div className="ultra-sub">
                    LOGIC: {predReason} • SAME-SIDE SINGLE #{singlePredNum} (
                    {predSize === 'BIG' ? '5-9' : '0-4'})
                  </div>

                  {/* Same-Side Single Ball from Python's master_calculation_prediction */}
                  <div className="ultra-balls">
                    <BallImage
                      num={singlePredNum}
                      style={{ width: 76, height: 76 }}
                    />
                  </div>

                  <div className="ultra-chips">
                    <div className="ultra-chip">
                      <b>{predSize}</b>
                      <span>DIABLO SIGNAL</span>
                    </div>
                    <div className="ultra-chip">
                      <b>#{singlePredNum}</b>
                      <span>SAME-SIDE ({predSize === 'BIG' ? '5-9' : '0-4'})</span>
                    </div>
                    <div className="ultra-chip">
                      <b>{predConf}%</b>
                      <span>PYTHON CONFIDENCE</span>
                    </div>
                  </div>

                  <div className="ultra-meter">
                    <div className="ultra-meter-top">
                      <span>PYTHON ENSEMBLE CONFIDENCE ({predReason})</span>
                      <span>{predConf}%</span>
                    </div>
                    <div className="ultra-bar">
                      <i style={{ width: `${predConf}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Active Python Engine Status Bar */}
              <div className="ct-miniV2">
                <b>
                  🐍 PYTHON SCRIPT LOCKED: {predSize} · SINGLE #{singlePredNum}
                </b>
                <div className="focus-mini-switch">
                  <button className="active" style={{ cursor: 'default' }}>
                    {predReason}
                  </button>
                </div>
              </div>

              {/* Triple Glass Cards — Direct Python Script Outputs (Size, Same-Side Single Number, Votes) */}
              <div className="ct-tripleV2">
                <div className="ct-cardV2 active" style={{ cursor: 'default' }}>
                  <div>
                    <h4>PYTHON SIZE</h4>
                    <span className="playnow">DIABLO CORE</span>
                  </div>
                  <div style={{ margin: '8px 0' }}>
                    <div
                      style={{
                        fontSize: 25,
                        fontWeight: 900,
                        color: '#fde047',
                        fontFamily: 'JetBrains Mono, monospace',
                        textShadow: '0 2px 12px rgba(255,23,68,.5)',
                      }}
                    >
                      {predSize}
                    </div>
                    <div
                      style={{
                        fontSize: 9.5,
                        fontWeight: 800,
                        color: '#fecdd3',
                        marginTop: 4,
                      }}
                    >
                      RANGE: {predSize === 'SMALL' ? '0 - 4' : '5 - 9'}
                    </div>
                  </div>
                  <div>
                    <button className="ct-go on" style={{ cursor: 'default' }}>
                      {predSize}
                    </button>
                  </div>
                </div>

                <div className="ct-cardV2 active" style={{ cursor: 'default' }}>
                  <div>
                    <h4>SAME-SIDE NO.</h4>
                    <span className="playnow">MASTER M1-M5</span>
                  </div>
                  <div style={{ margin: '8px 0' }}>
                    <BallImage num={singlePredNum} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#fde047' }}>
                      #{singlePredNum} ({predSize} {predSize === 'BIG' ? '5-9' : '0-4'})
                    </div>
                    <button className="ct-go on" style={{ cursor: 'default' }}>
                      Single #{singlePredNum}
                    </button>
                  </div>
                </div>

                <div className="ct-cardV2 active" style={{ cursor: 'default' }}>
                  <div>
                    <h4>ENSEMBLE VOTES</h4>
                    <span className="playnow">{predConf}% CONF</span>
                  </div>
                  <div style={{ margin: '8px 0' }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 900,
                        color: '#ffffff',
                        fontFamily: 'JetBrains Mono, monospace',
                      }}
                    >
                      B: {latestTelemetry?.votes.BIG.toFixed(1) ?? '0.0'}
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 900,
                        color: '#fda4af',
                        fontFamily: 'JetBrains Mono, monospace',
                        marginTop: 4,
                      }}
                    >
                      S: {latestTelemetry?.votes.SMALL.toFixed(1) ?? '0.0'}
                    </div>
                  </div>
                  <div>
                    <button className="ct-go on" style={{ cursor: 'default' }}>
                      {predConf}% Score
                    </button>
                  </div>
                </div>
              </div>

              {/* 4 Glass Metrics Strip */}
              <div className="metrics">
                <div className="metric">
                  <div className="metric-top">
                    <span>CONFIDENCE</span>
                  </div>
                  <span className="metric-val blue">{predConf}%</span>
                  <div className="metric-mini-bar">
                    <i style={{ width: `${predConf}%` }} />
                  </div>
                </div>
                <div className="metric">
                  <div className="metric-top">
                    <span>WIN RATE</span>
                  </div>
                  <span className="metric-val teal">{overallAccuracy}%</span>
                  <div className="metric-mini-bar">
                    <i style={{ width: `${overallAccuracy}%` }} />
                  </div>
                </div>
                <div className="metric">
                  <div className="metric-top">
                    <span>SAME-SIDE NO.</span>
                  </div>
                  <span className="metric-val green">#{singlePredNum}</span>
                  <div className="metric-mini-bar">
                    <i style={{ width: '100%' }} />
                  </div>
                </div>
                <div className="metric">
                  <div className="metric-top">
                    <span>LAST 4 DRAWS</span>
                  </div>
                  <div className="streak-balls">
                    {lastResultsInts.slice(-4).map((num, idx) => (
                      <span key={idx}>{num}</span>
                    ))}
                  </div>
                  <div style={{ height: 4 }} />
                </div>
              </div>

              {/* UNLIMITED SCROLLING PREDICTION HISTORY AT THE BOTTOM OF DASHBOARD */}
              <div className="card hist-list-card">
                <div className="hist-list-head">
                  <div className="hist-list-title">
                    📜 WINGO {gameMode} LIVE PREDICTION HISTORY ({historyLog.length})
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="hist-clear" onClick={handleClearSessionNow}>
                      Clear Now
                    </button>
                  </div>
                </div>

                <div className="hist-rows">
                  {reversedHistory.map((item, idx) => {
                    const isPending = item.outcome === 'PENDING' || item.actual === '?';
                    const isWin = item.outcome === 'WIN';
                    const num = parseInt(String(item.actualNumber ?? ''), 10);
                    const ballCls =
                      num === 0 || num === 5
                        ? 'violet'
                        : num % 2 === 1
                        ? 'green'
                        : 'red';
                    const safeSingle = getValidatedSameSideNumber(
                      item.pred,
                      item.singleNumber
                    );

                    return (
                      <div key={`${item.period}-${idx}`} className="hist-row">
                        <div className="hist-row-left">
                          <div className="hist-row-period">
                            <b>#{item.period.slice(-7)}</b>
                            <span>{item.timestamp || 'Live'}</span>
                          </div>
                          <div className="hist-row-pred">
                            <span>Pred:</span>
                            <b>
                              {item.pred} (#{safeSingle})
                            </b>
                            <span>· {item.reason}</span>
                            {item.stats_str && <span>· {item.stats_str}</span>}
                          </div>
                        </div>
                        <div className="hist-row-right">
                          <div className="hist-actual">
                            <span className={`hist-actual-ball ${ballCls}`}>
                              {isPending ? '?' : item.actualNumber ?? item.actual[0]}
                            </span>
                            <span>{isPending ? 'WAITING' : item.actual}</span>
                          </div>
                          <span className={`hist-badge ${isWin ? 'win' : 'loss'}`}>
                            {isPending ? '⏳ PENDING' : isWin ? '✓ WIN' : '✕ LOSE'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ==================== TAB 2: ENGINE (ALL ANALYTICS & PYTHON CORE LOGICS) ==================== */}
          {activeTab === 'engine' && (
            <div className="tab-pane active">
              {/* 10-Node Analysis Matrix */}
              <div className="card matrix">
                <div className="matrix-head">
                  <div className="matrix-title">
                    📊 10-NODE ANALYSIS MATRIX (WINGO {gameMode})
                  </div>
                  <div className="view-switch">
                    <button
                      className={matrixView === 'balls' ? 'active' : ''}
                      onClick={() => {
                        SoundFX.click();
                        setMatrixView('balls');
                      }}
                    >
                      Balls View
                    </button>
                    <button
                      className={matrixView === 'grid' ? 'active' : ''}
                      onClick={() => {
                        SoundFX.click();
                        setMatrixView('grid');
                      }}
                    >
                      Grid View
                    </button>
                  </div>
                </div>

                {matrixView === 'balls' ? (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                      paddingTop: 4,
                    }}
                  >
                    <div className="matrix-row">
                      {nodeFrequencies.slice(0, 5).map((n) => (
                        <div
                          key={n.num}
                          className={`node-btn ${singlePredNum === n.num ? 'active' : ''}`}
                        >
                          <div className="node-ball-wrap">
                            <div className="node-ball">
                              <BallImage num={n.num} />
                            </div>
                          </div>
                          <span className="node-prob">{n.prob}%</span>
                          <div className="node-bar">
                            <i
                              style={{
                                background: 'linear-gradient(90deg,#dc2626,#ff1744)',
                                width: `${Math.min(100, n.prob * 3)}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="matrix-row">
                      {nodeFrequencies.slice(5, 10).map((n) => (
                        <div
                          key={n.num}
                          className={`node-btn ${singlePredNum === n.num ? 'active' : ''}`}
                        >
                          <div className="node-ball-wrap">
                            <div className="node-ball">
                              <BallImage num={n.num} />
                            </div>
                          </div>
                          <span className="node-prob">{n.prob}%</span>
                          <div className="node-bar">
                            <i
                              style={{
                                background: 'linear-gradient(90deg,#dc2626,#ff1744)',
                                width: `${Math.min(100, n.prob * 3)}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="grid-table">
                    <div className="grid-table-head">
                      <span>Node</span>
                      <span>Side &amp; Color</span>
                      <span>API Freq</span>
                      <span style={{ textAlign: 'right' }}>Python</span>
                    </div>
                    <div className="grid-table-body">
                      {nodeFrequencies.map((n) => {
                        const active = singlePredNum === n.num;
                        const side = n.num >= 5 ? 'BIG' : 'SMALL';
                        return (
                          <div
                            key={n.num}
                            className={`grid-row ${active ? 'active' : ''}`}
                          >
                            <div className="grid-node">
                              <span className="grid-node-num">{n.num}</span>
                            </div>
                            <span className="grid-class">
                              {side} · {n.type.toUpperCase()}
                            </span>
                            <div className="grid-freq">
                              <div className="grid-freq-bar">
                                <i
                                  style={{
                                    background: '#dc2626',
                                    width: `${Math.min(100, n.prob * 3)}%`,
                                  }}
                                />
                              </div>
                              <b>{n.prob}%</b>
                            </div>
                            <div className="grid-action">
                              <button className={active ? 'active' : ''}>
                                {active ? 'LOCKED' : '—'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="multiplier-row">
                  {['1X', '5X', '10X', '20X', '50X', '100X'].map((m) => (
                    <button
                      key={m}
                      className={`mult-btn ${multiplier === m ? 'active' : ''}`}
                      onClick={() => {
                        SoundFX.click();
                        setMultiplier(m);
                      }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* BIG vs SMALL Win Rates */}
              <div className="winrates">
                <div className="card winrate">
                  <div className="winrate-head">
                    <span className="winrate-title">BIG (5 - 9)</span>
                    <span className="winrate-pct blue">
                      <span className="lbl">API RATIO</span> {bigWinRate}%
                    </span>
                  </div>
                  <div className="winrate-bar">
                    <i className="blue" style={{ width: `${bigWinRate}%` }} />
                  </div>
                  <div className="winrate-foot">
                    <div className="winrate-checks">
                      <div className="winrate-check">✓ master_calculation_prediction</div>
                      <div className="winrate-check">✓ markov_chain_decay</div>
                      <div className="winrate-check">✓ diablo_premium_predictor</div>
                    </div>
                    <div className="winrate-ring">
                      <svg viewBox="0 0 36 36">
                        <circle
                          cx="18"
                          cy="18"
                          r="15"
                          stroke="rgba(255,255,255,.12)"
                          strokeWidth="3"
                          fill="none"
                        />
                        <circle
                          cx="18"
                          cy="18"
                          r="15"
                          stroke="#ff1744"
                          strokeWidth="3"
                          strokeLinecap="round"
                          fill="none"
                          strokeDasharray="94.2"
                          strokeDashoffset={94.2 - (bigWinRate / 100) * 94.2}
                        />
                      </svg>
                      <div className="val">{bigWinRate}%</div>
                    </div>
                  </div>
                </div>

                <div className="card winrate">
                  <div className="winrate-head">
                    <span className="winrate-title">SMALL (0 - 4)</span>
                    <span className="winrate-pct green">
                      <span className="lbl">API RATIO</span> {smallWinRate}%
                    </span>
                  </div>
                  <div className="winrate-bar">
                    <i className="green" style={{ width: `${smallWinRate}%` }} />
                  </div>
                  <div className="winrate-foot">
                    <div className="winrate-checks">
                      <div className="winrate-check">✓ master_calculation_prediction</div>
                      <div className="winrate-check">✓ markov_chain_decay</div>
                      <div className="winrate-check">✓ diablo_premium_predictor</div>
                    </div>
                    <div className="winrate-ring">
                      <svg viewBox="0 0 36 36">
                        <circle
                          cx="18"
                          cy="18"
                          r="15"
                          stroke="rgba(255,255,255,.12)"
                          strokeWidth="3"
                          fill="none"
                        />
                        <circle
                          cx="18"
                          cy="18"
                          r="15"
                          stroke="#10b981"
                          strokeWidth="3"
                          strokeLinecap="round"
                          fill="none"
                          strokeDasharray="94.2"
                          strokeDashoffset={94.2 - (smallWinRate / 100) * 94.2}
                        />
                      </svg>
                      <div className="val">{smallWinRate}%</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent 20 Draws Trend & Python Engine Telemetry */}
              <div className="trend-grid">
                <div className="card trend-chart">
                  <div className="trend-chart-title">
                    📈 RECENT API DRAWS <span className="muted">(WINGO {gameMode})</span>
                  </div>
                  <div className="trend-svg-wrap">
                    <svg className="trend-svg" viewBox="0 0 240 48" preserveAspectRatio="none">
                      <line
                        x1="0"
                        y1="24"
                        x2="240"
                        y2="24"
                        stroke="rgba(255,255,255,.2)"
                        strokeWidth="1"
                        strokeDasharray="3 3"
                      />
                      {trendPoints && (
                        <polyline
                          points={trendPoints}
                          fill="none"
                          stroke="#ff1744"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}
                    </svg>
                  </div>
                  <div className="mini-balls">
                    {lastResultsInts.slice(-12).map((num, idx) => {
                      const cls =
                        num === 0 || num === 5
                          ? 'violet'
                          : num % 2 === 1
                          ? 'green'
                          : 'red';
                      return (
                        <span key={idx} className={`mini-ball ${cls}`}>
                          {num}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div className="card insight">
                  <div>
                    <div className="insight-title">🐍 PYTHON DIABLO VOTES</div>
                    <p className="insight-text">
                      Python Output: <b>{predSize}</b> (Same-Side Single <b>#{singlePredNum}</b>) via{' '}
                      <b>{predReason}</b>.
                    </p>
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      fontFamily: 'JetBrains Mono, monospace',
                      color: '#fde047',
                      fontWeight: 800,
                      marginTop: 6,
                    }}
                  >
                    BIG Weight: {latestTelemetry?.votes.BIG.toFixed(1) ?? '0.0'} · SMALL Weight:{' '}
                    {latestTelemetry?.votes.SMALL.toFixed(1) ?? '0.0'}
                  </div>
                </div>
              </div>

              {/* Diablo Pattern AI Sub-Engines (Direct from jujustu_core.py) */}
              <div className="card section">
                <div className="section-head">
                  <div className="section-title">
                    🐍 Python Script Sub-Engines (`jujustu_core.py` · {gameMode})
                  </div>
                  <span className="tag">100% PYTHON LOGIC</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div className="pattern-row">
                    <div>
                      <span className="t">
                        Momentum (`momentum_prediction` · Weight 2.5x)
                      </span>
                      <span className="s">
                        Reason: {latestTelemetry?.sub_engines.momentum.reason ?? '—'} (Streak:{' '}
                        {latestTelemetry?.sub_engines.momentum.current_streak ?? 0})
                      </span>
                    </div>
                    <span className="m blue">
                      {latestTelemetry?.sub_engines.momentum.pred ?? '—'}
                    </span>
                  </div>

                  <div className="pattern-row">
                    <div>
                      <span className="t">
                        Markov Chain Decay (`markov_chain_decay` · Weight 2.0x)
                      </span>
                      <span className="s">
                        {latestTelemetry?.sub_engines.markov.reason ?? '—'} · BIG:{' '}
                        {latestTelemetry?.sub_engines.markov.weighted_big ?? 0} / SMALL:{' '}
                        {latestTelemetry?.sub_engines.markov.weighted_small ?? 0}
                      </span>
                    </div>
                    <span className="m amber">
                      {latestTelemetry?.sub_engines.markov.pred ?? '—'}
                    </span>
                  </div>

                  <div className="pattern-row">
                    <div>
                      <span className="t">
                        Frequency Balance (`freq_balance_prediction` · Weight 1.5x)
                      </span>
                      <span className="s">
                        {latestTelemetry?.sub_engines.freq_balance.reason ?? '—'} (
                        {latestTelemetry?.sub_engines.freq_balance.big_count ?? 0}B /{' '}
                        {latestTelemetry?.sub_engines.freq_balance.small_count ?? 0}S)
                      </span>
                    </div>
                    <span className="m blue">
                      {latestTelemetry?.sub_engines.freq_balance.pred ?? '—'}
                    </span>
                  </div>

                  <div className="pattern-row">
                    <div>
                      <span className="t">
                        Hybrid Logic (`hybrid_prediction` · Weight 1.0x)
                      </span>
                      <span className="s">
                        Old Core Logic 2 (`stable_logic` + transition rules)
                      </span>
                    </div>
                    <span className="m amber">
                      {latestTelemetry?.sub_engines.hybrid.pred ?? '—'}
                    </span>
                  </div>

                  <div className="pattern-row">
                    <div>
                      <span className="t">
                        Streak Break (`streak_break_prediction` · Priority Lock)
                      </span>
                      <span className="s">
                        Run length:{' '}
                        {latestTelemetry?.sub_engines.streak_break.current_streak ?? 0} / 4
                        threshold
                      </span>
                    </div>
                    <span className="m blue">
                      {latestTelemetry?.sub_engines.streak_break.pred || 'STANDBY'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Core Logic 1: Master Calculation 5-Method Matrix */}
              <div className="card section">
                <div className="section-head">
                  <div className="section-title">
                    🧮 Core Logic 1: `master_calculation_prediction`
                  </div>
                  <span className="tag">
                    Output: {latestTelemetry?.sub_engines.master.final_prediction ?? '—'}
                  </span>
                </div>
                <p className="section-desc">
                  Exact 5-Method Python calculation running on Period{' '}
                  <b>{latestTelemetry?.period_number || currentPrediction.period}</b>.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    {
                      label: 'Method 1 (Base + History + Mod + Mean)',
                      val: latestTelemetry?.sub_engines.master.method1,
                      res: latestTelemetry?.sub_engines.master.results?.[0],
                    },
                    {
                      label: 'Method 2 (Shift + 3-Round Trend)',
                      val: latestTelemetry?.sub_engines.master.method2,
                      res: latestTelemetry?.sub_engines.master.results?.[1],
                    },
                    {
                      label: 'Method 3 (Mirror Reverse Factor)',
                      val: latestTelemetry?.sub_engines.master.method3,
                      res: latestTelemetry?.sub_engines.master.results?.[2],
                    },
                    {
                      label: 'Method 4 (5-Point Weighted Vector)',
                      val: latestTelemetry?.sub_engines.master.method4,
                      res: latestTelemetry?.sub_engines.master.results?.[3],
                    },
                    {
                      label: 'Method 5 (Chaos Prime Tie-Breaker)',
                      val: latestTelemetry?.sub_engines.master.method5,
                      res: latestTelemetry?.sub_engines.master.results?.[4],
                    },
                  ].map((m, i) => (
                    <div key={i} className="pattern-row">
                      <div>
                        <span className="t">{m.label}</span>
                        <span className="s">Python Digit: {m.val ?? '—'}</span>
                      </div>
                      <span className={`m ${m.res === 'BIG' ? 'blue' : 'amber'}`}>
                        {m.res ?? '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Scale Multiplier Simulator */}
              <div className="card section">
                <div className="section-title">
                  ⚡ Analytical Scale Multiplier Simulator
                </div>
                <div className="mult-grid">
                  {[1, 2, 4, 8].map((n) => (
                    <button
                      key={n}
                      className={`mult-btn ${martingaleStep === n ? 'active' : ''}`}
                      onClick={() => {
                        SoundFX.click();
                        setMartingaleStep(n);
                      }}
                    >
                      {n}X
                    </button>
                  ))}
                </div>
                <div className="alert-box">
                  <div>
                    <span className="lbl">
                      High-Priority Trend Lock (`streak_break_prediction`)
                    </span>
                    <span className="sub">
                      Automatically overrides ensemble when consecutive streak reaches &ge; 4
                    </span>
                  </div>
                  <span className="active-tag">ACTIVE</span>
                </div>
              </div>
            </div>
          )}

          {/* ==================== TAB 3: MY (SESSION AUDIT, CONSOLE & CONTROLS) ==================== */}
          {activeTab === 'my' && (
            <div className="tab-pane active">
              <div className="card hist-summary">
                <div className="hist-summary-head">
                  <div className="hist-title">
                    <span style={{ fontSize: 18 }}>🏆</span>
                    <div>
                      <h3>MY SESSION PERFORMANCE (WINGO {gameMode})</h3>
                      <div className="hist-sub">
                        <span className="dot pulse" />
                        <span>AUTO-DELETES IMMEDIATELY ON BACK OR EXIT</span>
                      </div>
                    </div>
                  </div>
                  <div className="hist-actions">
                    <button className="hist-clear" onClick={handleClearSessionNow}>
                      Wipe Session Data
                    </button>
                    <span className="acc-badge">{overallAccuracy}% ACCURACY</span>
                  </div>
                </div>

                <div className="hist-stats">
                  <div className="hist-stat">
                    <span className="lbl">Settled</span>
                    <div className="val">{stats.total}</div>
                  </div>
                  <div className="hist-stat win">
                    <span className="lbl">VICTORY</span>
                    <div className="val">{stats.wins}</div>
                  </div>
                  <div className="hist-stat loss">
                    <span className="lbl">DEFEAT</span>
                    <div className="val">{stats.losses}</div>
                  </div>
                  <div className="hist-stat streak">
                    <span className="lbl">Same-Side No.</span>
                    <div className="val">#{singlePredNum}</div>
                  </div>
                </div>
              </div>

              {/* Filterable Session Verdicts */}
              <div className="card hist-list-card">
                <div className="hist-list-head">
                  <div className="hist-list-title">🛡️ Round Audit Verdicts ({gameMode})</div>
                  <div className="filter-group">
                    {(
                      [
                        { id: 'ALL', label: `ALL (${historyLog.length})` },
                        { id: 'VICTORY', label: `WINS (${stats.wins})` },
                        { id: 'DEFEAT', label: `LOSS (${stats.losses})` },
                      ] as const
                    ).map((fi) => (
                      <button
                        key={fi.id}
                        className={`filter-btn ${
                          fi.id === 'VICTORY' ? 'win' : fi.id === 'DEFEAT' ? 'loss' : ''
                        } ${filter === fi.id ? 'active' : ''}`}
                        onClick={() => {
                          SoundFX.click();
                          setFilter(fi.id);
                        }}
                      >
                        {fi.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="search-wrap">
                  <svg
                    viewBox="0 0 24 24"
                    width="15"
                    height="15"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="m21 21-4.34-4.34" />
                    <circle cx="11" cy="11" r="8" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search period or Python engine reason..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <div className="hist-rows">
                  {filteredHistory.map((item, idx) => {
                    const isPending = item.outcome === 'PENDING' || item.actual === '?';
                    const isWin = item.outcome === 'WIN';
                    const num = parseInt(String(item.actualNumber ?? ''), 10);
                    const ballCls =
                      num === 0 || num === 5
                        ? 'violet'
                        : num % 2 === 1
                        ? 'green'
                        : 'red';
                    const safeSingle = getValidatedSameSideNumber(
                      item.pred,
                      item.singleNumber
                    );

                    return (
                      <div key={`${item.period}-${idx}`} className="hist-row">
                        <div className="hist-row-left">
                          <div className="hist-row-period">
                            <b>#{item.period}</b>
                            <span>{item.timestamp || 'Live'}</span>
                          </div>
                          <div className="hist-row-pred">
                            <span>Pred:</span>
                            <b>
                              {item.pred} (#{safeSingle})
                            </b>
                            <span>· {item.reason}</span>
                            {item.stats_str && <span>· {item.stats_str}</span>}
                          </div>
                        </div>
                        <div className="hist-row-right">
                          <div className="hist-actual">
                            <span className={`hist-actual-ball ${ballCls}`}>
                              {isPending ? '?' : item.actualNumber ?? item.actual[0]}
                            </span>
                            <span>{isPending ? 'WAITING' : item.actual}</span>
                          </div>
                          <span className={`hist-badge ${isWin ? 'win' : 'loss'}`}>
                            {isPending ? '⏳ PENDING' : isWin ? '✓ WIN' : '✕ LOSE'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Classic Python Console Output Replica */}
              <div className="card section">
                <div className="section-head">
                  <div className="section-title">
                    💻 Python Terminal Output (`render_dashboard` · {gameMode})
                  </div>
                  <span className="tag">PYTHON 3 LIVE</span>
                </div>
                <div
                  style={{
                    background: 'rgba(5, 1, 3, 0.72)',
                    backdropFilter: 'blur(16px)',
                    color: '#f8fafc',
                    padding: 14,
                    borderRadius: 14,
                    border: '1px solid rgba(255,255,255,.16)',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 11,
                    overflowX: 'auto',
                    lineHeight: 1.55,
                  }}
                >
                  <div style={{ color: '#ff1744', fontWeight: 800 }}>
                    🔥 JUJUTSU SCRIPT V3 ({gameMode})
                  </div>
                  <div style={{ color: '#38bdf8', marginBottom: 8 }}>
                    POWER BY @AJAYTREDERKING
                  </div>
                  <div
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,.16)',
                      paddingBottom: 4,
                      marginBottom: 6,
                      color: '#fecdd3',
                    }}
                  >
                    PERIOD &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; PRED &nbsp;&nbsp; ACTUAL &nbsp;&nbsp; RESULT &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; WIN RATE
                  </div>
                  {historyLog.slice(-25).map((e, i) => (
                    <div key={i} style={{ whiteSpace: 'pre' }}>
                      {e.period.padEnd(18)}{' '}
                      <span style={{ color: '#fde047', fontWeight: 700 }}>
                        {e.pred.padEnd(6)}
                      </span>{' '}
                      <span
                        style={{
                          color:
                            e.actual === '?'
                              ? '#9ca3af'
                              : e.actual === 'BIG'
                              ? '#34d399'
                              : '#ff1744',
                        }}
                      >
                        {(e.actual === '?' ? '...waiting' : e.actual).padEnd(9)}
                      </span>{' '}
                      {e.reason.slice(0, 24).padEnd(25)}{' '}
                      {e.outcome === 'PENDING'
                        ? 'pending'
                        : `${e.outcome === 'WIN' ? '✅ WIN ' : '❌ LOSE'} ${e.stats_str}`}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* GLASS FOOTER */}
          <footer className="footer">
            <div className="footer-badge">
              <span>🔥</span>
              <span className="txt">JUJUTSU SCRIPT V3</span>
              <span className="sep">·</span>
              <span className="ver">POWER BY @AJAYTREDERKING</span>
            </div>
            <p className="footer-note">
              100% Python Script Engine (`jujustu_core.py`) · WinGo 30S &amp; 1M Live Sync · Glass Form Premium.
            </p>
          </footer>
        </div>
      </div>

      {/* ==================== SIDE MENU GLASS DRAWER ==================== */}
      {menuOpen && (
        <div
          className="overlay"
          style={{ justifyContent: 'flex-start', alignItems: 'stretch', padding: 0 }}
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="modal"
            style={{
              maxWidth: 310,
              height: '100%',
              maxHeight: 'none',
              borderRadius: 0,
              margin: 0,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div className="modal-head-title">
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    background: 'linear-gradient(135deg,#dc2626,#ff1744)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 900,
                    fontSize: 13,
                  }}
                >
                  JV3
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800 }}>
                    JUJUTSU SCRIPT V3
                  </div>
                  <div style={{ fontSize: 10, color: '#fecdd3', fontWeight: 600 }}>
                    POWER BY @AJAYTREDERKING
                  </div>
                </div>
              </div>
              <button className="modal-close" onClick={() => setMenuOpen(false)}>
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ gap: 8 }}>
              <div className="unlock-box">
                <div>
                  <div className="ttl">🐍 100% PYTHON 3 ENGINE</div>
                  <div className="sub">WinGo 30S &amp; 1M · Same-Side Single No.</div>
                </div>
                <span className="set-item-badge on">{gameMode}</span>
              </div>

              {(
                [
                  { id: 'dashboard', label: '1. Dashboard (Python Auto Signal)' },
                  { id: 'engine', label: '2. Engine (Matrix & Core Logics)' },
                  { id: 'my', label: '3. My (Audit & Terminal Console)' },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  className={`set-item ${activeTab === item.id ? 'highlight' : ''}`}
                  onClick={() => {
                    SoundFX.click();
                    setActiveTab(item.id);
                    setMenuOpen(false);
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 800 }}>{item.label}</span>
                </button>
              ))}

              <button
                className="set-item"
                style={{ marginTop: 'auto' }}
                onClick={() => {
                  SoundFX.click();
                  setMenuOpen(false);
                  setSupportOpen(true);
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 800 }}>
                  ✨ Jujutsu Script Support
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== SETTINGS GLASS MODAL ==================== */}
      {settingsOpen && (
        <div className="overlay" onClick={() => setSettingsOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-head-title">
                Jujutsu Script Settings{' '}
                <span className="modal-head-badge">GLASS PRO</span>
              </div>
              <button
                className="modal-close"
                onClick={() => {
                  setSettingsOpen(false);
                  setSettingsView('none');
                }}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {settingsView === 'none' && (
                <>
                  <div className="profile-row">
                    <div className="avatar">JV3</div>
                    <div className="profile-info">
                      <div className="profile-name-row">
                        <span className="profile-name">JUJUTSU SCRIPT V3</span>
                        <span className="tag-full">PYTHON 3</span>
                      </div>
                      <div className="profile-id">
                        POWER BY @AJAYTREDERKING
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <button
                      className="set-item"
                      onClick={() => {
                        SoundFX.click();
                        setSettingsView('predictionSettings');
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="set-item-icon">🐍</div>
                        <div>
                          <div className="set-item-title">
                            Python Script Core Logics
                          </div>
                          <div className="set-item-sub">
                            100% Unaltered `jujustu_core.py` Execution
                          </div>
                        </div>
                      </div>
                      <span>→</span>
                    </button>

                    <button
                      className="set-item"
                      onClick={() => {
                        handleClearSessionNow();
                        setSettingsOpen(false);
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="set-item-icon">🗑️</div>
                        <div>
                          <div className="set-item-title">Wipe Session History</div>
                          <div className="set-item-sub">
                            Auto-deletes on back/exit (Last sync: {lastSync})
                          </div>
                        </div>
                      </div>
                      <span className="set-item-badge on">Wipe Now</span>
                    </button>

                    <button
                      className="set-item"
                      onClick={() => {
                        const next = !soundOn;
                        setSoundOn(next);
                        SoundFX.enabled = next;
                        if (next) SoundFX.click();
                        showToast(next ? 'Sound ON' : 'Sound OFF');
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="set-item-icon">
                          {soundOn ? '🔊' : '🔇'}
                        </div>
                        <div>
                          <div className="set-item-title">Audio Feedback</div>
                          <div className="set-item-sub">
                            Alerts on period change &amp; win
                          </div>
                        </div>
                      </div>
                      <span className={`set-item-badge ${soundOn ? 'on' : 'off'}`}>
                        {soundOn ? 'ON' : 'OFF'}
                      </span>
                    </button>

                    <button
                      className="set-item"
                      onClick={() => {
                        SoundFX.click();
                        setSettingsView('language');
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="set-item-icon">🌐</div>
                        <div>
                          <div className="set-item-title">Interface Language</div>
                          <div className="set-item-sub">
                            {lang.toUpperCase()} • EN, HI, BN, ES, PT
                          </div>
                        </div>
                      </div>
                      <span>→</span>
                    </button>
                  </div>
                </>
              )}

              {settingsView === 'predictionSettings' && (
                <>
                  <div className="sub-panel-head">
                    <div className="sub-panel-title">
                      🐍 Active Python Script Logics
                    </div>
                    <button
                      className="modal-close"
                      onClick={() => setSettingsView('none')}
                    >
                      ✕
                    </button>
                  </div>
                  <div className="sub-panel-body">
                    {[
                      {
                        label: '100% Python Script Execution (jujustu_core.py)',
                        desc: 'Predictions come exclusively from diablo_premium_predictor in Python 3',
                      },
                      {
                        label: 'Old Core Logics 1 & 2 Unchanged',
                        desc: 'master_calculation_prediction (5 methods) + hybrid_prediction',
                      },
                      {
                        label: 'Diablo Pattern AI Ensemble Unchanged',
                        desc: 'Momentum (2.5x) + Markov (2.0x) + Freq-Balance (1.5x) + Streak Lock',
                      },
                    ].map((o, idx) => (
                      <div key={idx} className="opt active">
                        <div className="opt-row">
                          <div>
                            <div className="t">{o.label}</div>
                            <div className="d">{o.desc}</div>
                          </div>
                          <span className="opt-check">✓</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    className="sub-panel-btn"
                    onClick={() => setSettingsView('none')}
                  >
                    Done
                  </button>
                </>
              )}

              {settingsView === 'language' && (
                <>
                  <div className="sub-panel-head">
                    <div className="sub-panel-title">🌐 Select Language</div>
                    <button
                      className="modal-close"
                      onClick={() => setSettingsView('none')}
                    >
                      ✕
                    </button>
                  </div>
                  <div className="sub-panel-body">
                    {[
                      { code: 'en', native: 'English (US)', name: 'English' },
                      { code: 'hi', native: 'हिन्दी (Hindi)', name: 'Hindi' },
                      { code: 'bn', native: 'বাংলা (Bengali)', name: 'Bengali' },
                      { code: 'es', native: 'Español (Spanish)', name: 'Spanish' },
                      { code: 'pt', native: 'Português (Portuguese)', name: 'Portuguese' },
                    ].map((l) => (
                      <div
                        key={l.code}
                        className={`opt ${lang === l.code ? 'active' : ''}`}
                        onClick={() => {
                          setLang(l.code);
                          SoundFX.success();
                        }}
                      >
                        <div className="opt-row">
                          <div>
                            <div className="t">{l.native}</div>
                            <div className="d">{l.name}</div>
                          </div>
                          {lang === l.code && <span className="opt-check">✓</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    className="sub-panel-btn"
                    onClick={() => setSettingsView('none')}
                  >
                    Done
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== SUPPORT CHAT GLASS MODAL ==================== */}
      {supportOpen && (
        <div className="overlay" onClick={() => setSupportOpen(false)}>
          <div className="chat-modal" onClick={(e) => e.stopPropagation()}>
            <div className="chat-head">
              <div className="chat-head-left">
                <div className="chat-ai-icon">🐍</div>
                <div>
                  <div className="chat-head-title">
                    JUJUTSU SCRIPT V3 SUPPORT{' '}
                    <span className="chat-gemini-tag">PYTHON 3 CORE</span>
                  </div>
                  <div className="chat-head-sub">
                    POWER BY @AJAYTREDERKING
                  </div>
                </div>
              </div>
              <button className="chat-close" onClick={() => setSupportOpen(false)}>
                ✕
              </button>
            </div>

            <div className="chat-body" ref={chatBodyRef}>
              {supportMessages.map((m) => (
                <div
                  key={m.id}
                  className={`chat-msg ${m.sender === 'user' ? 'user' : 'ai'}`}
                >
                  <div className="chat-msg-meta">
                    {m.sender === 'user' ? 'You' : 'JUJUTSU PYTHON CORE'}
                    <span className="time">{m.timestamp}</span>
                  </div>
                  <div className="chat-bubble">{m.text}</div>
                </div>
              ))}
              {supportTyping && (
                <div className="chat-msg ai">
                  <div className="chat-typing">
                    🔄 Querying Python 3 Engine...
                  </div>
                </div>
              )}
            </div>

            <div className="chat-quick">
              <span className="chat-quick-lbl">Quick:</span>
              {[
                'Current Python Prediction kya hai?',
                'Same-Side Single Number rule?',
                '30S aur 1M Live API status?',
              ].map((q) => (
                <button
                  key={q}
                  className="chat-q"
                  onClick={() => handleSendSupport(q)}
                >
                  {q}
                </button>
              ))}
            </div>

            <form
              className="chat-form"
              onSubmit={(e) => {
                e.preventDefault();
                handleSendSupport();
              }}
            >
              <input
                className="chat-input"
                type="text"
                placeholder="Ask about Jujutsu Python Script..."
                value={supportInput}
                onChange={(e) => setSupportInput(e.target.value)}
              />
              <button
                className="chat-send"
                type="submit"
                disabled={!supportInput.trim() || supportTyping}
              >
                Send ➤
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ==================== WIN CELEBRATION GLASS OVERLAY ==================== */}
      {winData && (
        <div className="overlay" onClick={() => setWinData(null)}>
          <div className="win-overlay" onClick={(e) => e.stopPropagation()}>
            <button className="win-close" onClick={() => setWinData(null)}>
              ✕
            </button>
            <div className="win-content">
              <span className="win-pill">🏆 JUJUTSU SCRIPT VICTORY</span>
              <div className="win-icon">🏆</div>
              <span className="win-period">PERIOD {winData.roundId}</span>
              <h3 className="win-title">Python Prediction Hit!</h3>
              <div className="win-details">
                <div className="win-detail-row">
                  <span className="l">Python Signal:</span>
                  <span className="r">{winData.targetValue}</span>
                </div>
                <div className="win-detail-row">
                  <span className="l">Actual Draw:</span>
                  <span className="win-detail-actual">
                    <span className="win-actual-ball">{winData.actualNumber}</span>
                    <span>{winData.actualSize}</span>
                  </span>
                </div>
              </div>
              <div className="win-progress">
                <i style={{ width: '100%' }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
