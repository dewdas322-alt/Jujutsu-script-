/**
 * JUJUSTU SCRIPT V3 — Exact 1:1 Core & Diablo Pattern Prediction Engine
 * Powered by @AJAYTREDERKING
 * All mathematical formulas, weights, thresholds, and ensemble rules are preserved 100% unchanged.
 */

export type BigSmall = 'BIG' | 'SMALL' | 'Unknown';

export interface HistoryLogEntry {
  period: string;
  pred: 'BIG' | 'SMALL';
  singleNumber: number; // Strictly 5..9 for BIG, 0..4 for SMALL
  actual: string; // "BIG", "SMALL", or "?"
  actualNumber?: string; // e.g., "7", "3", or "?"
  outcome: 'WIN' | 'LOSE' | 'PENDING';
  reason: string;
  confidence: number;
  stats_str: string;
  timestamp: string;
}

export function computeSameSideSingleNumber(
  telemetry: DetailedEngineTelemetry,
  predSize: 'BIG' | 'SMALL'
): number {
  const m = telemetry.sub_engines.master;
  const offset = ((m.method1 + m.method5) % 5 + 5) % 5; // 0..4
  return predSize === 'BIG' ? 5 + offset : offset; // 5..9 for BIG, 0..4 for SMALL
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
  votes: { BIG: number; SMALL: number };
  sub_engines: {
    streak_break: { pred: 'BIG' | 'SMALL' | null; reason: string; current_streak: number; streak_val: string };
    momentum: { pred: 'BIG' | 'SMALL'; reason: string; weight: number; current_streak: number };
    markov: { pred: 'BIG' | 'SMALL'; reason: string; weight: number; weighted_big: number; weighted_small: number; transitions_count: number };
    freq_balance: { pred: 'BIG' | 'SMALL'; reason: string; weight: number; big_count: number; small_count: number };
    hybrid: { pred: 'BIG' | 'SMALL'; stable_pred: 'BIG' | 'SMALL'; weight: number };
    master: MasterMethodBreakdown & { weight: number };
  };
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

// Helper for exact Python modulo on BigInt
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

  // Method 1
  const base_calc = pyMod(n * 73n - (n % 43n), 10n);
  const history_factor = ((sumAll % 10) + 10) % 10;
  const math_modifier = pyMod(n ** 2n, 9n);
  const last5 = last_ints.slice(-5);
  const statistical_mean =
    last_ints.length >= 5
      ? Math.trunc(last5.reduce((a, b) => a + b, 0) / last5.length) % 10
      : 0;
  const method1 = (base_calc + history_factor + math_modifier + statistical_mean) % 10;

  // Method 2
  const shift = pyMod(n, 7n) + (last_ints.length % 3);
  const last3 = last_ints.slice(-3);
  const trend_factor =
    (last_ints.length >= 3
      ? last3.reduce((a, b) => a + b, 0)
      : sumAll) % 10;
  const method2 = pyMod(n + BigInt(shift) + BigInt(trend_factor), 10n);

  // Method 3
  const nStr = n.toString();
  const reversedStr = nStr.split('').reverse().join('');
  const mirror = nStr.length > 1 ? pyMod(BigInt(reversedStr), 10n) : pyMod(n, 10n);
  const last4 = last_ints.slice(-4);
  const reverse_factor =
    (mirror + (last_ints.length >= 4 ? last4.reduce((a, b) => a + b, 0) : 0)) % 10;
  const method3 = pyMod(BigInt(reverse_factor) * 3n + n, 10n);

  // Method 4
  const weights = [0.2, 0.15, 0.25, 0.1, 0.3];
  let weighted_sum = 0;
  if (last_ints.length >= 5) {
    const slice5 = last_ints.slice(-5);
    weighted_sum = slice5.reduce((acc, x, idx) => acc + x * weights[idx], 0);
  } else {
    weighted_sum = sumAll * 0.5;
  }
  const method4 = Math.trunc(weighted_sum + pyMod(n, 5n)) % 10;

  // Method 5
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
  return master_calculation_prediction_core(period_number, last_results);
}

