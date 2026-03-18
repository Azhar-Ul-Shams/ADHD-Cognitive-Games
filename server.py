"""
server.py  –  X-PhenoADHD data pipeline backend
Run:  python server.py
Saves: adhd_assessment_data.csv  (appended, never overwritten)
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import json, csv, os, math
from datetime import datetime

# ── 1. App Initialization (This is what was missing!) ──
app  = Flask(__name__)
CORS(app)

DATA_FILE = 'adhd_assessment_data.csv'

HEADERS = [
    # Participant metadata
    'UserID', 'Timestamp', 'Name', 'Age', 'Sex', 'ADHD_SelfReport',
    'State_Sleepiness', 'State_Feeling', 'State_Mood',
    # Go / No-Go
    'GNG_TotalGoTrials', 'GNG_TotalNoGoTrials', 'GNG_TotalGoHits',
    'GNG_CommissionErrors', 'GNG_OmissionErrors',
    'GNG_CommissionRate', 'GNG_OmissionRate',
    'GNG_AvgRT_ms', 'GNG_MedianRT_ms', 'GNG_RTV_ms', 'GNG_TemporalDriftIdx',
    'GNG_B1_AvgRT', 'GNG_B1_RTV', 'GNG_B1_CE', 'GNG_B1_OE',
    'GNG_B2_AvgRT', 'GNG_B2_RTV', 'GNG_B2_CE', 'GNG_B2_OE',
    'GNG_B3_AvgRT', 'GNG_B3_RTV', 'GNG_B3_CE', 'GNG_B3_OE',
    # PVT
    'PVT_AvgRT_ms', 'PVT_MedianRT_ms', 'PVT_RTV_ms', 'PVT_Lapses',
    'PVT_FalseStarts', 'PVT_ValidAttempts', 'PVT_TemporalDriftIdx',
    'PVT_B1_AvgRT', 'PVT_B1_RTV', 'PVT_B1_Lapses',
    'PVT_B2_AvgRT', 'PVT_B2_RTV', 'PVT_B2_Lapses',
    'PVT_B3_AvgRT', 'PVT_B3_RTV', 'PVT_B3_Lapses',
    # Trail Making
    'Trail_PartA_Time_s', 'Trail_PartB_Time_s', 'Trail_BA_Ratio',
    'Trail_TotalCorrect', 'Trail_TotalWrong',
    # Dual N-Back
    'DNB_0Back_Hits', 'DNB_0Back_Misses', 'DNB_0Back_FA', 'DNB_0Back_AvgRT',
    'DNB_1Back_Hits', 'DNB_1Back_Misses', 'DNB_1Back_FA', 'DNB_1Back_AvgRT',
    'DNB_2Back_Hits', 'DNB_2Back_Misses', 'DNB_2Back_FA', 'DNB_2Back_AvgRT',
    'DNB_3Back_Hits', 'DNB_3Back_Misses', 'DNB_3Back_FA', 'DNB_3Back_AvgRT',
    'DNB_WM_LoadIndex',
    # Raw backups
    'GNG_RawRTs_JSON', 'PVT_RawRTs_JSON', 'DNB_RawJSON',
]

def _compute_median(values):
    """Return median of a list of numbers, or '' if empty."""
    if not values:
        return ''
    try:
        vals = sorted(float(v) for v in values if v is not None)
        if not vals:
            return ''
        n   = len(vals)
        mid = n // 2
        return int(vals[mid]) if n % 2 != 0 else round((vals[mid - 1] + vals[mid]) / 2)
    except (TypeError, ValueError):
        return ''


def init_csv():
    """
    Ensure DATA_FILE exists with exactly the columns in HEADERS.

    If the file is absent              → create fresh with header row.
    If the file has correct headers    → nothing to do.
    If the file has stale/wrong headers →
        1. Back up the old file as  <name>_backup_<timestamp>.csv
        2. Migrate every existing data row to the new schema:
           - Drop columns that no longer exist (e.g. FingerTapping_TotalTaps)
           - Add new columns as '' unless they can be derived:
             GNG_MedianRT_ms ← computed from GNG_RawRTs_JSON
             PVT_MedianRT_ms ← computed from PVT_RawRTs_JSON
        3. Write a fresh DATA_FILE with correct headers + migrated rows.
    """
    current_headers = list(HEADERS)

    if not os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'w', newline='') as f:
            csv.writer(f).writerow(current_headers)
        print(f"[CSV] Created {DATA_FILE} ({len(current_headers)} columns)")
        return

    # Read existing file
    with open(DATA_FILE, 'r', newline='', encoding='utf-8') as f:
        reader     = csv.reader(f)
        rows       = list(reader)

    if not rows:
        # Empty file — just write headers
        with open(DATA_FILE, 'w', newline='') as f:
            csv.writer(f).writerow(current_headers)
        print(f"[CSV] Re-initialised empty {DATA_FILE}")
        return

    existing_headers = rows[0]

    if existing_headers == current_headers:
        print(f"[CSV] Schema OK — {DATA_FILE} ({len(current_headers)} columns)")
        return

    # ── Schema mismatch ── back up, then migrate ──────────────────
    ts          = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_name = DATA_FILE.replace('.csv', f'_backup_{ts}.csv')
    import shutil
    shutil.copy2(DATA_FILE, backup_name)
    print(f"[CSV] Schema mismatch detected.")
    print(f"      Old columns : {len(existing_headers)}")
    print(f"      New columns : {len(current_headers)}")
    print(f"      Backup saved: {backup_name}")

    old_idx = {h: i for i, h in enumerate(existing_headers)}

    migrated_rows = []
    for row in rows[1:]:           # skip old header row
        new_row = []
        for col in current_headers:
            if col in old_idx:
                # Column exists in old data — carry it over
                i = old_idx[col]
                new_row.append(row[i] if i < len(row) else '')
            elif col == 'GNG_MedianRT_ms':
                # Derive from raw RT JSON if available
                raw_col = old_idx.get('GNG_RawRTs_JSON')
                raw_val = (row[raw_col] if raw_col is not None and raw_col < len(row) else '[]')
                try:
                    rts = json.loads(raw_val)
                    new_row.append(_compute_median(rts))
                except Exception:
                    new_row.append('')
            elif col == 'PVT_MedianRT_ms':
                raw_col = old_idx.get('PVT_RawRTs_JSON')
                raw_val = (row[raw_col] if raw_col is not None and raw_col < len(row) else '[]')
                try:
                    rts = json.loads(raw_val)
                    new_row.append(_compute_median(rts))
                except Exception:
                    new_row.append('')
            else:
                # New column with no source data — leave blank
                new_row.append('')
        migrated_rows.append(new_row)

    with open(DATA_FILE, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(current_headers)
        writer.writerows(migrated_rows)

    print(f"[CSV] Migration complete — {len(migrated_rows)} row(s) migrated to new schema.")
    print(f"      Dropped : {set(existing_headers) - set(current_headers)}")
    print(f"      Added   : {set(current_headers)  - set(existing_headers)}")


init_csv()


# ── 2. Safe helpers ──────────────────────────────────────────────

def num(val, default=''):
    """Return val if it's a valid number, else default."""
    if val is None or val == '':
        return default
    try:
        f = float(val)
        return int(f) if f == int(f) else round(f, 4)
    except (TypeError, ValueError):
        return default

