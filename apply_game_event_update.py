from __future__ import annotations

import argparse
import shutil
from datetime import datetime
from pathlib import Path


def build_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Back up the current game-event JSON and replace it with an updated export."
    )
    parser.add_argument(
        "updated",
        help="Path to the updated game_event_groups.json export.",
    )
    parser.add_argument(
        "target",
        nargs="?",
        default="game_event_groups.json",
        help="Path to the repository copy that should be replaced.",
    )
    return parser


def main() -> int:
    args = build_argument_parser().parse_args()
    updated_path = Path(args.updated)
    target_path = Path(args.target)

    if not updated_path.is_file():
        raise SystemExit(f"Updated file not found: {updated_path}")

    if target_path.exists():
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        backup_path = target_path.with_name(f"{target_path.stem}.before-update-{timestamp}{target_path.suffix}")
        shutil.copy2(target_path, backup_path)

    shutil.copy2(updated_path, target_path)
    print(f"Updated {target_path} from {updated_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())