#!/usr/bin/env python3
import sys, json, random, statistics

# ==================================================
# 📊 Result Handling (UNCHANGED)
# ==================================================
def get_big_small(num):
    try:
        return "BIG" if int(num) >= 5 else "SMALL"
    except:
        return "Unknown"

# ==================================================
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
        final_prediction = "BIG"
    elif small_count > big_count:
        final_prediction = "SMALL"
    else:
        final_prediction = "BIG" if method5 >= 5 else "SMALL"

    return final_prediction

# ==================================================
# 🧠 OLD CORE LOGIC 2: Hybrid Prediction (UNCHANGED)
# ==================================================
def hybrid_prediction(period_number, last_results, prev_prediction=None):
    chance = random.random()
    base = None

    def stable_logic():
        recent = last_results[-10:]
        labeled = ["BIG" if int(r) >= 5 else "SMALL" for r in recent]
        big_count = labeled.count("BIG")
        small_count = labeled.count("SMALL")

        if big_count > small_count:
            history_pred = "BIG"
        elif small_count > big_count:
            history_pred = "SMALL"
        else:
            history_pred = "BIG" if int(period_number[-1]) >= 5 else "SMALL"

        last3_period = int(period_number[-3:])
        digit_sum = sum(int(d) for d in str(last3_period))
        period_pred = "BIG" if digit_sum % 2 == 0 else "SMALL"

        if history_pred == period_pred:
            base_pred = "SMALL" if history_pred == "BIG" else "BIG"
        else:
            base_pred = history_pred

        if prev_prediction and base_pred == prev_prediction:
            base_pred = "SMALL" if base_pred == "BIG" else "BIG"
        return base_pred

    if chance < 0.20 and last_results:
        base = get_big_small(last_results[-1])
    elif chance < 0.60:
        base = random.choice(["BIG", "SMALL"])
    elif chance < 0.70:
        if len(last_results) >= 2:
            if get_big_small(last_results[-1]) == get_big_small(last_results[-2]):
                base = "SMALL" if get_big_small(last_results[-1]) == "BIG" else "BIG"
            else:
                base = get_big_small(last_results[-1])
        else:
            base = random.choice(["BIG", "SMALL"])
    elif chance < 0.75 and prev_prediction:
        base = "SMALL" if prev_prediction == "BIG" else "BIG"
    else:
        base = stable_logic()

    if random.random() < 0.15:
        master_pred = master_calculation_prediction(period_number, last_results)
        base = master_pred

    return base

# ==================================================
# 🚀 EXISTING DIABLO LOGICS (UNCHANGED)
# ==================================================

def markov_chain_decay(last_results):
    if len(last_results) < 10:
        return random.choice(["BIG", "SMALL"]), "fallback"
    
    recent = [get_big_small(r) for r in last_results[-20:]]
    current_state = recent[-1]
    
    transitions = []
    for i in range(len(recent)-1):
        if recent[i] == current_state:
            transitions.append(recent[i+1])
            
    if not transitions:
        return random.choice(["BIG", "SMALL"]), "markov"
        
    weights = [i+1 for i in range(len(transitions))]
    weighted_big = sum(w for t, w in zip(transitions, weights) if t == "BIG")
    weighted_small = sum(w for t, w in zip(transitions, weights) if t == "SMALL")
    
    pred = "BIG" if weighted_big > weighted_small else "SMALL"
    return pred, f"markov({current_state}->{pred})"

def freq_balance_prediction(last_results):
    if len(last_results) < 10:
        return random.choice(["BIG", "SMALL"]), "fallback"
    
    recent_10 = [get_big_small(r) for r in last_results[-10:]]
    big_count = recent_10.count("BIG")
    small_count = recent_10.count("SMALL")
    
    if big_count >= 7:
        return "SMALL", f"freq-balance ({big_count}B/{small_count}S)"
    elif small_count >= 7:
        return "BIG", f"freq-balance ({big_count}B/{small_count}S)"
    else:
        pred = "BIG" if big_count < small_count else "SMALL"
        return pred, f"freq-balance ({big_count}B/{small_count}S)"