def rate(numerator, denominator):
    """Safe division returning a rate, or '' if impossible."""
    try:
        n, d = float(numerator), float(denominator)
        return round(n / d, 4) if d != 0 else ''
    except (TypeError, ValueError):
        return ''


def median(arr):
    """Compute median of a list of numbers."""
    if not arr:
        return ''
    try:
        vals = sorted(float(x) for x in arr)
        n = len(vals)
        mid = n // 2
        return int(vals[mid]) if n % 2 != 0 else round((vals[mid-1] + vals[mid]) / 2)
    except (TypeError, ValueError):
        return ''

def block(rounds, idx, field):
    """Safely get a field from a specific round (0-indexed)."""
    if isinstance(rounds, list) and idx < len(rounds):
        return num(rounds[idx].get(field))
    return ''

def nback(dnb_data, target_block):
    """Hits, misses, false alarms, avg RT for one N-back level."""
    hits = misses = fa = rt_total = rt_count = 0
    for t in (dnb_data or []):
        if t.get('block') != target_block:
            continue
        is_target = t.get('isTarget', False)
        responded = t.get('responded', False)
        rt        = t.get('rt')
        if is_target and responded:
            hits += 1
            if rt:
                rt_total += float(rt)
                rt_count += 1
        elif is_target:
            misses += 1
        elif responded:
            fa += 1
    avg_rt = round(rt_total / rt_count, 2) if rt_count else 0
    return hits, misses, fa, avg_rt

