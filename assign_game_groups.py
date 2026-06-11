from __future__ import annotations

import argparse
import json
from collections import Counter
import random
from pathlib import Path
from typing import Any


GROUPS: list[dict[str, Any]] = [
    {"id": 1, "name": "Love", "capacity": 19},
    {"id": 2, "name": "Joy", "capacity": 19},
    {"id": 3, "name": "Peace", "capacity": 19},
    {"id": 4, "name": "Patience", "capacity": 19},
    {"id": 5, "name": "Kindness", "capacity": 18},
    {"id": 6, "name": "Goodness", "capacity": 18},
    {"id": 7, "name": "Faithfulness", "capacity": 18},
    {"id": 8, "name": "Gentleness", "capacity": 18},
    {"id": 9, "name": "Self-Control", "capacity": 18},
]

AGE_ORDER = ["Kid", "Teen", "Elderly", "Young Adult", "Adult"]


def build_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Split the roster into 9 balanced game-event groups.")
    parser.add_argument(
        "input",
        nargs="?",
        default="联合小组 2 - Full Name List (updated).json",
        help="Path to the normalized roster JSON file.",
    )
    parser.add_argument(
        "output",
        nargs="?",
        default="game_event_groups.json",
        help="Path to write the grouped JSON file.",
    )
    return parser


def load_entries(path: Path) -> list[dict[str, Any]]:
    return json.loads(path.read_text(encoding="utf-8"))


def choose_group(groups: list[dict[str, Any]], age_group: str) -> dict[str, Any]:
    candidates = [group for group in groups if len(group["members"]) < group["capacity"]]
    candidates.sort(
        key=lambda group: (
            sum(1 for member in group["members"] if member["gender_group"] == age_group),
            len(group["members"]),
            group["id"],
        )
    )
    return candidates[0]


def assign_groups(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    groups = [{**group, "members": []} for group in GROUPS]
    entries_by_age = {age_group: [entry for entry in entries if entry["gender_group"] == age_group] for age_group in AGE_ORDER}

    for age_group in AGE_ORDER[:-1]:
        for entry in entries_by_age[age_group]:
            choose_group(groups, age_group)["members"].append(entry)

    for entry in entries_by_age["Adult"]:
        choose_group(groups, "Adult")["members"].append(entry)

    for group in groups:
        if not group["members"]:
            group["leader"] = None
            continue

        group["leader"] = random.choice(group["members"])

    return groups


def flatten_entries(groups: list[dict[str, Any]]) -> list[dict[str, Any]]:
    flattened: list[dict[str, Any]] = []
    for group in groups:
        for member in group["members"]:
            flattened.append(
                {
                    **member,
                    "game_event_group_id": group["id"],
                    "game_event_group_name": group["name"],
                    "game_event_group_leader_number": group["leader"]["number"] if group["leader"] else None,
                    "game_event_group_leader_name_english": group["leader"]["name_english"] if group["leader"] else "",
                    "game_event_group_leader_name_chinese": group["leader"]["name_chinese"] if group["leader"] else "",
                    "game_event_group_is_leader": bool(group["leader"] and member["number"] == group["leader"]["number"]),
                }
            )
    return flattened


def build_output(groups: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "groups": [
            {
                "id": group["id"],
                "name": group["name"],
                "capacity": group["capacity"],
                "member_count": len(group["members"]),
                "leader_number": group["leader"]["number"] if group["leader"] else None,
                "leader_name_english": group["leader"]["name_english"] if group["leader"] else "",
                "leader_name_chinese": group["leader"]["name_chinese"] if group["leader"] else "",
                "age_group_breakdown": dict(Counter(member["gender_group"] for member in group["members"])),
            }
            for group in groups
        ],
        "participants": flatten_entries(groups),
    }


def main() -> int:
    args = build_argument_parser().parse_args()
    input_path = Path(args.input)
    output_path = Path(args.output)

    entries = load_entries(input_path)
    groups = assign_groups(entries)
    output = build_output(groups)

    output_path.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())