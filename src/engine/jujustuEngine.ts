/**
 * JUJUSTU SCRIPT V3 — Exact 1:1 Core & Diablo + A-to-Z Ultra-Adaptive Pattern Engine
 * Powered by @AJAYTREDERKING
 * Preserves 100% of Original Core Logics + Adds Multi-Order N-Gram Markov,
 * ZigZag (1x1 / 2x2 / 2x1), Smart Dragon Trend Rider, Mirror Symmetry,
 * and Real-Time Backtest Level 1-to-3 Fix Shield.
 */

export type BigSmall = 'BIG' | 'SMALL' | 'Unknown';

export interface HistoryLogEntry {
  period: string;
  pred: 'BIG' | 'SMALL';
  singleNumber: number; // Strictly 5..9 for BIG, 0..4 for SMALL
  actual: string; // "BIG", "SMALL", or "?"
  actualNumber?: string; // e.g., "7", "3", or "?"
  outcome: 'WIN' | 'LOSE' | 'PENDING';
  isJackpot?: boolean; // True ONLY when actualNumber === singleNumber
  level?: number; // Level 1, 2, or 3
  reason: string;
  confidence: number;
  stats_str: string;
  timestamp: string;
}

export interface EngineStats {
  wins: number;
  losses: number;
  total: number;
}

export interface MasterMethodBreakdown {
  base_calc: number;
  history_factor: number;
  math_modifier: number;
  statistical_mean: number;
  method1: number;
  method2: number;
  method3: number;
  method4: number;
  method5: number;
  results: ('BIG' | 'SMALL')[];
  big_count: number;
  small_count: number;
  final_prediction: 'BIG' | 'SMALL';
}

export interface DetailedEngineTelemetry {
  period_number: string;
  next_period: string;
  final_pred: 'BIG' | 'SMALL';
  combined_reason: string;
  confidence: number;
  trend_lock_triggered: boolean;
  active_regime?: string;
  current_level?: number;
  votes: { BIG: number; SMALL: number };
  sub_engines: {
    streak_break: {
      pred: 'BIG' | 'SMALL' | null;
      reason: string;
      current_streak: number;
      streak_val: string;
    };
    momentum: {
      pred: 'BIG' | 'SMALL';
      reason: string;
      weight: number;
      current_streak: number;
    };
    markov: {
      pred: 'BIG' | 'SMALL';
      reason: string;
      weight: number;
      weighted_big: number;
      weighted_small: number;
      transitions_count: number;
    };
    freq_balance: {
      pred: 'BIG' | 'SMALL';
      reason: string;
      weight: number;
      big_count: number;
      small_count: number;
    };
    hybrid: {
      pred: 'BIG' | 'SMALL';
      stable_pred: 'BIG' | 'SMALL';
      weight: number;
    };
    master: MasterMethodBreakdown & { weight: number };
    ngram_markov?: {
      pred: 'BIG' | 'SMALL';
      reason: string;
      weight: number;
      order3_big: number;
      order3_small: number;
      pattern: string;
    };
    zigzag?: {
      pred: 'BIG' | 'SMALL' | null;
      reason: string;
      weight: number;
      type: string;
      alternations: number;
    };
    dragon?: {
      pred: 'BIG' | 'SMALL' | null;
      reason: string;
      weight: number;
      dragon_len: number;
      mode: string;
    };
    mirror?: {
      pred: 'BIG' | 'SMALL';
      reason: string;
      weight: number;
      symmetry: string;
      match_score: number;
    };
  };
}

export function computeSameSideSingleNumber(
  telemetry: DetailedEngineTelemetry,
  predSize: 'BIG' | 'SMALL',
  lastResults: number[] = []
): number {
  const m = telemetry.sub_engines.master;
  const methods = [m.method1, m.method2, m.method3, m.method4, m.method5];
  const sameSideCandidates = methods.filter((val) =>
    predSize === 'BIG' ? val >= 5 : val < 5
  );
  if (sameSideCandidates.length > 0) {
    const recent20 = lastResults.slice(-20);
    let bestNum = sameSideCandidates[0];
    let bestScore = -1;
    for (const c of sameSideCandidates) {
      const mCount = sameSideCandidates.filter((x) => x === c).length;
      const hCount = recent20.filter((x) => x === c).length;
      const score = mCount * 10 + hCount;
      if (score > bestScore) {
        bestScore = score;
        bestNum = c;
      }
    }
    return bestNum;
  }
  return predSize === 'BIG' ? 5 + (m.method5 % 5) : m.method5 % 5;
}

// ==================================================
// 📊 Result Handling (UNCHANGED)
// ==================================================
export function get_big_small(num: string | number): BigSmall {
  try {
    const parsed = parseInt(String(num), 10);
    if (isNaN(parsed)) return 'Unknown';
    return parsed >= 5 ? 'BIG' : 'SMALL';
  } catch {
    return 'Unknown';
  }
}