def ba_ratio(a, b):
    try:
        av, bv = float(a), float(b)
        return round(bv / av, 4) if av > 0 else ''
    except (TypeError, ValueError):
        return ''


# ── 3. The Crash-Proof Route ────────────────────────────────────────
@app.route('/save_data', methods=['POST'])
def save_data():
    try:
        # Force JSON parsing
        data    = request.get_json(force=True, silent=True) or {}
        user    = data.get('user') or {}
        results = user.get('results') or {}
        state   = user.get('stateAssessment') or {}

        # Diagnostic print
        print(f"\n[RECEIVED] {user.get('name','Unknown')} | {user.get('id','Unknown')}")
        for task, val in results.items():
            status = '✓' if val else '✗ MISSING'
            print(f"  {status} {task}")

        # Extract sub-objects
        gng  = results.get('goNoGo')      or {}
        pvt  = results.get('pvt')         or {}
        trail= results.get('trailMaking') or {}
        dnb_data = results.get('dualNBack') or results.get('dualNback') or []

        gng_rounds = gng.get('rounds')  or []
        pvt_rounds = pvt.get('rounds')  or []
        gng_all_rts= gng.get('allRTs')  or []
        pvt_all_rts= pvt.get('allRTs')  or []

        # Go/No-Go
        total_go    = sum(num(r.get('totalGoTrials'), 0) for r in gng_rounds) if gng_rounds else ''
        total_nogo  = sum(num(r.get('totalNoGoTrials'), 0) for r in gng_rounds) if gng_rounds else ''
        
        total_hits  = num(gng.get('totalGoHits'))
        total_ce    = num(gng.get('totalCommission'))
        total_oe    = num(gng.get('totalOmission'))
        ce_rate     = rate(total_ce, total_nogo)
        oe_rate     = rate(total_oe, total_go)

        # Trail Making
        trail_a = num((trail.get('round1') or {}).get('time'))
        trail_b = num((trail.get('round2') or {}).get('time'))

        # Dual N-Back
        d0 = nback(dnb_data, '0-back')
        d1 = nback(dnb_data, '1-back')
        d2 = nback(dnb_data, '2-back')
        d3 = nback(dnb_data, '3-back')
        wm_load = (d2[0] + d3[0]) - d0[0]

        # Assemble row
        row = [
            # Metadata (9)
            user.get('id', ''),
            datetime.now().isoformat(),
            user.get('name', ''),
            num(user.get('age')),
            user.get('sex', ''),
            user.get('adhdStatus', ''),
            num(state.get('sleepiness')),
            num(state.get('feeling')),
            num(state.get('mood')),
            
            # Go/No-Go (23)
            total_go, total_nogo, total_hits,
            total_ce, total_oe, ce_rate, oe_rate,
            num(gng.get('overallAvgRT')),
            median(gng_all_rts),
            num(gng.get('overallRTV')),
            num(gng.get('temporalDriftIdx')),
            block(gng_rounds,0,'avgRT'), block(gng_rounds,0,'rtVariability'), block(gng_rounds,0,'commissionErrors'), block(gng_rounds,0,'omissionErrors'),
            block(gng_rounds,1,'avgRT'), block(gng_rounds,1,'rtVariability'), block(gng_rounds,1,'commissionErrors'), block(gng_rounds,1,'omissionErrors'),
            block(gng_rounds,2,'avgRT'), block(gng_rounds,2,'rtVariability'), block(gng_rounds,2,'commissionErrors'), block(gng_rounds,2,'omissionErrors'),
            
            # PVT (15)
            num(pvt.get('overallAvgRT')),
            median(pvt_all_rts),
            num(pvt.get('overallRTV')),
            num(pvt.get('totalLapses')),
            num(pvt.get('totalFalseStarts')),
            num(pvt.get('totalValidAttempts')),
            num(pvt.get('temporalDriftIdx')),
            block(pvt_rounds,0,'avgRT'), block(pvt_rounds,0,'rtVariability'), block(pvt_rounds,0,'lapses'),
            block(pvt_rounds,1,'avgRT'), block(pvt_rounds,1,'rtVariability'), block(pvt_rounds,1,'lapses'),
            block(pvt_rounds,2,'avgRT'), block(pvt_rounds,2,'rtVariability'), block(pvt_rounds,2,'lapses'),
            
            # Trail Making (5)
            trail_a, trail_b, ba_ratio(trail_a, trail_b),
            num(trail.get('totalCorrect')),
            num(trail.get('totalWrong')),
            
            # Dual N-Back (17)
            d0[0], d0[1], d0[2], d0[3],
            d1[0], d1[1], d1[2], d1[3],
            d2[0], d2[1], d2[2], d2[3],
            d3[0], d3[1], d3[2], d3[3],
            wm_load,
            
            # Raw backups (3)
            json.dumps(gng_all_rts),
            json.dumps(pvt_all_rts),
            json.dumps(dnb_data),
        ]

        if len(row) != len(HEADERS):
            # Detailed mismatch report to make debugging easy
            print(f"\n[ROW LENGTH ERROR] Expected {len(HEADERS)}, got {len(row)}")
            raise ValueError(
                f"Row has {len(row)} values but CSV expects {len(HEADERS)} columns. "
                f"This usually means server.py and the frontend are out of sync. "
                f"Restart the server — init_csv() will auto-migrate the file."
            )

        try:
            with open(DATA_FILE, 'a', newline='') as f:
                csv.writer(f).writerow(row)
        except PermissionError:
            print(f"\n[URGENT ERROR] Cannot write to {DATA_FILE}. Is it currently open in Excel or another program?")
            return jsonify({"status": "error", "message": "File is locked. Close the CSV and try again."}), 423

        print(f"  → Saved row ({len(row)} columns) to {os.path.abspath(DATA_FILE)}")
        return jsonify({"status": "success", "message": "Data saved."}), 200

    except Exception as e:
        import traceback
        print(f"\n[CRITICAL ERROR] Failed during data extraction or saving:")
        print(traceback.format_exc())
        return jsonify({"status": "error", "message": str(e)}), 500