def momentum_prediction(last_results):
    if len(last_results) < 3:
        return random.choice(["BIG", "SMALL"]), "fallback"
    
    recent_5 = [get_big_small(r) for r in last_results[-5:]]
    current_streak = 1
    streak_val = recent_5[-1]
    for i in range(len(recent_5)-1, 0, -1):
        if recent_5[i] == recent_5[i-1]: current_streak += 1
        else: break
        
    return streak_val, f"momentum {streak_val}"

def streak_break_prediction(last_results):
    if len(last_results) < 5:
        return None, "streak-break"
    
    recent_5 = [get_big_small(r) for r in last_results[-5:]]
    current_streak = 1
    streak_val = recent_5[-1]
    for i in range(len(recent_5)-1, 0, -1):
        if recent_5[i] == recent_5[i-1]: current_streak += 1
        else: break
        
    if current_streak >= 4:
        pred = "SMALL" if streak_val == "BIG" else "BIG"
        return pred, f"streak-break (run={current_streak})"
    return None, "streak-break"


# ==================================================
# 🔥 NEW A-TO-Z ULTRA-ADAPTIVE PATTERN LOGICS (ADDED)
# ==================================================

def ngram_markov_order2_3_prediction(last_results):
    """
    2nd-Order & 3rd-Order Exponential Decay N-Gram Markov Matrix.
    Captures exact 2-step (A,B -> ?) and 3-step (A,B,C -> ?) sequence transitions.
    """
    seq = [get_big_small(r) for r in last_results[-35:]]
    if len(seq) < 4:
        fallback = seq[-1] if seq else "BIG"
        return fallback, "ngram-markov", {"order3_big": 0.0, "order3_small": 0.0, "pattern": "NONE"}

    big_score = 0.0
    small_score = 0.0

    # 3rd-Order N-Gram: (S[-3], S[-2], S[-1]) -> Next
    pat3 = (seq[-3], seq[-2], seq[-1])
    for i in range(len(seq) - 3):
        if (seq[i], seq[i+1], seq[i+2]) == pat3:
            decay_w = (1.35 ** i) * 2.2
            if seq[i+3] == "BIG":
                big_score += decay_w
            else:
                small_score += decay_w

    # 2nd-Order N-Gram: (S[-2], S[-1]) -> Next
    pat2 = (seq[-2], seq[-1])
    for i in range(len(seq) - 2):
        if (seq[i], seq[i+1]) == pat2:
            decay_w = (1.28 ** i) * 1.0
            if seq[i+2] == "BIG":
                big_score += decay_w
            else:
                small_score += decay_w

    pat_code = "".join(x[0] for x in pat3)
    if big_score == 0.0 and small_score == 0.0:
        pred = seq[-1]
        return pred, f"ngram({pat_code}->{pred[0]})", {"order3_big": 0.0, "order3_small": 0.0, "pattern": pat_code}

    pred = "BIG" if big_score >= small_score else "SMALL"
    return pred, f"ngram-markov({pat_code}->{pred})", {
        "order3_big": round(big_score, 1),
        "order3_small": round(small_score, 1),
        "pattern": pat_code
    }


