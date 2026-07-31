from __future__ import annotations

import json
import re
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from html import unescape
from pathlib import Path
from typing import Iterable
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urljoin, urlparse, urlsplit, urlunsplit
from urllib.request import Request, urlopen


BASE_CATEGORY_URL = "https://sienci.com/product-category/end-mills-bits/"
CATEGORY_PAGES = [BASE_CATEGORY_URL] + [f"{BASE_CATEGORY_URL}page/{page}/" for page in range(2, 6)]
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0 Safari/537.36"

RE_LINK = re.compile(r'href=["\'](https://sienci\.com/product/[^"\']+)["\']', re.I)
RE_TITLE = re.compile(r"<title>(.*?)</title>", re.I | re.S)
RE_JSON_IMAGE = re.compile(r'"image"\s*:\s*\{\s*"@type"\s*:\s*"ImageObject"\s*,\s*"url"\s*:\s*"([^"]+)"', re.I)
RE_TABLE = re.compile(r"<table[^>]*>(.*?)</table>", re.I | re.S)
RE_ROW = re.compile(r"<tr[^>]*>(.*?)</tr>", re.I | re.S)
RE_CELL = re.compile(r"<t[dh][^>]*>(.*?)</t[dh]>", re.I | re.S)
RE_TAG = re.compile(r"<[^>]+>")
MM_PER_INCH = 25.4


@dataclass
class ToolRecord:
    id: str
    slug: str
    name: str
    product_url: str
    image_url: str
    image_filename: str
    measurement_table: dict
    tool_type: str
    operation_hints: list[str]

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "slug": self.slug,
            "name": self.name,
            "vendor": "sienci",
            "vendorDisplayName": "Sienci Labs",
            "productUrl": self.product_url,
            "purchaseUrl": self.product_url,
            "storeUrl": self.product_url,
            "image": f"images/{self.image_filename}",
            "imageUrl": self.image_url,
            "toolType": self.tool_type,
            "operationHints": self.operation_hints,
            **self.measurement_table,
        }


def log(message: str, log_file: Path | None = None) -> None:
    try:
        print(message, flush=True)
    except UnicodeEncodeError:
        safe = message.encode("ascii", "xmlcharrefreplace").decode("ascii")
        print(safe, flush=True)
    if log_file:
        with log_file.open("a", encoding="utf-8") as handle:
            handle.write(message + "\n")


def fetch_text(url: str) -> str:
    request = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=30) as response:
        raw = response.read()
        try:
            return raw.decode("utf-8")
        except UnicodeDecodeError:
            charset = response.headers.get_content_charset() or "utf-8"
            return raw.decode(charset, errors="replace")


def fetch_bytes(url: str) -> bytes:
    request = Request(normalize_url(url), headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=30) as response:
        return response.read()


def normalize_url(url: str) -> str:
    parts = urlsplit(url)
    return urlunsplit((
        parts.scheme,
        parts.netloc,
        quote(parts.path, safe="/%._-~"),
        parts.query,
        parts.fragment,
    ))


def strip_html(value: str) -> str:
    value = value.replace("<br>", "\n").replace("<br/>", "\n").replace("<br />", "\n")
    value = RE_TAG.sub("", value)
    value = unescape(value)
    value = value.replace("\xa0", " ")
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def discover_product_links(category_html: str) -> list[str]:
    links = []
    for match in RE_LINK.finditer(category_html):
        href = match.group(1).split("?")[0].rstrip("/")
        links.append(href)
    return links


