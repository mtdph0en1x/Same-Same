#!/usr/bin/env python3
"""
Topic Analyzer for Same Same? — Human Association & Word2Vec Mode Classifier

Analyzes single-word game topics using ConceptNet Human Association Norms
(default) or Word2Vec embeddings to score game mode suitability:
  - Same Same (High consensus / iconic associations)
  - But Different (Broad / open answer space)
  - Blitz (High velocity / fast intuitive answers)

Usage:
    python topic_analyzer.py analyze pizza coffee ocean freedom kitchen
    python topic_analyzer.py analyze --file topics_100.txt
    python topic_analyzer.py analyze --file topics_100.txt --csv
    python topic_analyzer.py analyze --file topics_100.txt --output report.txt
    python topic_analyzer.py analyze --file topics_100.txt --output results.csv
    python topic_analyzer.py analyze --file topics_100.txt --json -o results.json
    python topic_analyzer.py analyze --file topics_100.txt --engine word2vec
    python topic_analyzer.py compare beach ocean sea pool lake
    python topic_analyzer.py compare --file topics_100.txt --output matrix.csv

ConceptNet results are cached locally in .conceptnet_cache.json for instant repeat runs.
"""

import argparse
import csv
import io
import json
import os
import sys
import numpy as np


# ---------------------------------------------------------------------------
# File loading helper
# ---------------------------------------------------------------------------

HEADER_KEYWORDS = {'word', 'words', 'topic', 'topics', 'category', 'categories', 'term', 'terms'}

def load_words_from_file(filepath):
    """Load words from a .txt or .csv file.
    
    Supports:
      - Plain text files (one word per line, comments starting with # or //)
      - CSV / TSV files (comma or tab separated values)
      - Stripping quotes, whitespace, and skipping common header lines
    """
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"File not found: {filepath}")

    words = []
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        lines = [line.strip() for line in f if line.strip()]

    for i, line in enumerate(lines):
        if line.startswith('#') or line.startswith('//'):
            continue
        
        # Split by comma or tab if present (CSV / TSV support)
        if ',' in line:
            parts = line.split(',')
        elif '\t' in line:
            parts = line.split('\t')
        else:
            parts = [line]
            
        for p in parts:
            clean = p.strip().strip('"\'').strip()
            if not clean:
                continue
            # Skip header row if matches common header names
            if i == 0 and clean.lower() in HEADER_KEYWORDS:
                continue
            words.append(clean)
            
    return words


# ---------------------------------------------------------------------------
# Neighbor filtering
# ---------------------------------------------------------------------------

CLEAN_K = 30
RAW_FETCH_K = 200


def _is_morphological_variant(neighbor, topic):
    """Check if neighbor is likely just a plural/tense form of the topic."""
    n, t = neighbor.lower(), topic.lower()
    if n == t:
        return True
    if n.startswith(t) or t.startswith(n):
        return True
    min_len = min(len(n), len(t))
    if min_len < 3:
        return False
    common = 0
    for a, b in zip(n, t):
        if a == b:
            common += 1
        else:
            break
    if common >= min_len * 0.8:
        return True
    return False


# ---------------------------------------------------------------------------
# Engine 1: ConceptNet Human Cognitive Association Engine (DEFAULT)
# ---------------------------------------------------------------------------

CACHE_FILE = os.path.join(os.path.dirname(__file__), '.conceptnet_cache.json')
_conceptnet_cache = None


def _load_cache():
    global _conceptnet_cache
    if _conceptnet_cache is not None:
        return _conceptnet_cache
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                _conceptnet_cache = json.load(f)
        except Exception:
            _conceptnet_cache = {}
    else:
        _conceptnet_cache = {}
    return _conceptnet_cache


def _save_cache():
    if _conceptnet_cache is not None:
        try:
            with open(CACHE_FILE, 'w', encoding='utf-8') as f:
                json.dump(_conceptnet_cache, f, indent=2)
        except Exception:
            pass