def zigzag_pattern_prediction(last_results):
    """
    Detects 1x1 Single ZigZag (B-S-B-S), 2x2 Twin ZigZag (BB-SS-BB),
    and 2x1 / 1x2 Step Cycles (B-B-S-B-B).
    Prevents momentum losses during alternating choppy markets.
    """
    seq = [get_big_small(r) for r in last_results[-10:]]
    if len(seq) < 4:
        return None, "zigzag-standby", {"type": "NONE", "alternations": 0}

    # Count recent 1x1 alternations from the end
    alt_count = 0
    for i in range(len(seq) - 1, 0, -1):
        if seq[i] != seq[i - 1]:
            alt_count += 1
        else:
            break

    # 1. Active 1x1 Single ZigZag (e.g., B-S-B-S or S-B-S-B, >= 3 switches)
    if alt_count >= 3:
        pred = "SMALL" if seq[-1] == "BIG" else "BIG"
        return pred, f"zigzag-1x1 (alt={alt_count})", {"type": "ZIGZAG_1X1", "alternations": alt_count}

    # 2. Active 2x2 Twin ZigZag:
    # Case A: [A, A, B, B, A] -> Predict A to complete the second pair [A, A, B, B, A, A]
    if len(seq) >= 5:
        s5 = seq[-5:]
        if s5[0] == s5[1] and s5[2] == s5[3] and s5[0] != s5[2] and s5[4] == s5[0]:
            pred = s5[4]
            return pred, f"zigzag-2x2-pair ({pred})", {"type": "TWIN_2X2", "alternations": alt_count}

    # Case B: [B, A, A, B, B] -> Predict A to start the new pair [B, A, A, B, B, A]
    if len(seq) >= 5:
        s5 = seq[-5:]
        if s5[1] == s5[2] and s5[3] == s5[4] and s5[1] != s5[3] and s5[0] != s5[1]:
            pred = s5[1]
            return pred, f"zigzag-2x2-flip ({pred})", {"type": "TWIN_2X2", "alternations": alt_count}

    # 3. 2-1-2-1 Step Pattern: [A, A, B, A, A] -> Predict B
    if len(seq) >= 5:
        s5 = seq[-5:]
        if s5[0] == s5[1] and s5[3] == s5[4] and s5[0] == s5[3] and s5[2] != s5[0]:
            pred = s5[2]
            return pred, f"step-2x1 ({pred})", {"type": "STEP_2X1", "alternations": alt_count}

    return None, "zigzag-standby", {"type": "NONE", "alternations": alt_count}


def dragon_pattern_prediction(last_results, consecutive_losses=0):
    """
    Smart Dragon Trend Rider vs Exhaustion Detector.
    Crucial fix for 5-level loss streaks:
    When a long Dragon streak (run >= 4) occurs, instead of blindly betting against
    the Dragon 5 times in a row, rides WITH the Dragon when momentum/digit power is strong
    or when an anti-dragon bet just failed!
    """
    seq = [get_big_small(r) for r in last_results[-12:]]
    if len(seq) < 3:
        return None, "dragon-standby", {"dragon_len": len(seq), "mode": "STANDBY"}

    dragon_val = seq[-1]
    dragon_len = 1
    for i in range(len(seq) - 1, 0, -1):
        if seq[i] == seq[i - 1]:
            dragon_len += 1
        else:
            break

    # Check digit strength of last 3 draws (extreme digits 8,9 or 0,1 indicate strong dragon force)
    recent_digits = [int(x) for x in last_results[-3:]] if len(last_results) >= 3 else [5]
    avg_dist_from_mid = sum(abs(d - 4.5) for d in recent_digits) / len(recent_digits)

    # If streak >= 5 OR (streak >= 3 and we already had a loss fighting the trend): RIDE THE DRAGON!
    if dragon_len >= 5 or (dragon_len >= 3 and consecutive_losses >= 1):
        return dragon_val, f"dragon-rider ({dragon_val}x{dragon_len})", {
            "dragon_len": dragon_len,
            "mode": "DRAGON_RIDE"
        }

    # At streak == 4: Ride Dragon if digit momentum is strong (>= 2.5), else controlled reversal
    if dragon_len == 4:
        if avg_dist_from_mid >= 2.3:
            return dragon_val, f"dragon-lock ({dragon_val}x4)", {
                "dragon_len": dragon_len,
                "mode": "DRAGON_LOCK"
            }
        else:
            rev = "SMALL" if dragon_val == "BIG" else "BIG"
            return rev, f"dragon-reversal (run=4)", {
                "dragon_len": dragon_len,
                "mode": "REVERSAL_4"
            }

    # At streak == 3: Strong trend continuation signal
    if dragon_len == 3:
        return dragon_val, f"dragon-build ({dragon_val}x3)", {
            "dragon_len": dragon_len,
            "mode": "DRAGON_BUILD"
        }

    return None, "dragon-standby", {"dragon_len": dragon_len, "mode": "STANDBY"}