function master_calculation_prediction_core(
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

  if (chance < 0.20 && last_results.length > 0) {
    const bs = get_big_small(last_results[last_results.length - 1]);
    base = bs === 'BIG' ? 'BIG' : 'SMALL';
  } else if (chance < 0.60) {
    base = Math.random() < 0.5 ? 'BIG' : 'SMALL';
  } else if (chance < 0.70) {
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
// 🚀 NEW ADVANCED LOGICS (Diablo Pattern AI Engine)
// ==================================================
export function markov_chain_decay(
  last_results: (number | string)[]
): ['BIG' | 'SMALL', string, { weighted_big: number; weighted_small: number; transitions_count: number }] {
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
// 🥋 DIABLO PREMIUM ENSEMBLE PREDICTOR (UNCHANGED)
// ==================================================
export function diablo_premium_predictor(
  period_number: string,
  last_results: (number | string)[],
  prev_prediction: 'BIG' | 'SMALL' | null
): ['BIG' | 'SMALL', string, number] {
  const telemetry = diablo_detailed_telemetry(period_number, last_results, prev_prediction);
  return [telemetry.final_pred, telemetry.combined_reason, telemetry.confidence];
}

export function diablo_detailed_telemetry(
  period_number: string,
  last_results: (number | string)[],
  prev_prediction: 'BIG' | 'SMALL' | null
): DetailedEngineTelemetry {
  // 1. Gather predictions
  const [sb_pred, sb_reason, sb_meta] = streak_break_prediction(last_results);
  const [mom_pred, mom_reason, mom_meta] = momentum_prediction(last_results);
  const [mk_pred, mk_reason, mk_meta] = markov_chain_decay(last_results);
  const [fb_pred, fb_reason, fb_meta] = freq_balance_prediction(last_results);

  const p_hybrid = hybrid_prediction(period_number, last_results, prev_prediction);
  const stable_pred = stable_logic_prediction(period_number, last_results, prev_prediction);
  const master_breakdown = master_calculation_breakdown(period_number, last_results);
  const p_master = master_breakdown.final_prediction;

  const cleanDigits = String(period_number).replace(/\D/g, '') || '0';
  const next_period = (BigInt(cleanDigits) + 1n).toString();

  // 2. High Priority Trend Lock (Prevents Loss Streaks)
  if (sb_pred !== null) {
    let reasonOut = sb_reason;
    let confOut = 85;
    if (sb_pred === mk_pred) {
      reasonOut = `${sb_reason} + ${mk_reason}`;
      confOut = 92;
    } else if (sb_pred === mom_pred) {
      reasonOut = `${sb_reason} + ${mom_reason}`;
      confOut = 88;
    }
    return {
      period_number,
      next_period,
      final_pred: sb_pred,
      combined_reason: reasonOut,
      confidence: confOut,
      trend_lock_triggered: true,
      votes: {
        BIG: sb_pred === 'BIG' ? 8.0 : 0.0,
        SMALL: sb_pred === 'SMALL' ? 8.0 : 0.0,
      },
      sub_engines: {
        streak_break: { pred: sb_pred, reason: sb_reason, ...sb_meta },
        momentum: { pred: mom_pred, reason: mom_reason, weight: 2.5, ...mom_meta },
        markov: { pred: mk_pred, reason: mk_reason, weight: 2.0, ...mk_meta },
        freq_balance: { pred: fb_pred, reason: fb_reason, weight: 1.5, ...fb_meta },
        hybrid: { pred: p_hybrid, stable_pred, weight: 1.0 },
        master: { ...master_breakdown, weight: 1.0 },
      },
    };
  }

  // 3. Weighted Voting for Normal Conditions
  const votes: { BIG: number; SMALL: number } = { BIG: 0.0, SMALL: 0.0 };

  const weighted_logics: Array<['BIG' | 'SMALL', number, string]> = [
    [mom_pred, 2.5, mom_reason], // Highest weight for momentum
    [mk_pred, 2.0, mk_reason], // High weight for Markov pattern
    [fb_pred, 1.5, fb_reason], // Medium weight for frequency balance
    [p_hybrid, 1.0, 'fallback-hybrid'], // Base weight for old logic
    [p_master, 1.0, 'fallback-master'], // Base weight for old logic
  ];

  const reasons: string[] = [];
  for (const [pred, weight, reason] of weighted_logics) {
    votes[pred] += weight;
    reasons.push(reason);
  }

  // 4. Final Decision
  let final_pred: 'BIG' | 'SMALL';
  let win_prob: number;
  if (votes.BIG > votes.SMALL) {
    final_pred = 'BIG';
    win_prob = votes.BIG;
  } else if (votes.SMALL > votes.BIG) {
    final_pred = 'SMALL';
    win_prob = votes.SMALL;
  } else {
    final_pred = mom_pred; // Tie breaker
    win_prob = 0.5;
  }

  // 5. Format Reason String
  const unique_reasons: string[] = [];
  for (const r of reasons) {
    if (!unique_reasons.includes(r) && !r.includes('fallback')) {
      unique_reasons.push(r);
    }
  }
  if (unique_reasons.length === 0) {
    unique_reasons.push('fallback');
  }

  const combined_reason = unique_reasons.slice(0, 2).join(' + ');

  // 6. Dynamic Confidence Calculation
  let confidence = Math.trunc(50 + win_prob * 15);
  confidence = Math.max(60, Math.min(99, confidence));

  return {
    period_number,
    next_period,
    final_pred,
    combined_reason,
    confidence,
    trend_lock_triggered: false,
    votes,
    sub_engines: {
      streak_break: { pred: sb_pred, reason: sb_reason, ...sb_meta },
      momentum: { pred: mom_pred, reason: mom_reason, weight: 2.5, ...mom_meta },
      markov: { pred: mk_pred, reason: mk_reason, weight: 2.0, ...mk_meta },
      freq_balance: { pred: fb_pred, reason: fb_reason, weight: 1.5, ...fb_meta },
      hybrid: { pred: p_hybrid, stable_pred, weight: 1.0 },
      master: { ...master_breakdown, weight: 1.0 },
    },
  };
}