def fetch_conceptnet_associations(topic, limit=50):
    """Fetch real human cognitive associations with multi-tier fallback (Cache -> Datamuse -> ConceptNet)."""
    topic_clean = topic.strip().lower()
    cache = _load_cache()
    if topic_clean in cache:
        return cache[topic_clean]

    import urllib.request
    import urllib.parse

    # ── Tier 1: Try Datamuse Trigger Associations API (Fast, zero 502 errors) ──
    try:
        dm_url = f"https://api.datamuse.com/words?rel_trg={urllib.parse.quote(topic_clean)}&max=35"
        req = urllib.request.Request(dm_url, headers={'User-Agent': 'SameSameGameAnalyzer/1.0'})
        with urllib.request.urlopen(req, timeout=5) as resp:
            dm_data = json.loads(resp.read().decode('utf-8'))
            if dm_data and len(dm_data) >= 5:
                max_score = max(item.get('score', 100) for item in dm_data) or 100
                associations = []
                for item in dm_data:
                    w = item.get('word', '').lower().strip()
                    s = float(item.get('score', 0)) / max_score
                    if w and w != topic_clean and len(w) >= 3 and not _is_morphological_variant(w, topic_clean):
                        associations.append((w, round(s, 3)))
                if len(associations) >= 5:
                    cache[topic_clean] = associations
                    _save_cache()
                    return associations
    except Exception:
        pass

    # ── Tier 2: Try ConceptNet API ──
    try:
        url = f"http://api.conceptnet.io/related/c/en/{urllib.parse.quote(topic_clean)}?filter=/c/en&limit={limit}"
        req = urllib.request.Request(url, headers={'User-Agent': 'SameSameGameAnalyzer/1.0'})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            related = data.get('related', [])
            associations = []
            for item in related:
                term_id = item.get('@id', '')
                weight = float(item.get('weight', 0.0))
                if term_id.startswith('/c/en/'):
                    word = term_id.replace('/c/en/', '').replace('_', ' ')
                    word_clean = word.lower().strip()
                    if word_clean and word_clean != topic_clean and len(word_clean) >= 3:
                        if not _is_morphological_variant(word_clean, topic_clean):
                            associations.append((word_clean, round(weight, 3)))
            seen = {}
            for w, weight in associations:
                if w not in seen or weight > seen[w]:
                    seen[w] = weight
            sorted_assoc = sorted(seen.items(), key=lambda x: -x[1])
            if sorted_assoc:
                cache[topic_clean] = sorted_assoc
                _save_cache()
                return sorted_assoc
    except Exception as e:
        print(f"⚠ Warning: Could not fetch association data for '{topic}': {e}", file=sys.stderr)

    return []


def analyze_word_conceptnet(topic):
    """Compute human cognitive association metrics for a single topic using ConceptNet."""
    associations = fetch_conceptnet_associations(topic)
    if not associations or len(associations) < 5:
        return None

    words = [w for w, s in associations]
    weights = [s for w, s in associations]

    max_w = max(weights) if weights else 1.0
    norm_weights = [w / max_w for w in weights]

    n5 = min(5, len(norm_weights))
    n10 = min(10, len(norm_weights))
    
    top5_density = np.mean(norm_weights[:n5])
    top10_density = np.mean(norm_weights[:n10])
    
    # Association Entropy (human consensus vs scatter)
    prob_dist = np.array(norm_weights[:15]) / sum(norm_weights[:15])
    entropy = -np.sum(prob_dist * np.log2(prob_dist + 1e-9))
    max_entropy = np.log2(len(prob_dist))
    norm_entropy = float(entropy / max_entropy) if max_entropy > 0 else 0.5
    diversity = round(norm_entropy, 4)

    return {
        'word':           topic,
        'top5_density':   round(float(top5_density), 4),
        'top10_density':  round(float(top10_density), 4),
        'top20_density':  round(float(np.mean(norm_weights[:min(20, len(norm_weights))])), 4),
        'dropoff_ratio':  round(float(norm_weights[0] / norm_weights[-1]) if norm_weights[-1] > 0 else 1.0, 4),
        'spread':         round(float(np.std(norm_weights)), 4),
        'gap':            round(float(norm_weights[0] - norm_weights[-1]), 4),
        'inter_sim':      round(1.0 - diversity, 4),
        'diversity':      diversity,
        'top_neighbors':  words[:10],
        'neighbor_sims':  [round(float(s), 4) for s in norm_weights[:10]],
    }


# ---------------------------------------------------------------------------
# Engine 2: Word2Vec Model Loading & Analysis (Legacy)
# ---------------------------------------------------------------------------
_model = None
MODEL_NAME = 'word2vec-google-news-300'


def load_model():
    """Load the Word2Vec model, downloading on first run."""
    global _model
    if _model is not None:
        return _model

    import gensim.downloader as api

    print(f"Loading {MODEL_NAME}...")
    print("(First run downloads ~1.7GB — cached after that)\n")
    _model = api.load(MODEL_NAME)
    print(f"Model loaded: {len(_model.key_to_index):,} word vectors, "
          f"{_model.vector_size} dimensions\n")
    return _model


