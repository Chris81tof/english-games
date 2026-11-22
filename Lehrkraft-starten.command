#!/bin/bash
# Doppelklick: startet die App lokal im Lehrkraft-Modus und öffnet den Browser.
cd "$(dirname "$0")" || exit 1
python3 tools/lehrkraft.py