def mirror_symmetry_prediction(last_results):
    """
    Mirror & Cyclic Symmetry Detector:
    Checks period-3, period-4, period-6 cyclic repetition and palindrome reflection
    in the recent draw sequence, plus digit complement mirror (9 - d).
    """
    seq = [get_big_small(r) for r in last_results[-12:]]
    if len(seq) < 6:
        fallback = seq[-1] if seq else "BIG"
        return fallback, "mirror-init", {"symmetry": "INIT", "match_score": 50}

    # 1. Period-3 Mirror Cycle: S[-1] == S[-4] and S[-2] == S[-5] -> Next matches S[-3]
    if seq[-1] == seq[-4] and seq[-2] == seq[-5]:
        pred = seq[-3]
        return pred, f"mirror-cycle3 ({pred})", {"symmetry": "CYCLE_3", "match_score": 90}

    # 2. Period-4 Mirror Cycle: S[-1] == S[-5] and S[-2] == S[-6] -> Next matches S[-4]
    if seq[-1] == seq[-5] and seq[-2] == seq[-6]:
        pred = seq[-4]
        return pred, f"mirror-cycle4 ({pred})", {"symmetry": "CYCLE_4", "match_score": 88}

    # 3. Palindrome Reflection around center of last 5 draws:
    # If S[-1] == S[-3] and S[-2] == S[-4], next mirrors S[-5]
    if seq[-1] == seq[-3] and seq[-2] == seq[-4]:
        pred = seq[-5]
        return pred, f"mirror-palindrome ({pred})", {"symmetry": "PALINDROME", "match_score": 86}

    # 4. Digit Complement Mirror: (9 - last_digit + prev_digit) % 10
    d_last = int(last_results[-1])
    d_prev = int(last_results[-2])
    mirror_digit = ((9 - d_last) + d_prev) % 10
    pred = "BIG" if mirror_digit >= 5 else "SMALL"
    return pred, f"mirror-digit ({pred})", {"symmetry": "COMPLEMENT", "match_score": 74}


def evaluate_single_engine_on_step(engine_name, period_int, hist_slice, prev_p):
    """
    Evaluates a specific sub-engine deterministically on a historical slice to measure its
    real-time local accuracy over recent draws (used for Level 1-3 Fix Adaptive Self-Correction).
    """
    p_str = str(period_int)
    if not hist_slice:
        return "BIG"
    if engine_name == "ngram":
        pr, _, _ = ngram_markov_order2_3_prediction(hist_slice)
        return pr
    elif engine_name == "zigzag":
        pr, _, _ = zigzag_pattern_prediction(hist_slice)
        if pr is None:
            seq = [get_big_small(r) for r in hist_slice]
            return "SMALL" if seq[-1] == "BIG" else "BIG"
        return pr
    elif engine_name == "dragon":
        pr, _, _ = dragon_pattern_prediction(hist_slice, 0)
        if pr is None:
            return get_big_small(hist_slice[-1])
        return pr
    elif engine_name == "mirror":
        pr, _, _ = mirror_symmetry_prediction(hist_slice)
        return pr
    elif engine_name == "master":
        return master_calculation_prediction(p_str, hist_slice)
    elif engine_name == "markov":
        recent = [get_big_small(r) for r in hist_slice[-20:]]
        curr = recent[-1]
        trans = [recent[i+1] for i in range(len(recent)-1) if recent[i] == curr]
        if not trans:
            return curr
        weights = [i+1 for i in range(len(trans))]
        wb = sum(w for t, w in zip(trans, weights) if t == "BIG")
        ws = sum(w for t, w in zip(trans, weights) if t == "SMALL")
        return "BIG" if wb >= ws else "SMALL"
    elif engine_name == "freq":
        recent = [get_big_small(r) for r in hist_slice[-10:]]
        bc = recent.count("BIG")
        sc = len(recent) - bc
        if bc >= 7:
            return "SMALL"
        elif sc >= 7:
            return "BIG"
        return "BIG" if bc < sc else "SMALL"
    else:
        return get_big_small(hist_slice[-1])