def _filter_neighbors(raw_neighbors, topic, target_k=CLEAN_K):
    filtered = []
    for w, sim in raw_neighbors:
        if '_' in w or w != w.lower() or len(w) < 3:
            continue
        if _is_morphological_variant(w, topic):
            continue
        filtered.append((w, sim))
        if len(filtered) >= target_k:
            break
    return filtered


def analyze_word_word2vec(model, word):
    """Compute metrics for a single topic word using Word2Vec."""
    if word not in model:
        return None

    raw = model.most_similar(word, topn=RAW_FETCH_K)
    neighbors = _filter_neighbors(raw, word)

    if len(neighbors) < 5:
        return None

    sims = [sim for _, sim in neighbors]
    neighbor_words = [w for w, _ in neighbors]

    n5  = min(5, len(sims))
    n10 = min(10, len(sims))
    n20 = min(20, len(sims))

    top5  = np.mean(sims[:n5])
    top10 = np.mean(sims[:n10])
    top20 = np.mean(sims[:n20])

    dropoff = top5 / top20 if top20 > 0 else 1.0
    spread  = float(np.std(sims))
    gap     = sims[0] - sims[-1]

    top_n = neighbor_words[:min(10, len(neighbor_words))]
    pairwise = []
    for i in range(len(top_n)):
        for j in range(i + 1, len(top_n)):
            if top_n[i] in model and top_n[j] in model:
                pairwise.append(float(model.similarity(top_n[i], top_n[j])))
    inter_sim = float(np.mean(pairwise)) if pairwise else 0.0
    diversity = 1.0 - inter_sim

    return {
        'word':           word,
        'top5_density':   round(float(top5), 4),
        'top10_density':  round(float(top10), 4),
        'top20_density':  round(float(top20), 4),
        'dropoff_ratio':  round(float(dropoff), 4),
        'spread':         round(float(spread), 4),
        'gap':            round(float(gap), 4),
        'inter_sim':      round(inter_sim, 4),
        'diversity':      round(diversity, 4),
        'top_neighbors':  neighbor_words[:10],
        'neighbor_sims':  [round(float(s), 4) for s in sims[:10]],
    }


# ---------------------------------------------------------------------------
# Mode scoring & classification
# ---------------------------------------------------------------------------

def compute_mode_scores(metrics):
    """Map raw metrics to per-mode suitability scores (0–1)."""
    d = metrics['top5_density']
    div = metrics['diversity']

    d_norm = float(np.clip((d - 0.30) / (0.65 - 0.30), 0, 1))
    div_norm = float(np.clip((div - 0.65) / (0.90 - 0.65), 0, 1))

    same_same = d_norm * (1.0 - div_norm)
    but_different = div_norm * (0.4 + 0.6 * (1.0 - d_norm))

    blitz = 1.0 - (same_same - but_different) ** 2
    blitz = blitz * 0.8

    total = same_same + but_different + blitz
    if total > 0:
        same_same     /= total
        but_different  /= total
        blitz         /= total

    convergence = d_norm * (1.0 - div_norm)

    return {
        'convergence':    round(convergence, 3),
        'same_same':      round(same_same, 3),
        'but_different':  round(but_different, 3),
        'blitz':          round(blitz, 3),
    }


def classify_mode(mode_scores):
    """Return the single best mode for this topic."""
    candidates = {
        'Same Same':      mode_scores['same_same'],
        'But Different':  mode_scores['but_different'],
        'Blitz':          mode_scores['blitz'],
    }
    return max(candidates, key=candidates.get)


# ---------------------------------------------------------------------------
# Formatting & Generators (Console, TXT, CSV, JSON)
# ---------------------------------------------------------------------------