function pyMod(n: bigint, m: bigint): number {
  const res = n % m;
  return Number(res < 0n ? res + m : res);
}

// ==================================================
// 🧮 OLD CORE LOGIC 1: Master Calculation (UNCHANGED)
// ==================================================
export function master_calculation_breakdown(
  period_number: string,
  last_results: (number | string)[]
): MasterMethodBreakdown {
  const cleanDigits = String(period_number).replace(/\D/g, '') || '0';
  const n = BigInt(cleanDigits);
  const last_ints: number[] =
    last_results && last_results.length > 0
      ? last_results.map((x) => parseInt(String(x), 10)).filter((x) => !isNaN(x))
      : [0];
  if (last_ints.length === 0) last_ints.push(0);

  const sumAll = last_ints.reduce((acc, v) => acc + v, 0);

  const base_calc = pyMod(n * 73n - (n % 43n), 10n);
  const history_factor = ((sumAll % 10) + 10) % 10;
  const math_modifier = pyMod(n ** 2n, 9n);
  const last5 = last_ints.slice(-5);
  const statistical_mean =
    last_ints.length >= 5
      ? Math.trunc(last5.reduce((a, b) => a + b, 0) / last5.length) % 10
      : 0;
  const method1 = (base_calc + history_factor + math_modifier + statistical_mean) % 10;

  const shift = pyMod(n, 7n) + (last_ints.length % 3);
  const last3 = last_ints.slice(-3);
  const trend_factor =
    (last_ints.length >= 3 ? last3.reduce((a, b) => a + b, 0) : sumAll) % 10;
  const method2 = pyMod(n + BigInt(shift) + BigInt(trend_factor), 10n);

  const nStr = n.toString();
  const reversedStr = nStr.split('').reverse().join('');
  const mirror = nStr.length > 1 ? pyMod(BigInt(reversedStr), 10n) : pyMod(n, 10n);
  const last4 = last_ints.slice(-4);
  const reverse_factor =
    (mirror + (last_ints.length >= 4 ? last4.reduce((a, b) => a + b, 0) : 0)) % 10;
  const method3 = pyMod(BigInt(reverse_factor) * 3n + n, 10n);

  const weights = [0.2, 0.15, 0.25, 0.1, 0.3];
  let weighted_sum = 0;
  if (last_ints.length >= 5) {
    const slice5 = last_ints.slice(-5);
    weighted_sum = slice5.reduce((acc, x, idx) => acc + x * weights[idx], 0);
  } else {
    weighted_sum = sumAll * 0.5;
  }
  const method4 = Math.trunc(weighted_sum + pyMod(n, 5n)) % 10;

  const avg_last = last_ints.length > 0 ? Math.trunc(sumAll / last_ints.length) % 10 : 0;
  const chaos = pyMod(n * 97n + BigInt(sumAll) * 31n, 10n);
  const method5 = pyMod(BigInt(avg_last) + BigInt(chaos) + n, 10n);

  const results: ('BIG' | 'SMALL')[] = [
    method1 >= 5 ? 'BIG' : 'SMALL',
    method2 >= 5 ? 'BIG' : 'SMALL',
    method3 >= 5 ? 'BIG' : 'SMALL',
    method4 >= 5 ? 'BIG' : 'SMALL',
    method5 >= 5 ? 'BIG' : 'SMALL',
  ];

  const big_count = results.filter((r) => r === 'BIG').length;
  const small_count = results.filter((r) => r === 'SMALL').length;

  let final_prediction: 'BIG' | 'SMALL';
  if (big_count > small_count) {
    final_prediction = 'BIG';
  } else if (small_count > big_count) {
    final_prediction = 'SMALL';
  } else {
    final_prediction = method5 >= 5 ? 'BIG' : 'SMALL';
  }

  return {
    base_calc,
    history_factor,
    math_modifier,
    statistical_mean,
    method1,
    method2,
    method3,
    method4,
    method5,
    results,
    big_count,
    small_count,
    final_prediction,
  };
}

export function master_calculation_prediction(
  period_number: string,
  last_results: (number | string)[]
): 'BIG' | 'SMALL' {
  return master_calculation_breakdown(period_number, last_results).final_prediction;
}

