from __future__ import annotations

import sys

from nlp_engine import NLTK_DIR, NLTK_PACKAGES, ensure_nltk_data

def main() -> int:
    status = ensure_nltk_data(download=True)
    for package, ok in status.items():
        print(f"{'ok' if ok else 'MISSING'} {package}")
    print(f"NLTK data folder: {NLTK_DIR}")
    missing = [p for p, ok in status.items() if not ok]
    if missing:
        print(
            "\nSome packages could not be downloaded. Check the internet connection. "
            "NLTK 3.9+ refuses downloads through an HTTP proxy by default; only if your "
            "proxy is trusted, set NLTK_ALLOW_PROXIED_URLOPEN=1 and run this again."
        )
        return 1
    print(f"\nAll {len(NLTK_PACKAGES)} packages ready.")
    return 0

if __name__ == "__main__":
    sys.exit(main())