def generate_txt_output(results, verbose=False):
    """Generate plain text report formatted string."""
    lines = []
    lines.append("")
    hdr = (f"{'WORD':<18} {'CONV':>6} {'SS':>6} {'BD':>6} "
           f"{'BZ':>6} {'BEST MODE':<15} {'TOP HUMAN ASSOCIATIONS'}")
    lines.append(hdr)
    lines.append(f"{'─' * 18} {'─' * 6} {'─' * 6} {'─' * 6} "
                 f"{'─' * 6} {'─' * 15} {'─' * 50}")

    for r in results:
        ms = r['mode_scores']
        neighbors = ', '.join(r['metrics']['top_neighbors'][:5])
        lines.append(f"{r['metrics']['word']:<18} "
                     f"{ms['convergence']:>6.3f} "
                     f"{ms['same_same']:>6.3f} "
                     f"{ms['but_different']:>6.3f} "
                     f"{ms['blitz']:>6.3f} "
                     f"{r['best_mode']:<15} "
                     f"{neighbors}")

    lines.append("")

    if verbose:
        bar = lambda v, w=20: '█' * int(v * w)
        for r in results:
            m  = r['metrics']
            ms = r['mode_scores']
            lines.append(f"  ╭─ {m['word'].upper()} {'─' * (47 - len(m['word']))}")
            lines.append(f"  │ Convergence: {ms['convergence']:.3f}   Best mode: {r['best_mode']}")
            lines.append(f"  │")
            lines.append(f"  │ Association metrics")
            lines.append(f"  │   Top-5 density   {m['top5_density']:.4f}")
            lines.append(f"  │   Top-10 density  {m['top10_density']:.4f}")
            lines.append(f"  │   Top-20 density  {m['top20_density']:.4f}")
            lines.append(f"  │   Spread (σ)      {m['spread']:.4f}")
            lines.append(f"  │   Diversity (H)   {m['diversity']:.4f}")
            lines.append(f"  │")
            lines.append(f"  │ Mode scores")
            lines.append(f"  │   Same Same:      {bar(ms['same_same']):<20} {ms['same_same']:.3f}")
            lines.append(f"  │   But Different:  {bar(ms['but_different']):<20} {ms['but_different']:.3f}")
            lines.append(f"  │   Blitz:          {bar(ms['blitz']):<20} {ms['blitz']:.3f}")
            lines.append(f"  │")
            lines.append(f"  │ Top Human Associations")
            for i, (w, s) in enumerate(zip(m['top_neighbors'], m['neighbor_sims'])):
                lines.append(f"  │   {i + 1:>2}. {w:<22} {s:.4f}  {bar(s, 25)}")
            lines.append(f"  ╰{'─' * 50}\n")

    # Mode summary
    by_mode = {}
    for r in results:
        by_mode.setdefault(r['best_mode'], []).append(r['metrics']['word'])

    lines.append("Summary by best mode:")
    for mode in ['Same Same', 'But Different', 'Blitz']:
        topics = by_mode.get(mode, [])
        if topics:
            lines.append(f"  {mode:<15} ({len(topics):>3})  {', '.join(topics)}")
    lines.append("")

    return "\n".join(lines)