def parse_measurement_table(product_html: str) -> dict | None:
    tables = []
    for table_html in RE_TABLE.findall(product_html):
        rows = []
        for row_html in RE_ROW.findall(table_html):
            cells = [strip_html(cell) for cell in RE_CELL.findall(row_html)]
            if cells:
                rows.append(cells)
        if len(rows) >= 2:
            tables.append(rows)

    for rows in tables:
        table_text = " ".join(cell for row in rows for cell in row)
        if "Shank dia [mm]" not in table_text or "Cutting dia [mm]" not in table_text:
            continue
        headers = rows[0]
        values = rows[1]
        if len(headers) != len(values):
            continue
        mapped = dict(zip(headers, values))
        flute_angle = mapped.get("Flute angle [°]") or mapped.get("Flute angle [Â°]") or mapped.get("Flute angle [Ã‚Â°]")
        helix_angle = mapped.get("Helix angle [°]") or mapped.get("Helix angle [Â°]") or mapped.get("Helix angle [Ã‚Â°]")
        return {
            "material": mapped.get("Material", ""),
            "tip": mapped.get("Tip", ""),
            "flutes": to_number(mapped.get("# flutes")),
            "fluteType": mapped.get("Flute type", ""),
            "coating": mapped.get("Coating", ""),
            "shankDiameterMm": to_number(mapped.get("Shank dia [mm]")),
            "cuttingDiameterMm": to_number(mapped.get("Cutting dia [mm]")),
            "lengthMm": to_number(mapped.get("Length [mm]")),
            "cuttingLengthMm": to_number(mapped.get("Cutting length [mm]")),
            "fluteAngleDeg": to_number(flute_angle),
            "helixAngleDeg": to_number(helix_angle),
            "maxMaterialCuttingHardness": to_number(mapped.get("Max. material cutting hardness")),
        }

    metadata_table = None
    dimensions_table = None
    for rows in tables:
        headers = rows[0]
        table_text = " ".join(headers)
        if "Tool Material" in table_text:
            metadata_table = rows
        if "Flute Diameter (Inches)" in table_text or "Shank Diameter (Inches)" in table_text:
            dimensions_table = rows

    if metadata_table and dimensions_table:
        meta_headers = metadata_table[0]
        meta_values = metadata_table[1]
        dim_headers = [header.replace("1Shank Diameter (Inches)", "Shank Diameter (Inches)") for header in dimensions_table[0]]
        dim_values = dimensions_table[1]
        if len(meta_headers) == len(meta_values) and len(dim_headers) == len(dim_values):
            meta = dict(zip(meta_headers, meta_values))
            dims = dict(zip(dim_headers, dim_values))
            return {
                "material": meta.get("Tool Material", ""),
                "tip": infer_tip_from_metadata(meta),
                "flutes": to_number(meta.get("Flute Count")),
                "fluteType": infer_flute_type_from_metadata(meta),
                "coating": meta.get("Coating", ""),
                "shankDiameterMm": inches_to_mm(dims.get("Shank Diameter (Inches)")),
                "cuttingDiameterMm": inches_to_mm(dims.get("Flute Diameter (Inches)")),
                "lengthMm": inches_to_mm(dims.get("Overall Length (Inches)")),
                "cuttingLengthMm": inches_to_mm(dims.get("Flute Length (Inches)")),
                "fluteAngleDeg": to_number(meta.get("V-Bit Angle")),
                "helixAngleDeg": to_number(meta.get("Helix Angle")),
                "maxMaterialCuttingHardness": to_number(str(meta.get("Max. Material Cutting Hardness", "")).replace(" HRC", "")),
            }
    return None


def infer_tip_from_metadata(metadata: dict) -> str:
    if metadata.get("V-Bit Angle"):
        return "V"
    return ""


def infer_flute_type_from_metadata(metadata: dict) -> str:
    return metadata.get("Flute Type", "")


def inches_to_mm(value: str | None) -> int | float | str:
    if value is None:
        return ""
    normalized = value.strip().lower()
    if not normalized or normalized == "n/a":
        return ""
    normalized = normalized.replace("″", '"').replace("”", '"').replace("“", '"')
    normalized = normalized.replace("&", "-")
    normalized = normalized.replace("inches", "").replace("inch", "").replace("in", "").strip()
    if "-" in normalized and "/" in normalized:
        whole, frac = normalized.split("-", 1)
        inches = float(whole) + fraction_to_float(frac)
    elif "/" in normalized:
        inches = fraction_to_float(normalized)
    else:
        try:
            inches = float(normalized.replace('"', "").strip())
        except ValueError:
            return value
    mm = inches * MM_PER_INCH
    return round(mm, 4)


def fraction_to_float(value: str) -> float:
    value = value.replace('"', "").strip()
    numerator, denominator = value.split("/", 1)
    return float(numerator) / float(denominator)


def infer_tool_type(tip: str) -> str:
    tip_lower = tip.lower()
    if "ball" in tip_lower:
        return "ballnose"
    if "v" in tip_lower:
        return "v-bit"
    if "flat" in tip_lower:
        return "flat"
    if "drill" in tip_lower:
        return "drill"
    if "surfacing" in tip_lower:
        return "surfacing"
    return tip_lower.replace(" ", "-") or "unknown"


def infer_operation_hints(tool_type: str) -> list[str]:
    if tool_type == "v-bit":
        return ["vcarve", "engrave"]
    if tool_type == "ballnose":
        return ["profile-outside", "profile-inside", "pocket"]
    if tool_type == "flat":
        return ["profile-outside", "profile-inside", "pocket"]
    if tool_type == "drill":
        return ["engrave"]
    if tool_type == "surfacing":
        return ["pocket"]
    return ["profile-outside", "profile-inside"]


def to_number(value: str | None) -> int | float | str:
    if value is None:
        return ""
    value = value.strip()
    if not value:
        return ""
    try:
        number = float(value)
    except ValueError:
        return value
    if number.is_integer():
        return int(number)
    return number


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def unique_ordered(values: Iterable[str]) -> list[str]:
    seen = set()
    result = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        result.append(value)
    return result


