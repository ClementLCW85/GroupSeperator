from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any
from xml.etree import ElementTree as ET
from zipfile import ZipFile


NS = {
    "a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}

CHINESE_RE = re.compile(r"[\u4e00-\u9fff]+")
LATIN_RE = re.compile(r"[A-Za-z][A-Za-z'\- .]*")

LEADER_NORMALIZATION = {
    "alan": "Ps Alan",
    "huiyee": "Hui Yee",
    "祥辉": "Siang Fei",
    "丽环": "Lee Hwan",
}

AGE_GROUP_NORMALIZATION = {
    "young adult / teen": "Young Adult",
}


def load_shared_strings(archive: ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []

    shared_strings: list[str] = []
    root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    for shared_item in root.findall("a:si", NS):
        text = "".join(node.text or "" for node in shared_item.iterfind(".//a:t", NS))
        shared_strings.append(text)
    return shared_strings


def read_cell_value(cell: ET.Element, shared_strings: list[str]) -> str:
    cell_type = cell.attrib.get("t")
    value = cell.find("a:v", NS)

    if cell_type == "s" and value is not None:
        return shared_strings[int(value.text or "0")]

    if cell_type == "inlineStr":
        return "".join(node.text or "" for node in cell.iterfind(".//a:t", NS))

    return value.text if value is not None else ""


def column_letter(cell_ref: str) -> str:
    return "".join(ch for ch in cell_ref if ch.isalpha())


def split_name(raw_name: str) -> tuple[str, str]:
    raw_name = raw_name.strip()
    if not raw_name:
        return "", ""

    chinese_parts = [part.strip() for part in CHINESE_RE.findall(raw_name) if part.strip()]
    latin_parts = [part.strip() for part in LATIN_RE.findall(raw_name) if part.strip()]

    chinese_name = "".join(chinese_parts)
    english_name = " ".join(latin_parts)

    return chinese_name, english_name


def normalize_value(raw_value: str, mapping: dict[str, str]) -> str:
    stripped_value = raw_value.strip()
    if not stripped_value:
        return ""

    normalized = mapping.get(stripped_value.lower())
    if normalized is not None:
        return normalized

    return stripped_value


def parse_workbook(path: Path) -> list[dict[str, Any]]:
    with ZipFile(path) as archive:
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        rel_map = {rel.attrib["Id"]: rel.attrib["Target"] for rel in relationships}
        shared_strings = load_shared_strings(archive)

        first_sheet = workbook.find("a:sheets/a:sheet", NS)
        if first_sheet is None:
            return []

        sheet_target = rel_map[first_sheet.attrib[f"{{{NS['r']}}}id"]]
        sheet_root = ET.fromstring(archive.read(f"xl/{sheet_target}"))

        records: list[dict[str, Any]] = []
        for row in sheet_root.findall("a:sheetData/a:row", NS):
            cells: dict[str, str] = {}
            for cell in row.findall("a:c", NS):
                cells[column_letter(cell.attrib["r"])] = read_cell_value(cell, shared_strings).strip()

            number_text = cells.get("A", "").strip()
            if not number_text.isdigit():
                continue

            raw_name = cells.get("B", "")
            chinese_name, english_name = split_name(raw_name)
            small_group_leader = normalize_value(cells.get("C", ""), LEADER_NORMALIZATION)
            age_group = normalize_value(cells.get("D", ""), AGE_GROUP_NORMALIZATION)

            records.append(
                {
                    "number": int(number_text),
                    "name_chinese": chinese_name,
                    "name_english": english_name,
                    "small_group_leader": small_group_leader,
                    "age_group": age_group,
                }
            )

        return records


def build_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Convert the group roster workbook into JSON."
    )
    parser.add_argument(
        "input",
        nargs="?",
        default="联合小组 2 - Full Name List (updated).xlsx",
        help="Path to the source .xlsx file.",
    )
    parser.add_argument(
        "output",
        nargs="?",
        help="Path to write the JSON file. If omitted, JSON is printed to stdout.",
    )
    return parser


def main() -> int:
    args = build_argument_parser().parse_args()
    input_path = Path(args.input)

    records = parse_workbook(input_path)
    output_text = json.dumps(records, ensure_ascii=False, indent=2)

    if args.output:
        Path(args.output).write_text(output_text + "\n", encoding="utf-8")
    else:
        print(output_text)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())