def generate_csv_output(results):
    """Generate CSV formatted string."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        'topic', 'convergence', 'same_same', 'but_different', 'blitz',
        'best_mode', 'top_associations'
    ])
    for r in results:
        ms = r['mode_scores']
        neighbors = ', '.join(r['metrics']['top_neighbors'][:5])
        writer.writerow([
            r['metrics']['word'],
            ms['convergence'],
            ms['same_same'],
            ms['but_different'],
            ms['blitz'],
            r['best_mode'],
            neighbors
        ])
    return output.getvalue()


def generate_json_output(results):
    """Generate JSON formatted string."""
    out = []
    for r in results:
        out.append({
            'topic':            r['metrics']['word'],
            'convergence':      r['mode_scores']['convergence'],
            'mode_scores':      {k: v for k, v in r['mode_scores'].items() if k != 'convergence'},
            'best_mode':        r['best_mode'],
            'top_associations': r['metrics']['top_neighbors'][:5],
            'raw_metrics': {k: v for k, v in r['metrics'].items() if k not in ('word', 'top_neighbors', 'neighbor_sims')},
        })
    return json.dumps(out, indent=2)


def print_compare_matrix(words, matrix):
    """Print a cosine similarity heatmap to console."""
    col_w = max(max(len(w) for w in words), 6) + 1
    label_w = col_w

    print()
    print(f"{'':>{label_w + 2}}", end='')
    for w in words:
        print(f"{w:>{col_w}}", end='')
    print()
    print(f"{'':>{label_w}} ┬" + f"{'─' * col_w}" * len(words))

    for i, w in enumerate(words):
        print(f"{w:>{label_w}} │", end='')
        for j in range(len(words)):
            if i == j:
                print(f"{'·':>{col_w}}", end='')
            else:
                print(f"{matrix[i][j]:>{col_w}.3f}", end='')
        print()
    print()


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

def cmd_analyze(args):
    words = list(args.words or [])
    if args.file:
        try:
            file_words = load_words_from_file(args.file)
            words.extend(file_words)
            print(f"Loaded {len(file_words)} words from '{args.file}'")
        except Exception as e:
            print(f"Error reading file '{args.file}': {e}", file=sys.stderr)
            return

    if not words:
        print("No words to analyse.")
        return

    # Engine selection
    engine = args.engine or 'conceptnet'
    model = None
    if engine == 'word2vec':
        print("Using Word2Vec model engine...")
        model = load_model()
    else:
        print("Using ConceptNet Human Cognitive Association engine (cached)...")

    results = []
    not_found = []

    for word in words:
        if engine == 'word2vec':
            metrics = analyze_word_word2vec(model, word)
        else:
            metrics = analyze_word_conceptnet(word)

        if metrics is None:
            not_found.append(word)
            continue

        mode_scores = compute_mode_scores(metrics)
        best = classify_mode(mode_scores)
        results.append({
            'metrics':     metrics,
            'mode_scores': mode_scores,
            'best_mode':   best,
        })

    if not_found:
        print(f"⚠  No association data found for: {', '.join(not_found)}")

    if not results:
        return

    # Output selection
    is_csv_requested = args.csv or (args.output and args.output.lower().endswith('.csv'))
    is_json_requested = args.json or (args.output and args.output.lower().endswith('.json'))

    if is_csv_requested:
        output_str = generate_csv_output(results)
    elif is_json_requested:
        output_str = generate_json_output(results)
    else:
        output_str = generate_txt_output(results, verbose=args.verbose)

    # Output destination
    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            f.write(output_str)
        print(f"\nAnalysis saved to '{args.output}'")
    else:
        print(output_str)


def cmd_compare(args):
    words = list(args.words or [])
    if args.file:
        try:
            file_words = load_words_from_file(args.file)
            words.extend(file_words)
            print(f"Loaded {len(file_words)} words from '{args.file}'")
        except Exception as e:
            print(f"Error reading file '{args.file}': {e}", file=sys.stderr)
            return

    model = load_model()
    valid   = [w for w in words if w in model]
    invalid = [w for w in words if w not in model]

    if invalid:
        print(f"\n⚠  Not in vocabulary: {', '.join(invalid)}")
    if len(valid) < 2:
        print("Need at least 2 valid words to compare.")
        return

    matrix = []
    for w1 in valid:
        row = []
        for w2 in valid:
            row.append(1.0 if w1 == w2 else float(model.similarity(w1, w2)))
        matrix.append(row)

    if args.output and args.output.lower().endswith('.csv'):
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['word'] + list(valid))
        for i, w in enumerate(valid):
            row = [w]
            for j in range(len(valid)):
                row.append(1.0 if i == j else round(float(matrix[i][j]), 4))
            writer.writerow(row)
        with open(args.output, 'w', encoding='utf-8') as f:
            f.write(output.getvalue())
        print(f"\nSimilarity matrix saved to '{args.output}'")
    else:
        print_compare_matrix(valid, matrix)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description='Topic Analyzer for Same Same? — Human Cognitive Association Engine',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
examples:
  python topic_analyzer.py analyze pizza coffee ocean freedom kitchen
  python topic_analyzer.py analyze --file topics_100.txt
  python topic_analyzer.py analyze --file topics_100.txt --csv
  python topic_analyzer.py analyze --file topics_100.txt --output report.txt
  python topic_analyzer.py analyze --file topics_100.txt --output results.csv
  python topic_analyzer.py analyze --file topics_100.txt --engine word2vec
        """,
    )

    sub = parser.add_subparsers(dest='command')

    # analyze
    ap = sub.add_parser('analyze', help='Score and classify topics by mode')
    ap.add_argument('words', nargs='*', help='Words to analyse')
    ap.add_argument('--file', '-f', help='Read words from a TXT or CSV file')
    ap.add_argument('--engine', '-e', choices=['conceptnet', 'word2vec'], default='conceptnet',
                    help='Engine for associations: conceptnet (default, human norms) or word2vec')
    ap.add_argument('--json', '-j', action='store_true', help='Output JSON formatted results')
    ap.add_argument('--csv', '-c', action='store_true', help='Output CSV formatted results')
    ap.add_argument('--output', '-o', help='Save output to a file (.txt, .csv, or .json)')
    ap.add_argument('--verbose', '-v', action='store_true', help='Detailed per-word cards')

    # compare
    cp = sub.add_parser('compare', help='Cosine similarity matrix between topics')
    cp.add_argument('words', nargs='*', help='Words to compare')
    cp.add_argument('--file', '-f', help='Read words from a TXT or CSV file')
    cp.add_argument('--output', '-o', help='Save similarity matrix to a file (.csv or .txt)')

    args = parser.parse_args()

    if args.command == 'analyze':
        if not args.words and not args.file:
            ap.error('provide words as arguments or via --file')
        cmd_analyze(args)
    elif args.command == 'compare':
        if not args.words and not args.file:
            cp.error('provide words as arguments or via --file')
        cmd_compare(args)
    else:
        parser.print_help()


if __name__ == '__main__':
    main()