def file_extension_from_url(url: str) -> str:
    suffix = Path(urlparse(url).path).suffix.lower()
    return suffix if suffix in {".jpg", ".jpeg", ".png", ".webp"} else ".jpg"


def build_tool_record(product_url: str, product_html: str) -> ToolRecord | None:
    measurements = parse_measurement_table(product_html)
    if not measurements:
        return None

    title_match = RE_TITLE.search(product_html)
    image_match = RE_JSON_IMAGE.search(product_html)
    if not title_match or not image_match:
        return None

    name = strip_html(title_match.group(1)).replace(" | Sienci Labs", "").strip()
    image_url = urljoin(product_url, json.loads(f'"{image_match.group(1)}"'))
    slug = Path(urlparse(product_url).path.rstrip("/")).name
    extension = file_extension_from_url(image_url)
    tool_type = infer_tool_type_from_name_and_measurements(name, measurements)

    return ToolRecord(
        id=f"sienci-{slug}",
        slug=slug,
        name=name,
        product_url=product_url,
        image_url=image_url,
        image_filename=f"{slug}{extension}",
        measurement_table=measurements,
        tool_type=tool_type,
        operation_hints=infer_operation_hints(tool_type),
    )


def infer_tool_type_from_name_and_measurements(name: str, measurements: dict) -> str:
    explicit_tip = str(measurements.get("tip", "")).strip()
    if explicit_tip:
        inferred = infer_tool_type(explicit_tip)
        if inferred != "unknown":
            return inferred
    name_lower = name.lower()
    if "v-bit" in name_lower or " v bit" in name_lower:
        return "v-bit"
    if "ball nose" in name_lower or "ballnose" in name_lower:
        return "ballnose"
    if "surfacing" in name_lower:
        return "surfacing"
    if "drill" in name_lower:
        return "drill"
    if "flat" in name_lower:
        return "flat"
    return "unknown"


def write_payload(out_dir: Path, tool_records: list[ToolRecord], skipped: list[dict]) -> None:
    payload = {
        "vendor": "sienci",
        "vendorDisplayName": "Sienci Labs",
        "categoryUrl": BASE_CATEGORY_URL,
        "categoryPages": CATEGORY_PAGES,
        "scrapedAtUtc": datetime.now(timezone.utc).isoformat(),
        "toolCount": len(tool_records),
        "tools": [record.to_dict() for record in tool_records],
        "skippedProducts": skipped,
    }
    ensure_dir(out_dir)
    (out_dir / "tools.json").write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> int:
    repo_root = Path(__file__).resolve().parent.parent
    out_dir = repo_root / "library" / "tools" / "sienci"
    image_dir = out_dir / "images"
    ensure_dir(image_dir)
    log_file = out_dir / "scrape.log"
    if log_file.exists():
        log_file.unlink()
    log("Starting Sienci tool scrape", log_file)

    product_links: list[str] = []
    for url in CATEGORY_PAGES:
        log(f"Fetching category page: {url}", log_file)
        html = fetch_text(url)
        links = discover_product_links(html)
        log(f"  discovered {len(links)} raw product links", log_file)
        product_links.extend(links)
    product_links = unique_ordered(product_links)
    log(f"Unique product links: {len(product_links)}", log_file)

    tool_records: list[ToolRecord] = []
    skipped: list[dict] = []

    for index, product_url in enumerate(product_links, start=1):
        log(f"[{index}/{len(product_links)}] Product: {product_url}", log_file)
        try:
            html = fetch_text(product_url)
        except (HTTPError, URLError, TimeoutError) as error:
            log(f"  skip product fetch error: {error}", log_file)
            skipped.append({"url": product_url, "reason": str(error)})
            write_payload(out_dir, tool_records, skipped)
            continue

        record = build_tool_record(product_url, html)
        if not record:
            log("  skip: no measurement table / image / title", log_file)
            skipped.append({"url": product_url, "reason": "missing measurement table or metadata"})
            write_payload(out_dir, tool_records, skipped)
            continue

        image_path = image_dir / record.image_filename
        if not image_path.exists():
            try:
                log(f"  downloading image: {record.image_url}", log_file)
                image_path.write_bytes(fetch_bytes(record.image_url))
            except (HTTPError, URLError, TimeoutError) as error:
                log(f"  skip image fetch error: {error}", log_file)
                skipped.append({"url": product_url, "reason": f"image download failed: {error}"})
                write_payload(out_dir, tool_records, skipped)
                continue

        tool_records.append(record)
        log(f"  saved tool: {record.name}", log_file)
        write_payload(out_dir, tool_records, skipped)

    log(f"Wrote {len(tool_records)} tools to {out_dir}", log_file)
    if skipped:
        log(f"Skipped {len(skipped)} products", log_file)
    return 0


if __name__ == "__main__":
    sys.exit(main())