// ==================================================
// 🧠 OLD CORE LOGIC 2: Hybrid Prediction (UNCHANGED)
// ==================================================
export function stable_logic_prediction(
  period_number: string,
  last_results: (number | string)[],
  prev_prediction: 'BIG' | 'SMALL' | null = null
): 'BIG' | 'SMALL' {
  const recent = last_results.slice(-10);
  const labeled = recent.map((r) => (parseInt(String(r), 10) >= 5 ? 'BIG' : 'SMALL'));
  const big_count = labeled.filter((l) => l === 'BIG').length;
  const small_count = labeled.filter((l) => l === 'SMALL').length;

  const pStr = String(period_number);
  let history_pred: 'BIG' | 'SMALL';
  if (big_count > small_count) {
    history_pred = 'BIG';
  } else if (small_count > big_count) {
    history_pred = 'SMALL';
  } else {
    const lastDigit = parseInt(pStr[pStr.length - 1] || '0', 10);
    history_pred = lastDigit >= 5 ? 'BIG' : 'SMALL';
  }

  const last3_period = parseInt(pStr.slice(-3) || '0', 10);
  const digit_sum = String(last3_period)
    .split('')
    .reduce((acc, d) => acc + parseInt(d, 10), 0);
  const period_pred: 'BIG' | 'SMALL' = digit_sum % 2 === 0 ? 'BIG' : 'SMALL';

  let base_pred: 'BIG' | 'SMALL';
  if (history_pred === period_pred) {
    base_pred = history_pred === 'BIG' ? 'SMALL' : 'BIG';
  } else {
    base_pred = history_pred;
  }

  if (prev_prediction && base_pred === prev_prediction) {
    base_pred = base_pred === 'BIG' ? 'SMALL' : 'BIG';
  }
  return base_pred;
}

export function hybrid_prediction(
  period_number: string,
  last_results: (number | string)[],
  prev_prediction: 'BIG' | 'SMALL' | null = null
): 'BIG' | 'SMALL' {
  const chance = Math.random();
  let base: 'BIG' | 'SMALL';

  if (chance < 0.2 && last_results.length > 0) {
    const bs = get_big_small(last_results[last_results.length - 1]);
    base = bs === 'BIG' ? 'BIG' : 'SMALL';
  } else if (chance < 0.6) {
    base = Math.random() < 0.5 ? 'BIG' : 'SMALL';
  } else if (chance < 0.7) {
    if (last_results.length >= 2) {
      const last1 = get_big_small(last_results[last_results.length - 1]);
      const last2 = get_big_small(last_results[last_results.length - 2]);
      if (last1 === last2) {
        base = last1 === 'BIG' ? 'SMALL' : 'BIG';
      } else {
        base = last1 === 'BIG' ? 'BIG' : 'SMALL';
      }
    } else {
      base = Math.random() < 0.5 ? 'BIG' : 'SMALL';
    }
  } else if (chance < 0.75 && prev_prediction) {
    base = prev_prediction === 'BIG' ? 'SMALL' : 'BIG';
  } else {
    base = stable_logic_prediction(period_number, last_results, prev_prediction);
  }

  if (Math.random() < 0.15) {
    const master_pred = master_calculation_prediction(period_number, last_results);
    base = master_pred;
  }

  return base;
}

// ==================================================
// 🚀 EXISTING DIABLO LOGICS (UNCHANGED)
// ==================================================
export function markov_chain_decay(
  last_results: (number | string)[]
): [
  'BIG' | 'SMALL',
  string,
  { weighted_big: number; weighted_small: number; transitions_count: number }
] {
  if (last_results.length < 10) {
    const pred = Math.random() < 0.5 ? 'BIG' : 'SMALL';
    return [pred, 'fallback', { weighted_big: 0, weighted_small: 0, transitions_count: 0 }];
  }

  const recent = last_results.slice(-20).map((r) => get_big_small(r));
  const current_state = recent[recent.length - 1];

  const transitions: BigSmall[] = [];
  for (let i = 0; i < recent.length - 1; i++) {
    if (recent[i] === current_state) {
      transitions.push(recent[i + 1]);
    }
  }

  if (transitions.length === 0) {
    const pred = Math.random() < 0.5 ? 'BIG' : 'SMALL';
    return [pred, 'markov', { weighted_big: 0, weighted_small: 0, transitions_count: 0 }];
  }

  const weights = transitions.map((_, i) => i + 1);
  let weighted_big = 0;
  let weighted_small = 0;
  for (let i = 0; i < transitions.length; i++) {
    if (transitions[i] === 'BIG') weighted_big += weights[i];
    if (transitions[i] === 'SMALL') weighted_small += weights[i];
  }

  const pred: 'BIG' | 'SMALL' = weighted_big > weighted_small ? 'BIG' : 'SMALL';
  return [
    pred,
    `markov(${current_state}->${pred})`,
    { weighted_big, weighted_small, transitions_count: transitions.length },
  ];
}

