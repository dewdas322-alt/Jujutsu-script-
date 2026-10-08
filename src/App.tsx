/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  HistoryLogEntry,
  EngineStats,
  DetailedEngineTelemetry,
  computeSameSideSingleNumber,
} from './engine/jujustuEngine';

const TELEGRAM_LINK = 'https://t.me/freefaack';

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

// High-Contrast 3D Ball SVG Fallback (Guarantees zero broken images)
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
    periodForecast: 'JUJUTSU SCRIPT • LIVE FORECAST',
    timeLeft: 'TIME LEFT',
  },
  hi: {
    periodForecast: 'JUJUTSU SCRIPT • पीरियड पूर्वानुमान',
    timeLeft: 'शेष समय',
  },
  bn: {
    periodForecast: 'JUJUTSU SCRIPT • পিরিয়ড পূর্বাভাস',
    timeLeft: 'বাকি সময়',
  },
  es: {
    periodForecast: 'JUJUTSU SCRIPT • PRONÓSTICO EN VIVO',
    timeLeft: 'TIEMPO RESTANTE',
  },
  pt: {
    periodForecast: 'JUJUTSU SCRIPT • PREVISÃO AO VIVO',
    timeLeft: 'TEMPO RESTANTE',
  },
};

// Strictly 3 Tabs as requested: Dashboard, Engine, My (Patterns & Live Draw removed)
type TabId = 'dashboard' | 'engine' | 'my';
type FocusTarget = 'SIZE' | 'NUMBER' | 'COLOUR';

interface SupportMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
}