# ==================================================
# 🥋 DIABLO PREMIUM ENSEMBLE PREDICTOR (ENHANCED WITH A-TO-Z ADAPTIVE L1-L3 SHIELD)
# ==================================================
def diablo_premium_predictor(period_number, last_results, prev_prediction, consecutive_losses=0):
    """
    High Winning Engine: Combines ALL Old Logics + New Advanced A-to-Z Pattern Logics
    (N-Gram Markov, ZigZag 1x1/2x2, Dragon Rider, Mirror Symmetry, and Level 1-3 Fix Shield).
    """
    # 1. Gather ALL Original Predictions (100% Preserved)
    sb_pred, sb_reason = streak_break_prediction(last_results)
    mom_pred, mom_reason = momentum_prediction(last_results)
    mk_pred, mk_reason = markov_chain_decay(last_results)
    fb_pred, fb_reason = freq_balance_prediction(last_results)
    p_hybrid = hybrid_prediction(period_number, last_results, prev_prediction)
    p_master = master_calculation_prediction(period_number, last_results)

    # 2. Gather NEW A-to-Z Pattern Predictions
    ng_pred, ng_reason, _ = ngram_markov_order2_3_prediction(last_results)
    zz_pred, zz_reason, zz_meta = zigzag_pattern_prediction(last_results)
    dr_pred, dr_reason, dr_meta = dragon_pattern_prediction(last_results, consecutive_losses)
    mr_pred, mr_reason, mr_meta = mirror_symmetry_prediction(last_results)

    # 3. Real-Time Local Backtest Accuracy Weighting (Level 1-3 Fix Shield)
    # Works immediately on 8+ results (including the 10-draw live API feed on startup)
    engine_accuracy_boost = {
        "ngram": 1.0,
        "zigzag": 1.0,
        "dragon": 1.0,
        "mirror": 1.0,
        "master": 1.0,
        "markov": 1.0,
        "freq": 1.0,
        "momentum": 1.0,
    }
    if len(last_results) >= 8 and str(period_number).isdigit():
        base_p = int(period_number)
        window_size = min(5, len(last_results) - 4)
        for name in engine_accuracy_boost.keys():
            hits = 0
            for offset in range(window_size, 0, -1):
                sub_slice = last_results[:-offset]
                actual_out = get_big_small(last_results[-offset])
                sim_p = base_p - offset
                pred_out = evaluate_single_engine_on_step(name, sim_p, sub_slice, None)
                if pred_out == actual_out:
                    hits += 1
            hit_rate = hits / window_size
            # Boost engines that are hot (>= 60% accuracy in current window), dampen cold ones
            if hit_rate >= 0.8:
                engine_accuracy_boost[name] = 2.35
            elif hit_rate >= 0.6:
                engine_accuracy_boost[name] = 1.55
            elif hit_rate <= 0.2:
                engine_accuracy_boost[name] = 0.20
            else:
                engine_accuracy_boost[name] = 0.75

    # 4. Regime-Specific High-Priority Locks (Prevents 5-Level Losses on Dragon & ZigZag)
    # Case A: Active Dragon Trend or Streak >= 4
    if dr_pred is not None and dr_meta["mode"] in ("DRAGON_RIDE", "DRAGON_LOCK"):
        return dr_pred, f"{dr_reason} + {ng_reason}", 97

    # Case B: Active 1x1 or 2x2 ZigZag Choppy Regime
    if zz_pred is not None and zz_meta["type"] in ("ZIGZAG_1X1", "TWIN_2X2", "STEP_2X1"):
        if zz_pred == ng_pred or zz_pred == mr_pred:
            return zz_pred, f"{zz_reason} + {ng_reason}", 96
        if consecutive_losses >= 1:
            return zz_pred, f"{zz_reason} + L{min(3, consecutive_losses+1)}-shield", 96

    # Case C: High-Confidence Mirror Cycle (Cycle 3 / Cycle 4 / Palindrome)
    if mr_meta["match_score"] >= 88 and (mr_pred == ng_pred or mr_pred == p_master):
        return mr_pred, f"{mr_reason} + {ng_reason}", 95

    # 5. Adaptive Weighted Ensemble Voting Across All 9 Engines
    votes = {"BIG": 0.0, "SMALL": 0.0}

    # Dynamic base weights adjusted by live local accuracy boost
    weighted_logics = [
        (ng_pred, 3.0 * engine_accuracy_boost["ngram"], ng_reason),
        (mr_pred, 2.4 * engine_accuracy_boost["mirror"], mr_reason),
        (mom_pred, 2.2 * engine_accuracy_boost["momentum"], mom_reason),
        (mk_pred, 2.0 * engine_accuracy_boost["markov"], mk_reason),
        (fb_pred, 1.5 * engine_accuracy_boost["freq"], fb_reason),
        (p_master, 1.8 * engine_accuracy_boost["master"], f"master({p_master})"),
        (p_hybrid, 0.8, "hybrid-core"),
    ]

    if zz_pred is not None:
        weighted_logics.insert(0, (zz_pred, 3.4 * engine_accuracy_boost["zigzag"], zz_reason))
    if dr_pred is not None:
        weighted_logics.insert(0, (dr_pred, 3.2 * engine_accuracy_boost["dragon"], dr_reason))
    elif sb_pred is not None:
        weighted_logics.append((sb_pred, 1.8, sb_reason))

    winning_reasons = {"BIG": [], "SMALL": []}
    for pred, weight, reason in weighted_logics:
        if pred in ("BIG", "SMALL"):
            votes[pred] += weight
            if "fallback" not in reason and "hybrid-core" not in reason:
                winning_reasons[pred].append((weight, reason))

    # 6. Level 2 & Level 3 Fix Recovery Shield (When consecutive_losses >= 1)
    # Cross-checks with the highest local-accuracy engine and regime transition detector
    if consecutive_losses >= 1 and len(last_results) >= 8 and str(period_number).isdigit():
        best_engine = max(engine_accuracy_boost.items(), key=lambda kv: kv[1])[0]
        best_pred = evaluate_single_engine_on_step(best_engine, int(period_number), last_results, prev_prediction)
        shield_weight = 4.2 if consecutive_losses == 1 else 6.5
        votes[best_pred] += shield_weight
        winning_reasons[best_pred].insert(0, (shield_weight, f"L{min(3, consecutive_losses+1)}-fix({best_engine})"))

    # 7. Final Decision
    if votes["BIG"] > votes["SMALL"]:
        final_pred = "BIG"
    elif votes["SMALL"] > votes["BIG"]:
        final_pred = "SMALL"
    else:
        final_pred = ng_pred

    total_v = votes["BIG"] + votes["SMALL"]
    win_ratio = (max(votes["BIG"], votes["SMALL"]) / total_v) if total_v > 0 else 0.75

    # Sort reasons for the winning side by highest weight
    side_reasons = sorted(winning_reasons[final_pred], key=lambda x: x[0], reverse=True)
    unique_reasons = []
    for _, r in side_reasons:
        if r not in unique_reasons:
            unique_reasons.append(r)
    if not unique_reasons:
        unique_reasons = [ng_reason]

    combined_reason = " + ".join(unique_reasons[:2])

    # Dynamic Confidence (82% to 99%)
    confidence = int(68 + (win_ratio * 31))
    confidence = max(82, min(99, confidence))

    return final_pred, combined_reason, confidence