export function freq_balance_prediction(
  last_results: (number | string)[]
): ['BIG' | 'SMALL', string, { big_count: number; small_count: number }] {
  if (last_results.length < 10) {
    const pred = Math.random() < 0.5 ? 'BIG' : 'SMALL';
    const recent = last_results.map((r) => get_big_small(r));
    const big_count = recent.filter((x) => x === 'BIG').length;
    const small_count = recent.filter((x) => x === 'SMALL').length;
    return [pred, 'fallback', { big_count, small_count }];
  }

  const recent_10 = last_results.slice(-10).map((r) => get_big_small(r));
  const big_count = recent_10.filter((x) => x === 'BIG').length;
  const small_count = recent_10.filter((x) => x === 'SMALL').length;

  if (big_count >= 7) {
    return ['SMALL', `freq-balance (${big_count}B/${small_count}S)`, { big_count, small_count }];
  } else if (small_count >= 7) {
    return ['BIG', `freq-balance (${big_count}B/${small_count}S)`, { big_count, small_count }];
  } else {
    const pred: 'BIG' | 'SMALL' = big_count < small_count ? 'BIG' : 'SMALL';
    return [pred, `freq-balance (${big_count}B/${small_count}S)`, { big_count, small_count }];
  }
}

export function momentum_prediction(
  last_results: (number | string)[]
): ['BIG' | 'SMALL', string, { current_streak: number }] {
  if (last_results.length < 3) {
    const pred = Math.random() < 0.5 ? 'BIG' : 'SMALL';
    return [pred, 'fallback', { current_streak: last_results.length }];
  }

  const recent_5 = last_results.slice(-5).map((r) => get_big_small(r));
  let current_streak = 1;
  const streak_val = recent_5[recent_5.length - 1] === 'BIG' ? 'BIG' : 'SMALL';
  for (let i = recent_5.length - 1; i > 0; i--) {
    if (recent_5[i] === recent_5[i - 1]) {
      current_streak += 1;
    } else {
      break;
    }
  }

  return [streak_val, `momentum ${streak_val}`, { current_streak }];
}

export function streak_break_prediction(
  last_results: (number | string)[]
): ['BIG' | 'SMALL' | null, string, { current_streak: number; streak_val: string }] {
  if (last_results.length < 5) {
    return [null, 'streak-break', { current_streak: 0, streak_val: 'NONE' }];
  }

  const recent_5 = last_results.slice(-5).map((r) => get_big_small(r));
  let current_streak = 1;
  const streak_val = recent_5[recent_5.length - 1];
  for (let i = recent_5.length - 1; i > 0; i--) {
    if (recent_5[i] === recent_5[i - 1]) {
      current_streak += 1;
    } else {
      break;
    }
  }

  if (current_streak >= 4) {
    const pred: 'BIG' | 'SMALL' = streak_val === 'BIG' ? 'SMALL' : 'BIG';
    return [pred, `streak-break (run=${current_streak})`, { current_streak, streak_val }];
  }
  return [null, 'streak-break', { current_streak, streak_val }];
}

// ==================================================
// 🔥 NEW A-TO-Z ULTRA-ADAPTIVE PATTERN LOGICS (ADDED)
// ==================================================

export function ngram_markov_order2_3_prediction(
  last_results: (number | string)[]
): [
  'BIG' | 'SMALL',
  string,
  { order3_big: number; order3_small: number; pattern: string }
] {
  const seq = last_results
    .slice(-35)
    .map((r) => (get_big_small(r) === 'BIG' ? 'BIG' : 'SMALL'));
  if (seq.length < 4) {
    const fallback: 'BIG' | 'SMALL' = seq.length > 0 ? seq[seq.length - 1] : 'BIG';
    return [fallback, 'ngram-markov', { order3_big: 0, order3_small: 0, pattern: 'NONE' }];
  }

  let big_score = 0;
  let small_score = 0;

  const p0 = seq[seq.length - 3];
  const p1 = seq[seq.length - 2];
  const p2 = seq[seq.length - 1];

  for (let i = 0; i < seq.length - 3; i++) {
    if (seq[i] === p0 && seq[i + 1] === p1 && seq[i + 2] === p2) {
      const decay_w = Math.pow(1.35, i) * 2.2;
      if (seq[i + 3] === 'BIG') big_score += decay_w;
      else small_score += decay_w;
    }
  }

  for (let i = 0; i < seq.length - 2; i++) {
    if (seq[i] === p1 && seq[i + 1] === p2) {
      const decay_w = Math.pow(1.28, i) * 1.0;
      if (seq[i + 2] === 'BIG') big_score += decay_w;
      else small_score += decay_w;
    }
  }

  const pat_code = `${p0[0]}${p1[0]}${p2[0]}`;
  if (big_score === 0 && small_score === 0) {
    return [
      p2,
      `ngram(${pat_code}->${p2[0]})`,
      { order3_big: 0, order3_small: 0, pattern: pat_code },
    ];
  }

  const pred: 'BIG' | 'SMALL' = big_score >= small_score ? 'BIG' : 'SMALL';
  return [
    pred,
    `ngram-markov(${pat_code}->${pred})`,
    {
      order3_big: Math.round(big_score * 10) / 10,
      order3_small: Math.round(small_score * 10) / 10,
      pattern: pat_code,
    },
  ];
}