# ── 4. Diagnostic Endpoints ─────────────────────────────────────

@app.route('/schema', methods=['GET'])
def schema_info():
    """Return current schema info and any mismatch details."""
    try:
        info = {
            "expected_columns": len(HEADERS),
            "headers": HEADERS,
            "file": os.path.abspath(DATA_FILE),
            "file_exists": os.path.exists(DATA_FILE),
        }
        if os.path.exists(DATA_FILE):
            with open(DATA_FILE, 'r', newline='', encoding='utf-8') as f:
                reader = csv.reader(f)
                rows   = list(reader)
            csv_headers = rows[0] if rows else []
            info["csv_column_count"] = len(csv_headers)
            info["csv_row_count"]    = max(0, len(rows) - 1)
            info["schema_ok"]        = (csv_headers == HEADERS)
            if not info["schema_ok"]:
                info["missing_from_csv"] = list(set(HEADERS) - set(csv_headers))
                info["extra_in_csv"]     = list(set(csv_headers) - set(HEADERS))
        return jsonify(info), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/reset_csv', methods=['POST'])
def reset_csv():
    """
    Back up the current CSV and create a fresh one with correct headers.
    POST body: { "confirm": "yes" }
    """
    try:
        data = request.get_json(force=True, silent=True) or {}
        if data.get('confirm') != 'yes':
            return jsonify({"status": "error", "message": "Send { \"confirm\": \"yes\" } to confirm."}), 400

        if os.path.exists(DATA_FILE):
            ts          = datetime.now().strftime('%Y%m%d_%H%M%S')
            backup_name = DATA_FILE.replace('.csv', f'_backup_{ts}.csv')
            import shutil
            shutil.copy2(DATA_FILE, backup_name)
            os.remove(DATA_FILE)
            msg = f"Backed up to {backup_name} and reset."
        else:
            msg = "No existing file — created fresh."

        with open(DATA_FILE, 'w', newline='', encoding='utf-8') as f:
            csv.writer(f).writerow(HEADERS)

        return jsonify({"status": "success", "message": msg, "columns": len(HEADERS)}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


# ── 5. Server Start ──────────────────────────────────────────────
if __name__ == '__main__':
    print(f"X-PhenoADHD backend  →  http://127.0.0.1:5000")
    print(f"Saving to: {os.path.abspath(DATA_FILE)}")
    print(f"Columns: {len(HEADERS)}")
    app.run(host='127.0.0.1', port=5000, debug=True)
