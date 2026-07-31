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


BASE_CATEGORY_URL = "https://ooznest.co.uk/product-category/self-build-solutions/workbee-cnc-machine/cnc-machine-router-bits/"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0 Safari/537.36"
REQUEST_HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept-Language": "en-GB,en;q=0.9",
}

RE_LINK = re.compile(r'href=["\'](https://ooznest\.co\.uk/product/[^"\']+)["\']', re.I)
RE_TITLE = re.compile(r"<title>(.*?)</title>", re.I | re.S)
RE_OG_IMAGE = re.compile(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']', re.I)
RE_TABLE = re.compile(r'<table class="woocommerce-product-attributes shop_attributes">(.*?)</table>', re.I | re.S)
RE_ROW = re.compile(r"<tr[^>]*>(.*?)</tr>", re.I | re.S)
RE_TH = re.compile(r"<th[^>]*>(.*?)</th>", re.I | re.S)
RE_TD = re.compile(r"<td[^>]*>(.*?)</td>", re.I | re.S)
RE_TAG = re.compile(r"<[^>]+>")


@dataclass
class ToolRecord:
    id: str
    slug: str
    name: str
    product_url: str
    image_url: str
    image_filename: str
    metadata: dict
    tool_type: str
    operation_hints: list[str]

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "slug": self.slug,
            "name": self.name,
            "vendor": "ooznest",
            "vendorDisplayName": "Ooznest",
            "productUrl": self.product_url,
            "purchaseUrl": self.product_url,
            "storeUrl": self.product_url,
            "image": f"images/{self.image_filename}",
            "imageUrl": self.image_url,
            "toolType": self.tool_type,
            "operationHints": self.operation_hints,
            **self.metadata,
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
    request = Request(normalize_url(url), headers=REQUEST_HEADERS)
    with urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8", errors="replace")


def fetch_bytes(url: str) -> bytes:
    request = Request(normalize_url(url), headers=REQUEST_HEADERS)
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


def parse_attributes(product_html: str) -> dict[str, str]:
    table_match = RE_TABLE.search(product_html)
    if not table_match:
        return {}
    attributes: dict[str, str] = {}
    for row_html in RE_ROW.findall(table_match.group(1)):
        th_match = RE_TH.search(row_html)
        td_match = RE_TD.search(row_html)
        if not th_match or not td_match:
            continue
        key = strip_html(th_match.group(1))
        value = strip_html(td_match.group(1))
        if key:
            attributes[key] = value
    return attributes


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


def infer_tool_type(cut_type: str, name: str) -> str:
    combined = f"{cut_type} {name}".lower()
    if "ball" in combined:
        return "ballnose"
    if "v-bit" in combined or " v bit" in combined:
        return "v-bit"
    if "square" in combined:
        return "flat"
    if "drill" in combined:
        return "drill"
    if "surfacing" in combined:
        return "surfacing"
    return "unknown"


def infer_operation_hints(tool_type: str) -> list[str]:
    if tool_type == "v-bit":
        return ["vcarve", "engrave"]
    if tool_type in {"ballnose", "flat"}:
        return ["profile-outside", "profile-inside", "pocket"]
    if tool_type == "drill":
        return ["engrave"]
    if tool_type == "surfacing":
        return ["pocket"]
    return ["profile-outside", "profile-inside"]


def build_metadata(attributes: dict[str, str]) -> dict:
    return {
        "brand": attributes.get("Brand", ""),
        "material": attributes.get("Material", ""),
        "version": attributes.get("Version", ""),
        "tip": attributes.get("Cut Type", ""),
        "toolTypeLabel": attributes.get("Cut Type", ""),
        "forMaterial": attributes.get("For Material", ""),
        "cuttingDiameterMm": to_number(attributes.get("Cut Diameter (mm)")),
        "cuttingDiameterInches": attributes.get("Cut Diameter - Inches", ""),
        "shankDiameterMm": to_number(attributes.get("Shank Diameter (mm)")),
        "shankDiameterInches": attributes.get("Shank Diameter (Inches)", ""),
        "cuttingLengthMm": to_number(attributes.get("Cut Length (mm)")),
        "cuttingLengthInches": attributes.get("Cut Length (Inches)", ""),
        "lengthMm": to_number(attributes.get("Bit Length (mm)")),
        "lengthInches": attributes.get("Bit Length (Inches)", ""),
        "flutes": to_number(attributes.get("Number of Flutes")),
        "fluteType": attributes.get("Flute Direction", ""),
        "cutRadiusMm": to_number(attributes.get("Cut Radius (mm)")),
        "cutRadiusInches": attributes.get("Cut Radius (Inches)", ""),
        "coating": attributes.get("Coating", ""),
        "weightG": to_number(attributes.get("Weight (g)")),
    }


def build_tool_record(product_url: str, product_html: str) -> ToolRecord | None:
    attributes = parse_attributes(product_html)
    if "Cut Diameter (mm)" not in attributes or "Shank Diameter (mm)" not in attributes:
        return None

    title_match = RE_TITLE.search(product_html)
    image_match = RE_OG_IMAGE.search(product_html)
    if not title_match or not image_match:
        return None

    name = strip_html(title_match.group(1)).replace(" - Ooznest", "").strip()
    image_url = urljoin(product_url, image_match.group(1))
    slug = Path(urlparse(product_url).path.rstrip("/")).name
    extension = Path(urlparse(image_url).path).suffix.lower() or ".jpg"
    tool_type = infer_tool_type(attributes.get("Cut Type", ""), name)

    return ToolRecord(
        id=f"ooznest-{slug}",
        slug=slug,
        name=name,
        product_url=product_url,
        image_url=image_url,
        image_filename=f"{slug}{extension}",
        metadata=build_metadata(attributes),
        tool_type=tool_type,
        operation_hints=infer_operation_hints(tool_type),
    )


def unique_ordered(values: Iterable[str]) -> list[str]:
    seen = set()
    result = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        result.append(value)
    return result


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def write_payload(out_dir: Path, tool_records: list[ToolRecord], skipped: list[dict]) -> None:
    payload = {
        "vendor": "ooznest",
        "vendorDisplayName": "Ooznest",
        "categoryUrl": BASE_CATEGORY_URL,
        "categoryPages": [BASE_CATEGORY_URL],
        "scrapedAtUtc": datetime.now(timezone.utc).isoformat(),
        "toolCount": len(tool_records),
        "tools": [record.to_dict() for record in tool_records],
        "skippedProducts": skipped,
    }
    ensure_dir(out_dir)
    (out_dir / "tools.json").write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> int:
    repo_root = Path(__file__).resolve().parent.parent
    out_dir = repo_root / "library" / "tools" / "ooznest"
    image_dir = out_dir / "images"
    ensure_dir(image_dir)
    log_file = out_dir / "scrape.log"
    if log_file.exists():
        log_file.unlink()
    log("Starting Ooznest tool scrape", log_file)

    category_html = fetch_text(BASE_CATEGORY_URL)
    product_links = unique_ordered(discover_product_links(category_html))
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
            log("  skip: no tool specs table", log_file)
            skipped.append({"url": product_url, "reason": "missing tool spec attributes"})
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