export function zigzag_pattern_prediction(
  last_results: (number | string)[]
): [
  'BIG' | 'SMALL' | null,
  string,
  { type: string; alternations: number }
] {
  const seq = last_results
    .slice(-10)
    .map((r) => (get_big_small(r) === 'BIG' ? 'BIG' : 'SMALL'));
  if (seq.length < 4) {
    return [null, 'zigzag-standby', { type: 'NONE', alternations: 0 }];
  }

  let alt_count = 0;
  for (let i = seq.length - 1; i > 0; i--) {
    if (seq[i] !== seq[i - 1]) alt_count += 1;
    else break;
  }

  if (alt_count >= 3) {
    const pred: 'BIG' | 'SMALL' = seq[seq.length - 1] === 'BIG' ? 'SMALL' : 'BIG';
    return [
      pred,
      `zigzag-1x1 (alt=${alt_count})`,
      { type: 'ZIGZAG_1X1', alternations: alt_count },
    ];
  }

  if (seq.length >= 5) {
    const s5 = seq.slice(-5);
    if (s5[0] === s5[1] && s5[2] === s5[3] && s5[0] !== s5[2] && s5[4] === s5[0]) {
      const pred = s5[4];
      return [
        pred,
        `zigzag-2x2-pair (${pred})`,
        { type: 'TWIN_2X2', alternations: alt_count },
      ];
    }
    if (s5[1] === s5[2] && s5[3] === s5[4] && s5[1] !== s5[3] && s5[0] !== s5[1]) {
      const pred = s5[1];
      return [
        pred,
        `zigzag-2x2-flip (${pred})`,
        { type: 'TWIN_2X2', alternations: alt_count },
      ];
    }
    if (s5[0] === s5[1] && s5[3] === s5[4] && s5[0] === s5[3] && s5[2] !== s5[0]) {
      const pred = s5[2];
      return [
        pred,
        `step-2x1 (${pred})`,
        { type: 'STEP_2X1', alternations: alt_count },
      ];
    }
  }

  return [null, 'zigzag-standby', { type: 'NONE', alternations: alt_count }];
}

export function dragon_pattern_prediction(
  last_results: (number | string)[],
  consecutive_losses = 0
): [
  'BIG' | 'SMALL' | null,
  string,
  { dragon_len: number; mode: string }
] {
  const seq = last_results
    .slice(-12)
    .map((r) => (get_big_small(r) === 'BIG' ? 'BIG' : 'SMALL'));
  if (seq.length < 3) {
    return [null, 'dragon-standby', { dragon_len: seq.length, mode: 'STANDBY' }];
  }

  const dragon_val = seq[seq.length - 1];
  let dragon_len = 1;
  for (let i = seq.length - 1; i > 0; i--) {
    if (seq[i] === seq[i - 1]) dragon_len += 1;
    else break;
  }

  const recent_digits =
    last_results.length >= 3
      ? last_results.slice(-3).map((x) => parseInt(String(x), 10) || 5)
      : [5];
  const avg_dist_from_mid =
    recent_digits.reduce((acc, d) => acc + Math.abs(d - 4.5), 0) / recent_digits.length;

  if (dragon_len >= 5 || (dragon_len >= 3 && consecutive_losses >= 1)) {
    return [
      dragon_val,
      `dragon-rider (${dragon_val}x${dragon_len})`,
      { dragon_len, mode: 'DRAGON_RIDE' },
    ];
  }

  if (dragon_len === 4) {
    if (avg_dist_from_mid >= 2.3) {
      return [
        dragon_val,
        `dragon-lock (${dragon_val}x4)`,
        { dragon_len, mode: 'DRAGON_LOCK' },
      ];
    } else {
      const rev: 'BIG' | 'SMALL' = dragon_val === 'BIG' ? 'SMALL' : 'BIG';
      return [rev, 'dragon-reversal (run=4)', { dragon_len, mode: 'REVERSAL_4' }];
    }
  }

  if (dragon_len === 3) {
    return [
      dragon_val,
      `dragon-build (${dragon_val}x3)`,
      { dragon_len, mode: 'DRAGON_BUILD' },
    ];
  }

  return [null, 'dragon-standby', { dragon_len, mode: 'STANDBY' }];
}