interface WinPopupData {
  isJackpot: boolean;
  roundId: string;
  focusedTarget: string;
  targetValue: string;
  actualNumber: string | number;
  actualSize: string;
  actualColour: string;
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function splitPeriod(p?: string) {
  if (!p) return { prefix: '#', highlight: '00000' };
  const f = p.startsWith('#') ? p : `#${p}`;
  if (f.length > 5) return { prefix: f.slice(0, f.length - 5), highlight: f.slice(f.length - 5) };
  return { prefix: '', highlight: f };
}

/**
 * STRICT SAME-SIDE SINGLE NUMBER LOCK:
 * Never returns an opposite-side number under any circumstance.
 * - BIG -> strictly 5, 6, 7, 8, or 9
 * - SMALL -> strictly 0, 1, 2, 3, or 4
 */
function ensureStrictSameSideSingleNumber(
  predSize: 'BIG' | 'SMALL',
  candidateNum?: number,
  telemetry?: DetailedEngineTelemetry | null
): {
  predictedSize: 'BIG' | 'SMALL';
  predictedNumber: number;
  predictedColour: 'GREEN' | 'RED';
} {
  let num: number;
  if (
    typeof candidateNum === 'number' &&
    !isNaN(candidateNum) &&
    ((predSize === 'BIG' && candidateNum >= 5 && candidateNum <= 9) ||
      (predSize === 'SMALL' && candidateNum >= 0 && candidateNum <= 4))
  ) {
    num = candidateNum;
  } else if (telemetry) {
    num = computeSameSideSingleNumber(telemetry, predSize);
  } else {
    num = predSize === 'BIG' ? 7 : 2;
  }

  // Final hard mathematical clamp so opposite side is 100% impossible
  if (predSize === 'BIG') {
    num = Math.max(5, Math.min(9, num));
  } else {
    num = Math.max(0, Math.min(4, num));
  }

  const predColour: 'GREEN' | 'RED' =
    num === 1 || num === 3 || num === 5 || num === 7 || num === 9 ? 'GREEN' : 'RED';

  return {
    predictedSize: predSize,
    predictedNumber: num,
    predictedColour: predColour,
  };
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [gameMode, setGameMode] = useState<GameMode>('30S');
  const [lang, setLang] = useState<string>('en');
  const [focusedTarget, setFocusedTarget] = useState<FocusTarget>('SIZE');
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
    'none' | 'predictionSettings' | 'language' | 'about'
  >('none');
  const [supportOpen, setSupportOpen] = useState<boolean>(false);
  const [notifOpen, setNotifOpen] = useState<boolean>(false);
  const [winData, setWinData] = useState<WinPopupData | null>(null);

  // Support Chat State
  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: `नमस्ते! मैं JUJUTSU SCRIPT V3 AI सपोर्ट हूँ (Powered by @AJAYTREDERKING)।\n\nयह सिस्टम WinGo 30S (30 सेकंड) और WinGo 1M (1 मिनट) दोनों लाइव API के साथ रियल-टाइम सिंक है और हमेशा 100% Same-Side Single Number ऑटो-प्रेडिक्शन देता है।`,
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

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 2400);
  }, []);

  const applyServerPayload = useCallback(
    (payload: any, activeMode: GameMode) => {
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
              const num = parseInt(String(lastSettled.actualNumber ?? '7'), 10);
              const actualColour =
                num === 0 || num === 5 ? 'VIOLET' : num % 2 === 0 ? 'RED' : 'GREEN';
              setWinData({
                isJackpot: true,
                roundId: `#${lastSettled.period}`,
                focusedTarget: `WINGO ${activeMode}`,
                targetValue: `${lastSettled.pred} (#${lastSettled.singleNumber})`,
                actualNumber: isNaN(num) ? '?' : num,
                actualSize: lastSettled.actual,
                actualColour,
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
    },
    []
  );

  // AUTO-DELETE HISTORY & DATA ON INITIAL OPEN, BACK NAVIGATION, OR UNLOAD
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
        applyServerPayload(data, gameMode);
      }
    } catch {
      // ignore
    }
  }, [applyServerPayload, gameMode]);

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

  // Poll every 2 seconds for snappy 30S and 1M live sync
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

  // Extract active mode state (`30S` or `1M`)
  const activeModeObj = modesData[gameMode] || {};
  const stats: EngineStats = activeModeObj.stats || { wins: 0, losses: 0, total: 0 };
  const currentPrediction = activeModeObj.current_prediction || {};
  const historyLog: HistoryLogEntry[] = activeModeObj.history_log || [];
  const lastResultsInts: number[] = activeModeObj.last_results_ints || [];
  const latestTelemetry: DetailedEngineTelemetry | null =
    activeModeObj.latest_telemetry || null;

  // Core Python Prediction + Strict Same-Side Single Number
  const predSize: 'BIG' | 'SMALL' = currentPrediction.prediction || 'BIG';
  const predConf: number = currentPrediction.confidence ?? 92;
  const predReason: string =
    currentPrediction.reason || 'momentum BIG + markov(BIG->BIG)';
  const periodIdStr: string = currentPrediction.period
    ? `#${currentPrediction.period}`
    : '#SYNCING';

  const sameSideTarget = useMemo(
    () =>
      ensureStrictSameSideSingleNumber(
        predSize,
        currentPrediction.singleNumber,
        latestTelemetry
      ),
    [predSize, currentPrediction.singleNumber, latestTelemetry]
  );

  // Strictly locked to the same side as predSize (never changes on matrix click, never opposite)
  const singlePredNum = sameSideTarget.predictedNumber;
  const displayColour = sameSideTarget.predictedColour;

  const handleClearSessionNow = async () => {
    SoundFX.click();
    await wipeAndStartFreshSession();
    showToast('Session History & Data Auto-Cleared');
  };

  // Support Chat Send
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
      const t = text.toLowerCase();
      let reply = '';
      if (t.includes('30') || t.includes('1m') || t.includes('api')) {
        reply = `JUJUTSU SCRIPT V3 दोनों लाइव API से रियल-टाइम सिंक है:\n• WinGo 30S (30 सेकंड)\n• WinGo 1M (1 मिनट)\nआप ऊपर दिए गए बटन से कभी भी 30 SEC या 1 MIN मोड बदल सकते हैं।`;
      } else if (t.includes('number') || t.includes('single') || t.includes('opposite')) {
        reply = `यह इंजन कभी भी Opposite नंबर नहीं देता! हमेशा 100% Same-Side Single Number देता है:\n• BIG होने पर केवल 5, 6, 7, 8, या 9 (अभी: #${singlePredNum})\n• SMALL होने पर केवल 0, 1, 2, 3, या 4।`;
      } else {
        reply = `अभी WinGo ${gameMode} (${periodIdStr}) के लिए लाइव ऑटो-प्रेडिक्शन: ${predSize} | Same-Side Single Number: #${singlePredNum} (${predConf}% Confidence, Logic: ${predReason}) है।`;
      }
      setSupportMessages((prev) => [
        ...prev,
        { id: `ai_${Date.now()}`, sender: 'ai', text: reply, timestamp: nowTime() },
      ]);
      setSupportTyping(false);
      SoundFX.success();
    }, 500);
  };

  // 10-Node Matrix Frequencies
  const nodeFrequencies = useMemo(() => {
    const counts = Array(10).fill(0);
    lastResultsInts.forEach((n) => {
      if (n >= 0 && n <= 9) counts[n]++;
    });
    const total = Math.max(1, lastResultsInts.length);
    return Array.from({ length: 10 }, (_, num) => {
      const rawPct = Math.round((counts[num] / total) * 100);
      const prob = rawPct > 0 ? rawPct : [12, 8, 6, 9, 7, 8, 10, 11, 9, 10][num];
      const type =
        num === 0 || num === 5 ? 'violet' : num % 2 === 1 ? 'green' : 'red';
      return { num, prob, type };
    });
  }, [lastResultsInts]);

  // BIG vs SMALL Win Rates
  const { bigWinRate, smallWinRate } = useMemo(() => {
    if (lastResultsInts.length === 0) return { bigWinRate: 52, smallWinRate: 48 };
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

  // Display values strictly using Same-Side Single Number
  const playLabel =
    focusedTarget === 'COLOUR'
      ? displayColour
      : focusedTarget === 'NUMBER'
      ? `NUMBER #${singlePredNum}`
      : predSize;

  const playSub =
    focusedTarget === 'COLOUR'
      ? `SAME-SIDE #${singlePredNum} (${predSize}) • ${predReason}`
      : focusedTarget === 'NUMBER'
      ? `100% SAME-SIDE ${predSize} (${predSize === 'BIG' ? '5-9' : '0-4'}) • ${displayColour} • ${predReason}`
      : `SAME-SIDE SINGLE #${singlePredNum} (${predSize === 'BIG' ? '5-9' : '0-4'}) • ${predReason}`;

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
        {/* STICKY HEADER — ONLY JUJUTSU SCRIPT BRANDING */}
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
                    <b>JUJUTSU SCRIPT ({gameMode})</b>
                    <span>Live API Sync</span>
                  </div>
                  <div className="notif-body">
                    <div className="notif-item">
                      <div className="t">⚡ Auto-Prediction Locked</div>
                      <div className="d">
                        WinGo {gameMode} {periodIdStr}: <b>{predSize}</b> (Same-Side Single:{' '}
                        <b>#{singlePredNum}</b>) · {predConf}% Confidence.
                      </div>
                    </div>
                    <div className="notif-item">
                      <div className="t">🛡️ Dual Live API Connected</div>
                      <div className="d">
                        Synced with WinGo_30S &amp; WinGo_1M live endpoints. Session wipes on exit.
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
              WINGO {gameMode} LIVE · <span>SAME-SIDE SINGLE #{singlePredNum}</span>
            </div>
            <div className="pill free">
              <span>
                {stats.wins}W / {stats.losses}L · {overallAccuracy}% ACCURACY
              </span>
            </div>
          </div>
        </header>

        {/* 3 MAIN TABS BAR (Dashboard, Engine, My — Patterns & Live Draw Removed) */}
        <div className="tabs-wrap">
          <div className="tabs" role="tablist" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
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

          {/* DUAL GAME MODE SWITCHER (30 SEC vs 1 MIN LIVE API) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 8,
              background: '#120609',
              padding: 6,
              borderRadius: 14,
              border: '1px solid rgba(220,38,38,.3)',
            }}
          >
            <button
              onClick={() => {
                SoundFX.click();
                setGameMode('30S');
                showToast('Switched to WinGo 30 Seconds Live API');
              }}
              style={{
                padding: '9px 12px',
                borderRadius: 10,
                fontWeight: 900,
                fontSize: 12,
                fontFamily: 'JetBrains Mono, monospace',
                background:
                  gameMode === '30S'
                    ? 'linear-gradient(135deg,#dc2626,#ff1744)'
                    : 'transparent',
                color: gameMode === '30S' ? '#ffffff' : '#fca5a5',
                boxShadow:
                  gameMode === '30S' ? '0 4px 14px rgba(220,38,38,.45)' : 'none',
                transition: 'all .18s',
              }}
            >
              ⚡ WINGO 30 SEC (LIVE)
            </button>
            <button
              onClick={() => {
                SoundFX.click();
                setGameMode('1M');
                showToast('Switched to WinGo 1 Minute Live API');
              }}
              style={{
                padding: '9px 12px',
                borderRadius: 10,
                fontWeight: 900,
                fontSize: 12,
                fontFamily: 'JetBrains Mono, monospace',
                background:
                  gameMode === '1M'
                    ? 'linear-gradient(135deg,#dc2626,#ff1744)'
                    : 'transparent',
                color: gameMode === '1M' ? '#ffffff' : '#fca5a5',
                boxShadow:
                  gameMode === '1M' ? '0 4px 14px rgba(220,38,38,.45)' : 'none',
                transition: 'all .18s',
              }}
            >
              ⏱️ WINGO 1 MIN (LIVE)
            </button>
          </div>

          {/* ==================== TAB 1: DASHBOARD ==================== */}
          {activeTab === 'dashboard' && (
            <div className="tab-pane active">
              {/* Forecast Card */}
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
                      {gameMode === '30S' ? '30 SEC API' : '1 MIN API'}
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
                    <span>● AUTO PREDICTION ON</span>
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
                        }}
                      />
                      PERIOD NUMBER ({gameMode})
                    </div>
                    <div className="period-num">
                      {prefix}
                      {highlight}
                    </div>
                    <div className="period-sub">
                      <span className="muted">JUJUTSU SCRIPT V3</span> · WINGO {gameMode}
                    </div>
                  </div>

                  <div className="timer-wrap">
                    <svg className="timer-svg" viewBox="0 0 48 48">
                      <circle
                        cx="24"
                        cy="24"
                        r="20"
                        stroke="#22090e"
                        strokeWidth="3.5"
                        fill="#0c0406"
                      />
                      <circle
                        cx="24"
                        cy="24"
                        r="20"
                        stroke={urgent ? '#ff1744' : '#dc2626'}
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
                    <span className="trend-label">SAME-SIDE LOCK</span>
                    <div className="trend-bars">
                      <i style={{ height: '45%' }} />
                      <i style={{ height: '70%' }} />
                      <i style={{ height: '60%' }} />
                      <i style={{ height: '85%' }} />
                      <i style={{ height: '100%' }} />
                    </div>
                    <span className="trend-val">
                      {predSize} #{singlePredNum}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3-Way Focus Switch (Strictly Same-Side Single Number) */}
              <div className="ct-focusV2">
                <button
                  className={focusedTarget === 'SIZE' ? 'active' : ''}
                  onClick={() => {
                    SoundFX.click();
                    setFocusedTarget('SIZE');
                  }}
                >
                  <span className="t">SIZE SIGNAL</span>
                  <span className="s">{predSize}</span>
                  <div className="dotline">
                    <i style={{ width: `${predConf}%` }} />
                  </div>
                </button>
                <button
                  className={focusedTarget === 'NUMBER' ? 'active' : ''}
                  onClick={() => {
                    SoundFX.click();
                    setFocusedTarget('NUMBER');
                  }}
                >
                  <span className="t">SAME-SIDE NO.</span>
                  <span className="s">
                    #{singlePredNum} ({predSize})
                  </span>
                  <div className="dotline">
                    <i style={{ width: `${predConf}%` }} />
                  </div>
                </button>
                <button
                  className={focusedTarget === 'COLOUR' ? 'active' : ''}
                  onClick={() => {
                    SoundFX.click();
                    setFocusedTarget('COLOUR');
                  }}
                >
                  <span className="t">COLOR SIGNAL</span>
                  <span className="s">{displayColour}</span>
                  <div className="dotline">
                    <i style={{ width: `${predConf}%` }} />
                  </div>
                </button>
              </div>

              {/* ULTRA PREDICTION BOX — ALWAYS AUTO, STRICT SAME-SIDE SINGLE NUMBER */}
              <div className="ultra-pred">
                <div className="ultra-top">
                  <div className="ultra-top-left">
                    <span className="ultra-live" />
                    JUJUTSU SCRIPT V3 • WINGO {gameMode} AUTO SIGNAL
                  </div>
                  <div className="ultra-period">#{shortId} • SAME-SIDE LOCKED</div>
                </div>
                <div className="ultra-stage">
                  <div className="ultra-rings">
                    <i />
                    <i />
                    <i />
                  </div>

                  <div className="ultra-label">
                    {scanningPulse
                      ? `AUTO-CALIBRATING WINGO ${gameMode} NEXT PERIOD...`
                      : `SAME-SIDE PREDICTION • ${predSize} (${
                          predSize === 'BIG' ? '5-9' : '0-4'
                        }) • SINGLE #${singlePredNum}`}
                  </div>
                  <div className="ultra-value">{playLabel}</div>
                  <div className="ultra-sub">{playSub}</div>

                  {/* Single Same-Side Ball Display */}
                  <div className="ultra-balls">
                    {focusedTarget === 'COLOUR' ? (
                      <div
                        style={{
                          width: 68,
                          height: 68,
                          borderRadius: '50%',
                          background:
                            displayColour === 'RED'
                              ? 'radial-gradient(circle at 35% 35%,#f87171,#dc2626)'
                              : 'radial-gradient(circle at 35% 35%,#34d399,#059669)',
                          boxShadow: '0 8px 24px rgba(220,38,38,.45)',
                          border: '2.5px solid #fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontFamily: 'JetBrains Mono, monospace',
                          fontWeight: 900,
                          fontSize: 22,
                          color: '#fff',
                        }}
                      >
                        {singlePredNum}
                      </div>
                    ) : (
                      <BallImage
                        num={singlePredNum}
                        style={{ width: 74, height: 74 }}
                      />
                    )}
                  </div>

                  <div className="ultra-chips">
                    <div className="ultra-chip">
                      <b>{predConf}%</b>
                      <span>CONFIDENCE</span>
                    </div>
                    <div className="ultra-chip">
                      <b>#{singlePredNum}</b>
                      <span>SAME-SIDE ({predSize})</span>
                    </div>
                    <div className="ultra-chip">
                      <b>{predSize}</b>
                      <span>DIABLO CORE</span>
                    </div>
                  </div>

                  <div className="ultra-meter">
                    <div className="ultra-meter-top">
                      <span>WIN PROBABILITY ({gameMode})</span>
                      <span>{predConf}%</span>
                    </div>
                    <div className="ultra-bar">
                      <i style={{ width: `${predConf}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Active Target Bar */}
              <div className="ct-miniV2">
                <b>
                  ⚡ AUTO LOCKED: {predSize} · SAME-SIDE SINGLE #{singlePredNum}
                </b>
                <div className="focus-mini-switch">
                  {(['SIZE', 'NUMBER', 'COLOUR'] as const).map((tMode) => (
                    <button
                      key={tMode}
                      className={focusedTarget === tMode ? 'active' : ''}
                      onClick={() => {
                        SoundFX.click();
                        setFocusedTarget(tMode);
                      }}
                    >
                      {tMode === 'COLOUR' ? 'COLOR' : tMode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Triple Cards — Same-Side Single Number, Color, Size */}
              <div className="ct-tripleV2">
                <div
                  className={`ct-cardV2 ${focusedTarget === 'NUMBER' ? 'active' : ''}`}
                  onClick={() => {
                    SoundFX.click();
                    setFocusedTarget('NUMBER');
                  }}
                >
                  <div>
                    <h4>SAME-SIDE NO.</h4>
                    {focusedTarget === 'NUMBER' && (
                      <span className="playnow">ACTIVE</span>
                    )}
                  </div>
                  <div style={{ margin: '8px 0' }}>
                    <BallImage num={singlePredNum} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#fde047' }}>
                      #{singlePredNum} ({predSize} {predSize === 'BIG' ? '5-9' : '0-4'})
                    </div>
                    <button
                      className={`ct-go ${focusedTarget === 'NUMBER' ? 'on' : ''}`}
                    >
                      Single #{singlePredNum}
                    </button>
                  </div>
                </div>

                <div
                  className={`ct-cardV2 ${focusedTarget === 'COLOUR' ? 'active' : ''}`}
                  onClick={() => {
                    SoundFX.click();
                    setFocusedTarget('COLOUR');
                  }}
                >
                  <div>
                    <h4>COLOR</h4>
                    {focusedTarget === 'COLOUR' && (
                      <span className="playnow">ACTIVE</span>
                    )}
                  </div>
                  <div style={{ margin: '8px 0' }}>
                    <div
                      style={{
                        width: 50,
                        height: 50,
                        margin: '0 auto',
                        borderRadius: '50%',
                        background:
                          displayColour === 'RED'
                            ? 'radial-gradient(circle at 35% 35%,#f87171,#dc2626)'
                            : 'radial-gradient(circle at 35% 35%,#34d399,#059669)',
                        border: '2px solid #fff',
                        boxShadow: '0 6px 16px rgba(0,0,0,.4)',
                      }}
                    />
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 900,
                        color: displayColour === 'RED' ? '#ff1744' : '#34d399',
                        marginTop: 5,
                      }}
                    >
                      {displayColour}
                    </div>
                  </div>
                  <div>
                    <button
                      className={`ct-go ${focusedTarget === 'COLOUR' ? 'on' : ''}`}
                    >
                      {displayColour}
                    </button>
                  </div>
                </div>

                <div
                  className={`ct-cardV2 ${focusedTarget === 'SIZE' ? 'active' : ''}`}
                  onClick={() => {
                    SoundFX.click();
                    setFocusedTarget('SIZE');
                  }}
                >
                  <div>
                    <h4>SIZE</h4>
                    {focusedTarget === 'SIZE' && (
                      <span className="playnow">ACTIVE</span>
                    )}
                  </div>
                  <div style={{ margin: '8px 0' }}>
                    <div
                      style={{
                        fontSize: 24,
                        fontWeight: 900,
                        color: '#fde047',
                        fontFamily: 'JetBrains Mono, monospace',
                      }}
                    >
                      {predSize}
                    </div>
                    <div
                      style={{
                        fontSize: 9.5,
                        fontWeight: 800,
                        color: '#fca5a5',
                        marginTop: 4,
                      }}
                    >
                      RANGE: {predSize === 'SMALL' ? '0 - 4' : '5 - 9'}
                    </div>
                  </div>
                  <div>
                    <button
                      className={`ct-go ${focusedTarget === 'SIZE' ? 'on' : ''}`}
                    >
                      {predSize}
                    </button>
                  </div>
                </div>
              </div>

              {/* 4 Metrics Strip */}
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
                    {(lastResultsInts.length >= 4
                      ? lastResultsInts.slice(-4)
                      : [7, 8, 9, 5]
                    ).map((num, idx) => (
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
                    const safeSingle = ensureStrictSameSideSingleNumber(
                      item.pred,
                      item.singleNumber
                    ).predictedNumber;

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

          {/* ==================== TAB 2: ENGINE (ALL ANALYTICS & CORE LOGICS) ==================== */}
          {activeTab === 'engine' && (
            <div className="tab-pane active">
              {/* 10-Node Analysis Matrix (Moved from below Dashboard History as requested) */}
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
                                width: `${Math.min(100, n.prob * 5)}%`,
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
                                width: `${Math.min(100, n.prob * 5)}%`,
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
                      <span>Weight</span>
                      <span style={{ textAlign: 'right' }}>Status</span>
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
                                    width: `${Math.min(100, n.prob * 5)}%`,
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

              {/* BIG vs SMALL Win Rates (Moved from below Dashboard History as requested) */}
              <div className="winrates">
                <div className="card winrate">
                  <div className="winrate-head">
                    <span className="winrate-title">BIG (5 - 9)</span>
                    <span className="winrate-pct blue">
                      <span className="lbl">FREQUENCY</span> {bigWinRate}%
                    </span>
                  </div>
                  <div className="winrate-bar">
                    <i className="blue" style={{ width: `${bigWinRate}%` }} />
                  </div>
                  <div className="winrate-foot">
                    <div className="winrate-checks">
                      <div className="winrate-check">✓ Master Calculation</div>
                      <div className="winrate-check">✓ Markov Chain Decay</div>
                      <div className="winrate-check">✓ Diablo Ensemble</div>
                    </div>
                    <div className="winrate-ring">
                      <svg viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="15" stroke="#24090e" strokeWidth="3" fill="none" />
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
                      <span className="lbl">FREQUENCY</span> {smallWinRate}%
                    </span>
                  </div>
                  <div className="winrate-bar">
                    <i className="green" style={{ width: `${smallWinRate}%` }} />
                  </div>
                  <div className="winrate-foot">
                    <div className="winrate-checks">
                      <div className="winrate-check">✓ Master Calculation</div>
                      <div className="winrate-check">✓ Markov Chain Decay</div>
                      <div className="winrate-check">✓ Diablo Ensemble</div>
                    </div>
                    <div className="winrate-ring">
                      <svg viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="15" stroke="#24090e" strokeWidth="3" fill="none" />
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

              {/* Recent 20 Draws Trend & Engine Telemetry (Moved from below Dashboard History) */}
              <div className="trend-grid">
                <div className="card trend-chart">
                  <div className="trend-chart-title">
                    📈 RECENT TREND <span className="muted">(LAST 20 DRAWS · {gameMode})</span>
                  </div>
                  <div className="trend-svg-wrap">
                    <svg className="trend-svg" viewBox="0 0 240 48" preserveAspectRatio="none">
                      <line
                        x1="0"
                        y1="24"
                        x2="240"
                        y2="24"
                        stroke="rgba(220,38,38,.25)"
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
                    <div className="insight-title">💡 DIABLO ENSEMBLE VOTES</div>
                    <p className="insight-text">
                      Active Signal: <b>{predSize}</b> (Same-Side Single <b>#{singlePredNum}</b>) via{' '}
                      <b>{predReason}</b>.
                    </p>
                  </div>
                  <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: '#fde047', fontWeight: 800, marginTop: 6 }}>
                    BIG Weight: {latestTelemetry?.votes.BIG.toFixed(1) ?? '4.5'} · SMALL Weight: {latestTelemetry?.votes.SMALL.toFixed(1) ?? '3.5'}
                  </div>
                </div>
              </div>

              {/* Diablo Pattern AI Sub-Engines */}
              <div className="card section">
                <div className="section-head">
                  <div className="section-title">
                    ✨ Diablo Pattern AI Sub-Engines (Live {gameMode})
                  </div>
                  <span className="tag">4 ADVANCED LOGICS</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div className="pattern-row">
                    <div>
                      <span className="t">
                        Momentum Engine (`momentum_prediction` · Weight 2.5x)
                      </span>
                      <span className="s">
                        Active streak:{' '}
                        {latestTelemetry?.sub_engines.momentum.current_streak ?? 1}{' '}
                        consecutive rounds
                      </span>
                    </div>
                    <span className="m blue">
                      {latestTelemetry?.sub_engines.momentum.pred ?? predSize}
                    </span>
                  </div>

                  <div className="pattern-row">
                    <div>
                      <span className="t">
                        Markov Chain Decay (`markov_chain_decay` · Weight 2.0x)
                      </span>
                      <span className="s">
                        Weighted BIG: {latestTelemetry?.sub_engines.markov.weighted_big ?? 12} pts · Weighted SMALL:{' '}
                        {latestTelemetry?.sub_engines.markov.weighted_small ?? 10} pts
                      </span>
                    </div>
                    <span className="m amber">
                      {latestTelemetry?.sub_engines.markov.pred ?? predSize}
                    </span>
                  </div>

                  <div className="pattern-row">
                    <div>
                      <span className="t">
                        Frequency Balance (`freq_balance_prediction` · Weight 1.5x)
                      </span>
                      <span className="s">
                        10-Round Ratio:{' '}
                        {latestTelemetry?.sub_engines.freq_balance.big_count ?? 5}B /{' '}
                        {latestTelemetry?.sub_engines.freq_balance.small_count ?? 5}S
                      </span>
                    </div>
                    <span className="m blue">
                      {latestTelemetry?.sub_engines.freq_balance.pred ?? predSize}
                    </span>
                  </div>

                  <div className="pattern-row">
                    <div>
                      <span className="t">
                        Streak Break Detector (`streak_break_prediction` · Priority Lock)
                      </span>
                      <span className="s">
                        Run length:{' '}
                        {latestTelemetry?.sub_engines.streak_break.current_streak ?? 1}{' '}
                        / 4 threshold
                      </span>
                    </div>
                    <span className="m amber">
                      {latestTelemetry?.sub_engines.streak_break.pred || 'STANDBY'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Core Logic 1: Master Calculation 5-Method Matrix */}
              <div className="card section">
                <div className="section-head">
                  <div className="section-title">
                    🧮 Core Logic 1: Master Calculation (`master_calculation_prediction`)
                  </div>
                  <span className="tag">
                    Output: {latestTelemetry?.sub_engines.master.final_prediction ?? predSize}
                  </span>
                </div>
                <p className="section-desc">
                  Unaltered 5-Method mathematical matrix running on Period{' '}
                  <b>{currentPrediction.period}</b>.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    {
                      label: 'Method 1 (Base + History + Mod + Mean)',
                      val: latestTelemetry?.sub_engines.master.method1 ?? 6,
                      res: latestTelemetry?.sub_engines.master.results[0] ?? 'BIG',
                    },
                    {
                      label: 'Method 2 (Shift + 3-Round Trend)',
                      val: latestTelemetry?.sub_engines.master.method2 ?? 4,
                      res: latestTelemetry?.sub_engines.master.results[1] ?? 'SMALL',
                    },
                    {
                      label: 'Method 3 (Mirror Reverse Factor)',
                      val: latestTelemetry?.sub_engines.master.method3 ?? 8,
                      res: latestTelemetry?.sub_engines.master.results[2] ?? 'BIG',
                    },
                    {
                      label: 'Method 4 (5-Point Weighted Vector)',
                      val: latestTelemetry?.sub_engines.master.method4 ?? 5,
                      res: latestTelemetry?.sub_engines.master.results[3] ?? 'BIG',
                    },
                    {
                      label: 'Method 5 (Chaos Prime Tie-Breaker)',
                      val: latestTelemetry?.sub_engines.master.method5 ?? 7,
                      res: latestTelemetry?.sub_engines.master.results[4] ?? 'BIG',
                    },
                  ].map((m, i) => (
                    <div key={i} className="pattern-row">
                      <div>
                        <span className="t">{m.label}</span>
                        <span className="s">Calculated Digit: {m.val}</span>
                      </div>
                      <span className={`m ${m.res === 'BIG' ? 'blue' : 'amber'}`}>
                        {m.res}
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
                    placeholder="Search period or engine reason..."
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
                    const safeSingle = ensureStrictSameSideSingleNumber(
                      item.pred,
                      item.singleNumber
                    ).predictedNumber;

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
                    💻 Classic Terminal Output (`render_dashboard` · {gameMode})
                  </div>
                  <span className="tag">LIVE CONSOLE</span>
                </div>
                <div
                  style={{
                    background: '#080204',
                    color: '#f8fafc',
                    padding: 14,
                    borderRadius: 12,
                    border: '1px solid rgba(220,38,38,.3)',
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
                      borderBottom: '1px solid rgba(220,38,38,.3)',
                      paddingBottom: 4,
                      marginBottom: 6,
                      color: '#fca5a5',
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

          {/* FOOTER */}
          <footer className="footer">
            <div className="footer-badge">
              <span>🔥</span>
              <span className="txt">JUJUTSU SCRIPT V3</span>
              <span className="sep">·</span>
              <span className="ver">POWER BY @AJAYTREDERKING</span>
            </div>
            <p className="footer-note">
              WinGo 30S &amp; 1M Live Sync · 100% Same-Side Single Number · Auto-Deletes History on Back/Exit.
            </p>
          </footer>
        </div>
      </div>

      {/* ==================== SIDE MENU DRAWER ==================== */}
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
                  <div style={{ fontSize: 10, color: '#fca5a5', fontWeight: 600 }}>
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
                  <div className="ttl">🔥 WINGO 30S &amp; 1M LIVE</div>
                  <div className="sub">100% Same-Side Single Number</div>
                </div>
                <span className="set-item-badge on">{gameMode}</span>
              </div>

              {(
                [
                  { id: 'dashboard', label: '1. Dashboard (Auto Prediction)' },
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
                  ✨ Jujutsu AI Support
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== SETTINGS MODAL ==================== */}
      {settingsOpen && (
        <div className="overlay" onClick={() => setSettingsOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-head-title">
                Jujutsu Script Settings{' '}
                <span className="modal-head-badge">PRO V3</span>
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
                        <span className="tag-full">ACTIVE</span>
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
                        <div className="set-item-icon">⚡</div>
                        <div>
                          <div className="set-item-title">
                            Diablo Ensemble &amp; Core Logics
                          </div>
                          <div className="set-item-sub">
                            WinGo 30S &amp; 1M · Same-Side Single Number
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

                    <button
                      className="set-item highlight"
                      onClick={() => {
                        SoundFX.click();
                        setSettingsOpen(false);
                        setSupportOpen(true);
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="set-item-icon solid-blue">🎧</div>
                        <div>
                          <div className="set-item-title">Jujutsu AI Support</div>
                          <div className="set-item-sub">
                            24/7 Smart Assistant
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
                      ⚡ Active Jujutsu V3 Logics
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
                        label: 'WinGo 30S & WinGo 1M Dual Live API',
                        desc: 'Real-time synchronization with both official draw endpoints',
                      },
                      {
                        label: 'Strict Same-Side Single Number Lock',
                        desc: 'BIG strictly predicts 5–9; SMALL strictly predicts 0–4 (Never opposite)',
                      },
                      {
                        label: 'Diablo Premium Ensemble Predictor',
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

      {/* ==================== AI SUPPORT CHAT MODAL ==================== */}
      {supportOpen && (
        <div className="overlay" onClick={() => setSupportOpen(false)}>
          <div className="chat-modal" onClick={(e) => e.stopPropagation()}>
            <div className="chat-head">
              <div className="chat-head-left">
                <div className="chat-ai-icon">🤖</div>
                <div>
                  <div className="chat-head-title">
                    JUJUTSU SCRIPT V3 SUPPORT{' '}
                    <span className="chat-gemini-tag">30S &amp; 1M AI</span>
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
                    {m.sender === 'user' ? 'You' : 'JUJUTSU V3 AI'}
                    <span className="time">{m.timestamp}</span>
                  </div>
                  <div className="chat-bubble">{m.text}</div>
                </div>
              ))}
              {supportTyping && (
                <div className="chat-msg ai">
                  <div className="chat-typing">
                    🔄 Jujutsu AI is generating response...
                  </div>
                </div>
              )}
            </div>

            <div className="chat-quick">
              <span className="chat-quick-lbl">Quick:</span>
              {[
                '30S aur 1M API kaise switch karein?',
                'Same-Side Single Number rule?',
                'Current Auto Prediction kya hai?',
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
                placeholder="Ask anything about Jujutsu Script V3..."
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

      {/* ==================== WIN CELEBRATION OVERLAY ==================== */}
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
              <h3 className="win-title">Prediction Hit!</h3>
              <div className="win-details">
                <div className="win-detail-row">
                  <span className="l">Predicted Target:</span>
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