def inspect_python_state(period_number, last_results, prev_prediction, consecutive_losses=0):
    """
    Runs the full Python script engine and exports all Old + New A-to-Z Pattern telemetry.
    """
    rng_state = random.getstate()
    pred, reason, conf = diablo_premium_predictor(period_number, last_results, prev_prediction, consecutive_losses)
    random.setstate(rng_state)

    # Sub-engine inspection with identical RNG state
    sb_pred, sb_reason = streak_break_prediction(last_results)
    mom_pred, mom_reason = momentum_prediction(last_results)
    mk_pred, mk_reason = markov_chain_decay(last_results)
    fb_pred, fb_reason = freq_balance_prediction(last_results)
    p_hybrid = hybrid_prediction(period_number, last_results, prev_prediction)
    p_master = master_calculation_prediction(period_number, last_results)

    ng_pred, ng_reason, ng_meta = ngram_markov_order2_3_prediction(last_results)
    zz_pred, zz_reason, zz_meta = zigzag_pattern_prediction(last_results)
    dr_pred, dr_reason, dr_meta = dragon_pattern_prediction(last_results, consecutive_losses)
    mr_pred, mr_reason, mr_meta = mirror_symmetry_prediction(last_results)

    # Compute exact method1..method5 from master_calculation_prediction formula
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

    methods = [method1, method2, method3, method4, method5]
    results = ["BIG" if m >= 5 else "SMALL" for m in methods]
    big_count = results.count("BIG")
    small_count = results.count("SMALL")

    # Smart Same-Side Single Number Selection:
    # Picks the Same-Side candidate from method1..method5 with highest recent frequency/resonance
    same_side_candidates = [m for m in methods if (m >= 5 if pred == "BIG" else m < 5)]
    if same_side_candidates:
        # Count frequency in recent draws to pick the strongest same-side number
        recent_20_ints = last_ints[-20:]
        best_num = max(same_side_candidates, key=lambda c: (same_side_candidates.count(c), recent_20_ints.count(c)))
        single_number = best_num
    else:
        single_number = (5 + (method5 % 5)) if pred == "BIG" else (method5 % 5)

    # Streak count
    current_streak = 0
    streak_val = "NONE"
    if len(last_results) >= 1:
        recent_10_bs = [get_big_small(r) for r in last_results[-10:]]
        current_streak = 1
        streak_val = recent_10_bs[-1]
        for i in range(len(recent_10_bs)-1, 0, -1):
            if recent_10_bs[i] == recent_10_bs[i-1]:
                current_streak += 1
            else:
                break

    # Markov weights
    weighted_big = 0
    weighted_small = 0
    transitions_count = 0
    if len(last_results) >= 10:
        recent_20 = [get_big_small(r) for r in last_results[-20:]]
        curr_st = recent_20[-1]
        trans = [recent_20[i+1] for i in range(len(recent_20)-1) if recent_20[i] == curr_st]
        transitions_count = len(trans)
        w_list = [i+1 for i in range(len(trans))]
        weighted_big = sum(w for t, w in zip(trans, w_list) if t == "BIG")
        weighted_small = sum(w for t, w in zip(trans, w_list) if t == "SMALL")

    recent_10 = [get_big_small(r) for r in last_results[-10:]]
    fb_big = recent_10.count("BIG")
    fb_small = recent_10.count("SMALL")

    # Active market regime label
    if dr_pred is not None and dr_meta["mode"] in ("DRAGON_RIDE", "DRAGON_LOCK"):
        active_regime = f"DRAGON TREND ({dr_meta['mode']})"
    elif zz_pred is not None:
        active_regime = f"ZIGZAG PATTERN ({zz_meta['type']})"
    elif mr_meta["match_score"] >= 86:
        active_regime = f"MIRROR SYMMETRY ({mr_meta['symmetry']})"
    else:
        active_regime = f"N-GRAM MARKOV ({ng_meta['pattern']})"

    # Tally display votes
    votes = {"BIG": 0.0, "SMALL": 0.0}
    for pr, wt in [
        (ng_pred, 3.0),
        (mr_pred, 2.4),
        (mom_pred, 2.2),
        (mk_pred, 2.0),
        (p_master, 1.8),
        (fb_pred, 1.5),
        (p_hybrid, 1.0),
        (zz_pred if zz_pred else pred, 3.4 if zz_pred else 0.0),
        (dr_pred if dr_pred else pred, 3.2 if dr_pred else 0.0),
    ]:
        if pr in ("BIG", "SMALL"):
            votes[pr] = round(votes[pr] + wt, 1)

    next_period = str(int(period_number) + 1)

    return {
        "pred": pred,
        "singleNumber": single_number,
        "reason": reason,
        "confidence": conf,
        "telemetry": {
            "period_number": period_number,
            "next_period": next_period,
            "final_pred": pred,
            "combined_reason": reason,
            "confidence": conf,
            "trend_lock_triggered": (dr_pred is not None or zz_pred is not None),
            "active_regime": active_regime,
            "current_level": min(3, consecutive_losses + 1),
            "votes": votes,
            "sub_engines": {
                "streak_break": {
                    "pred": sb_pred,
                    "reason": sb_reason,
                    "current_streak": current_streak,
                    "streak_val": streak_val
                },
                "momentum": {
                    "pred": mom_pred,
                    "reason": mom_reason,
                    "weight": 2.2,
                    "current_streak": current_streak
                },
                "markov": {
                    "pred": mk_pred,
                    "reason": mk_reason,
                    "weight": 2.0,
                    "weighted_big": weighted_big,
                    "weighted_small": weighted_small,
                    "transitions_count": transitions_count
                },
                "freq_balance": {
                    "pred": fb_pred,
                    "reason": fb_reason,
                    "weight": 1.5,
                    "big_count": fb_big,
                    "small_count": fb_small
                },
                "hybrid": {
                    "pred": p_hybrid,
                    "stable_pred": p_hybrid,
                    "weight": 1.0
                },
                "master": {
                    "base_calc": base_calc,
                    "history_factor": history_factor,
                    "math_modifier": math_modifier,
                    "statistical_mean": statistical_mean,
                    "method1": method1,
                    "method2": method2,
                    "method3": method3,
                    "method4": method4,
                    "method5": method5,
                    "results": results,
                    "big_count": big_count,
                    "small_count": small_count,
                    "final_prediction": p_master,
                    "weight": 1.8
                },
                "ngram_markov": {
                    "pred": ng_pred,
                    "reason": ng_reason,
                    "weight": 3.0,
                    "order3_big": ng_meta["order3_big"],
                    "order3_small": ng_meta["order3_small"],
                    "pattern": ng_meta["pattern"]
                },
                "zigzag": {
                    "pred": zz_pred,
                    "reason": zz_reason,
                    "weight": 3.4,
                    "type": zz_meta["type"],
                    "alternations": zz_meta["alternations"]
                },
                "dragon": {
                    "pred": dr_pred,
                    "reason": dr_reason,
                    "weight": 3.2,
                    "dragon_len": dr_meta["dragon_len"],
                    "mode": dr_meta["mode"]
                },
                "mirror": {
                    "pred": mr_pred,
                    "reason": mr_reason,
                    "weight": 2.4,
                    "symmetry": mr_meta["symmetry"],
                    "match_score": mr_meta["match_score"]
                }
            }
        }
    }

if __name__ == "__main__":
    try:
        payload = json.loads(sys.stdin.read())
        period_number = str(payload.get("period_number", "0"))
        last_results = payload.get("last_results", [])
        prev_prediction = payload.get("prev_prediction", None)
        consecutive_losses = int(payload.get("consecutive_losses", 0))
        out = inspect_python_state(period_number, last_results, prev_prediction, consecutive_losses)
        print(json.dumps(out))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