export function mirror_symmetry_prediction(
  last_results: (number | string)[]
): ['BIG' | 'SMALL', string, { symmetry: string; match_score: number }] {
  const seq = last_results
    .slice(-12)
    .map((r) => (get_big_small(r) === 'BIG' ? 'BIG' : 'SMALL'));
  if (seq.length < 6) {
    const fallback: 'BIG' | 'SMALL' = seq.length > 0 ? seq[seq.length - 1] : 'BIG';
    return [fallback, 'mirror-init', { symmetry: 'INIT', match_score: 50 }];
  }

  const L = seq.length;
  if (seq[L - 1] === seq[L - 4] && seq[L - 2] === seq[L - 5]) {
    const pred = seq[L - 3];
    return [pred, `mirror-cycle3 (${pred})`, { symmetry: 'CYCLE_3', match_score: 90 }];
  }

  if (seq[L - 1] === seq[L - 5] && seq[L - 2] === seq[L - 6]) {
    const pred = seq[L - 4];
    return [pred, `mirror-cycle4 (${pred})`, { symmetry: 'CYCLE_4', match_score: 88 }];
  }

  if (seq[L - 1] === seq[L - 3] && seq[L - 2] === seq[L - 4]) {
    const pred = seq[L - 5];
    return [
      pred,
      `mirror-palindrome (${pred})`,
      { symmetry: 'PALINDROME', match_score: 86 },
    ];
  }

  const d_last = parseInt(String(last_results[last_results.length - 1]), 10) || 0;
  const d_prev = parseInt(String(last_results[last_results.length - 2]), 10) || 0;
  const mirror_digit = (9 - d_last + d_prev + 10) % 10;
  const pred: 'BIG' | 'SMALL' = mirror_digit >= 5 ? 'BIG' : 'SMALL';
  return [pred, `mirror-digit (${pred})`, { symmetry: 'COMPLEMENT', match_score: 74 }];
}

function evaluateSingleEngineOnStep(
  engineName: string,
  periodStr: string,
  histSlice: (number | string)[]
): 'BIG' | 'SMALL' {
  if (histSlice.length === 0) return 'BIG';
  if (engineName === 'ngram') return ngram_markov_order2_3_prediction(histSlice)[0];
  if (engineName === 'zigzag') {
    const [pr] = zigzag_pattern_prediction(histSlice);
    if (pr === null) {
      const lastBs = get_big_small(histSlice[histSlice.length - 1]);
      return lastBs === 'BIG' ? 'SMALL' : 'BIG';
    }
    return pr;
  }
  if (engineName === 'dragon') {
    const [pr] = dragon_pattern_prediction(histSlice, 0);
    if (pr === null) {
      return get_big_small(histSlice[histSlice.length - 1]) === 'BIG' ? 'BIG' : 'SMALL';
    }
    return pr;
  }
  if (engineName === 'mirror') return mirror_symmetry_prediction(histSlice)[0];
  if (engineName === 'master') return master_calculation_prediction(periodStr, histSlice);
  if (engineName === 'markov') {
    const recent = histSlice.slice(-20).map((r) => get_big_small(r));
    const curr = recent[recent.length - 1] === 'BIG' ? 'BIG' : 'SMALL';
    const trans: BigSmall[] = [];
    for (let i = 0; i < recent.length - 1; i++) {
      if (recent[i] === curr) trans.push(recent[i + 1]);
    }
    if (trans.length === 0) return curr;
    let wb = 0;
    let ws = 0;
    trans.forEach((t, idx) => {
      if (t === 'BIG') wb += idx + 1;
      else ws += idx + 1;
    });
    return wb >= ws ? 'BIG' : 'SMALL';
  }
  if (engineName === 'freq') {
    const recent = histSlice.slice(-10).map((r) => get_big_small(r));
    const bc = recent.filter((x) => x === 'BIG').length;
    const sc = recent.length - bc;
    if (bc >= 7) return 'SMALL';
    if (sc >= 7) return 'BIG';
    return bc < sc ? 'BIG' : 'SMALL';
  }
  return get_big_small(histSlice[histSlice.length - 1]) === 'BIG' ? 'BIG' : 'SMALL';
}

// ==================================================
// 🥋 DIABLO PREMIUM ENSEMBLE PREDICTOR (WITH A-TO-Z ADAPTIVE L1-L3 SHIELD)
// ==================================================
export function diablo_premium_predictor(
  period_number: string,
  last_results: (number | string)[],
  prev_prediction: 'BIG' | 'SMALL' | null,
  consecutive_losses = 0
): ['BIG' | 'SMALL', string, number] {
  const telemetry = diablo_detailed_telemetry(
    period_number,
    last_results,
    prev_prediction,
    consecutive_losses
  );
  return [telemetry.final_pred, telemetry.combined_reason, telemetry.confidence];
}

export function diablo_detailed_telemetry(
  period_number: string,
  last_results: (number | string)[],
  prev_prediction: 'BIG' | 'SMALL' | null,
  consecutive_losses = 0
): DetailedEngineTelemetry {
  // 1. Gather ALL Original Predictions
  const [sb_pred, sb_reason, sb_meta] = streak_break_prediction(last_results);
  const [mom_pred, mom_reason, mom_meta] = momentum_prediction(last_results);
  const [mk_pred, mk_reason, mk_meta] = markov_chain_decay(last_results);
  const [fb_pred, fb_reason, fb_meta] = freq_balance_prediction(last_results);
  const p_hybrid = hybrid_prediction(period_number, last_results, prev_prediction);
  const stable_pred = stable_logic_prediction(period_number, last_results, prev_prediction);
  const master_breakdown = master_calculation_breakdown(period_number, last_results);
  const p_master = master_breakdown.final_prediction;

  // 2. Gather NEW A-to-Z Pattern Predictions
  const [ng_pred, ng_reason, ng_meta] = ngram_markov_order2_3_prediction(last_results);
  const [zz_pred, zz_reason, zz_meta] = zigzag_pattern_prediction(last_results);
  const [dr_pred, dr_reason, dr_meta] = dragon_pattern_prediction(
    last_results,
    consecutive_losses
  );
  const [mr_pred, mr_reason, mr_meta] = mirror_symmetry_prediction(last_results);

  const cleanDigits = String(period_number).replace(/\D/g, '') || '0';
  const baseBigInt = BigInt(cleanDigits);
  const next_period = (baseBigInt + 1n).toString();

  // 3. Real-Time Local Backtest Accuracy Weighting (Level 1-3 Fix Shield)
  const engineAccuracyBoost: Record<string, number> = {
    ngram: 1.0,
    zigzag: 1.0,
    dragon: 1.0,
    mirror: 1.0,
    master: 1.0,
    markov: 1.0,
    freq: 1.0,
    momentum: 1.0,
  };

  if (last_results.length >= 8) {
    const windowSize = Math.min(5, last_results.length - 4);
    for (const name of Object.keys(engineAccuracyBoost)) {
      let hits = 0;
      for (let offset = windowSize; offset >= 1; offset--) {
        const subSlice = last_results.slice(0, last_results.length - offset);
        const actualOut = get_big_small(last_results[last_results.length - offset]);
        const simPeriod = (baseBigInt - BigInt(offset)).toString();
        const predOut = evaluateSingleEngineOnStep(name, simPeriod, subSlice);
        if (predOut === actualOut) hits += 1;
      }
      const hitRate = hits / windowSize;
      if (hitRate >= 0.8) engineAccuracyBoost[name] = 2.35;
      else if (hitRate >= 0.6) engineAccuracyBoost[name] = 1.55;
      else if (hitRate <= 0.2) engineAccuracyBoost[name] = 0.2;
      else engineAccuracyBoost[name] = 0.75;
    }
  }

  let active_regime = `N-GRAM MARKOV (${ng_meta.pattern})`;
  if (dr_pred !== null && (dr_meta.mode === 'DRAGON_RIDE' || dr_meta.mode === 'DRAGON_LOCK')) {
    active_regime = `DRAGON TREND (${dr_meta.mode})`;
  } else if (zz_pred !== null) {
    active_regime = `ZIGZAG PATTERN (${zz_meta.type})`;
  } else if (mr_meta.match_score >= 86) {
    active_regime = `MIRROR SYMMETRY (${mr_meta.symmetry})`;
  }

  const subEnginesPayload: DetailedEngineTelemetry['sub_engines'] = {
    streak_break: { pred: sb_pred, reason: sb_reason, ...sb_meta },
    momentum: { pred: mom_pred, reason: mom_reason, weight: 2.2, ...mom_meta },
    markov: { pred: mk_pred, reason: mk_reason, weight: 2.0, ...mk_meta },
    freq_balance: { pred: fb_pred, reason: fb_reason, weight: 1.5, ...fb_meta },
    hybrid: { pred: p_hybrid, stable_pred, weight: 1.0 },
    master: { ...master_breakdown, weight: 1.8 },
    ngram_markov: { pred: ng_pred, reason: ng_reason, weight: 3.0, ...ng_meta },
    zigzag: { pred: zz_pred, reason: zz_reason, weight: 3.4, ...zz_meta },
    dragon: { pred: dr_pred, reason: dr_reason, weight: 3.2, ...dr_meta },
    mirror: { pred: mr_pred, reason: mr_reason, weight: 2.4, ...mr_meta },
  };

  // 4. Regime-Specific High-Priority Locks
  if (dr_pred !== null && (dr_meta.mode === 'DRAGON_RIDE' || dr_meta.mode === 'DRAGON_LOCK')) {
    return {
      period_number,
      next_period,
      final_pred: dr_pred,
      combined_reason: `${dr_reason} + ${ng_reason}`,
      confidence: 97,
      trend_lock_triggered: true,
      active_regime,
      current_level: Math.min(3, consecutive_losses + 1),
      votes: {
        BIG: dr_pred === 'BIG' ? 12.5 : 2.0,
        SMALL: dr_pred === 'SMALL' ? 12.5 : 2.0,
      },
      sub_engines: subEnginesPayload,
    };
  }

  if (
    zz_pred !== null &&
    (zz_meta.type === 'ZIGZAG_1X1' ||
      zz_meta.type === 'TWIN_2X2' ||
      zz_meta.type === 'STEP_2X1')
  ) {
    if (zz_pred === ng_pred || zz_pred === mr_pred || consecutive_losses >= 1) {
      const rStr =
        consecutive_losses >= 1
          ? `${zz_reason} + L${consecutive_losses + 1}-shield`
          : `${zz_reason} + ${ng_reason}`;
      return {
        period_number,
        next_period,
        final_pred: zz_pred,
        combined_reason: rStr,
        confidence: 96,
        trend_lock_triggered: true,
        active_regime,
        current_level: Math.min(3, consecutive_losses + 1),
        votes: {
          BIG: zz_pred === 'BIG' ? 11.8 : 2.2,
          SMALL: zz_pred === 'SMALL' ? 11.8 : 2.2,
        },
        sub_engines: subEnginesPayload,
      };
    }
  }

  // 5. Adaptive Weighted Voting
  const votes: { BIG: number; SMALL: number } = { BIG: 0.0, SMALL: 0.0 };
  const weightedLogics: Array<['BIG' | 'SMALL', number, string]> = [
    [ng_pred, 3.0 * engineAccuracyBoost.ngram, ng_reason],
    [mr_pred, 2.4 * engineAccuracyBoost.mirror, mr_reason],
    [mom_pred, 2.2 * engineAccuracyBoost.momentum, mom_reason],
    [mk_pred, 2.0 * engineAccuracyBoost.markov, mk_reason],
    [fb_pred, 1.5 * engineAccuracyBoost.freq, fb_reason],
    [p_master, 1.8 * engineAccuracyBoost.master, `master(${p_master})`],
    [p_hybrid, 1.0, 'hybrid-core'],
  ];

  if (zz_pred !== null) {
    weightedLogics.unshift([zz_pred, 3.4 * engineAccuracyBoost.zigzag, zz_reason]);
  }
  if (dr_pred !== null) {
    weightedLogics.unshift([dr_pred, 3.2 * engineAccuracyBoost.dragon, dr_reason]);
  } else if (sb_pred !== null) {
    weightedLogics.push([sb_pred, 2.0, sb_reason]);
  }

  const winningReasons: Record<'BIG' | 'SMALL', Array<[number, string]>> = {
    BIG: [],
    SMALL: [],
  };

  for (const [pred, weight, reason] of weightedLogics) {
    votes[pred] += weight;
    if (!reason.includes('fallback') && !reason.includes('hybrid-core')) {
      winningReasons[pred].push([weight, reason]);
    }
  }

  // 6. Level 2 & Level 3 Fix Recovery Shield
  if (consecutive_losses >= 1 && last_results.length >= 8) {
    const bestEngine = Object.entries(engineAccuracyBoost).sort((a, b) => b[1] - a[1])[0][0];
    const bestPred = evaluateSingleEngineOnStep(bestEngine, period_number, last_results);
    const shieldWeight = consecutive_losses === 1 ? 4.2 : 6.5;
    votes[bestPred] += shieldWeight;
    winningReasons[bestPred].unshift([
      shieldWeight,
      `L${Math.min(3, consecutive_losses + 1)}-fix(${bestEngine})`,
    ]);
  }

  const final_pred: 'BIG' | 'SMALL' =
    votes.BIG > votes.SMALL ? 'BIG' : votes.SMALL > votes.BIG ? 'SMALL' : ng_pred;

  const totalV = votes.BIG + votes.SMALL;
  const winRatio = totalV > 0 ? Math.max(votes.BIG, votes.SMALL) / totalV : 0.78;

  const sortedReasons = winningReasons[final_pred].sort((a, b) => b[0] - a[0]);
  const uniqueReasons: string[] = [];
  for (const [, r] of sortedReasons) {
    if (!uniqueReasons.includes(r)) uniqueReasons.push(r);
  }
  if (uniqueReasons.length === 0) uniqueReasons.push(ng_reason);

  const combined_reason = uniqueReasons.slice(0, 2).join(' + ');
  let confidence = Math.trunc(68 + winRatio * 31);
  confidence = Math.max(82, Math.min(99, confidence));

  votes.BIG = Math.round(votes.BIG * 10) / 10;
  votes.SMALL = Math.round(votes.SMALL * 10) / 10;

  return {
    period_number,
    next_period,
    final_pred,
    combined_reason,
    confidence,
    trend_lock_triggered: false,
    active_regime,
    current_level: Math.min(3, consecutive_losses + 1),
    votes,
    sub_engines: subEnginesPayload,
  };
}
