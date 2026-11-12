#!/usr/bin/env python3
"""Collect public X account RSS into a persistent, validated JSON archive."""

import argparse
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import sys
import tempfile
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
import xml.etree.ElementTree as ET


FEED_HOST = "nitter.gq"
MAX_RESPONSE = 2 * 1024 * 1024
MAX_TEXT = 1200
HANDLE = re.compile(r"[A-Za-z0-9_]{1,15}\Z")
POST_ID = re.compile(r"[0-9]{1,25}\Z")
POST_PATH = re.compile(r"/([A-Za-z0-9_]{1,15})/status/([0-9]{1,25})/?\Z")
DC_CREATOR = "{http://purl.org/dc/elements/1.1/}creator"
UTC = timezone.utc


class InvalidData(ValueError):
    pass


def timestamp(value):
    return value.astimezone(UTC).isoformat(timespec="seconds").replace("+00:00", "Z")


def parse_timestamp(value, nullable=False):
    if value is None and nullable:
        return None
    if not isinstance(value, str) or not value.endswith("Z"):
        raise InvalidData("Expected a UTC timestamp")
    try:
        parsed = datetime.fromisoformat(value[:-1] + "+00:00")
    except ValueError as exc:
        raise InvalidData("Invalid UTC timestamp") from exc
    if parsed.utcoffset() != timedelta(0):
        raise InvalidData("Invalid UTC offset")
    return parsed


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise InvalidData("Duplicate JSON key")
        result[key] = value
    return result


def read_json(path):
    with path.open(encoding="utf-8") as stream:
        return json.load(stream, object_pairs_hook=unique_object)


def require_keys(value, keys):
    if not isinstance(value, dict) or set(value) != set(keys):
        raise InvalidData("Unexpected JSON schema")


def valid_handle(value):
    return isinstance(value, str) and HANDLE.fullmatch(value) is not None


def canonical_url(author, post_id):
    return f"https://x.com/{author}/status/{post_id}"


def validate_sources(sources):
    if not isinstance(sources, list) or not sources:
        raise InvalidData("Sources must be a nonempty array")
    seen = set()
    for source in sources:
        require_keys(source, ("handle", "label", "topic", "topicEn"))
        handle = source["handle"]
        if not valid_handle(handle) or handle.lower() in seen:
            raise InvalidData("Invalid or duplicate source handle")
        if any(not isinstance(source[key], str) or not source[key].strip()
               for key in ("label", "topic", "topicEn")):
            raise InvalidData("Invalid source metadata")
        seen.add(handle.lower())


def _validate_state(state, version):
    keys = ("version", "checked_at", "last_success_at", "sources", "items")
    if version == 2:
        keys += ("started_at",)
    require_keys(state, keys)
    if type(state["version"]) is not int or state["version"] != version:
        raise InvalidData("Unsupported archive version")
    checked = parse_timestamp(state["checked_at"], nullable=True)
    successful = parse_timestamp(state["last_success_at"], nullable=True)
    started = parse_timestamp(state["started_at"], nullable=True) if version == 2 else None
    if started and (checked is None or started > checked):
        raise InvalidData("Invalid archive start time")
    if successful and (checked is None or successful > checked):
        raise InvalidData("Invalid archive success time")
    if not isinstance(state["sources"], dict) or not isinstance(state["items"], list):
        raise InvalidData("Invalid archive collections")
    if version == 2 and started is None and len(state["items"]) > 10:
        raise InvalidData("Uninitialized archive exceeds preview limit")
    if started and len(state["items"]) < 10:
        raise InvalidData("Initialized archive is missing its initial records")
    source_handles = set()
    for handle, source in state["sources"].items():
        if not valid_handle(handle) or handle.lower() in source_handles:
            raise InvalidData("Invalid or duplicate archive source")
        source_handles.add(handle.lower())
        require_keys(source, ("status", "checked_at", "last_success_at", "latest_post_at", "error"))
        source_checked = parse_timestamp(source["checked_at"])
        source_success = parse_timestamp(source["last_success_at"], nullable=True)
        parse_timestamp(source["latest_post_at"], nullable=True)
        if checked is None or source_checked > checked:
            raise InvalidData("Invalid source check time")
        if source_success and source_success > source_checked:
            raise InvalidData("Invalid source success time")
        if source["status"] == "ok":
            if source["error"] is not None or source_success != source_checked:
                raise InvalidData("Invalid successful source status")
        elif source["status"] == "error":
            if not isinstance(source["error"], str) or not source["error"]:
                raise InvalidData("Missing source error")
        else:
            raise InvalidData("Invalid source status")
    ids = set()
    initial_count = 0
    for item in state["items"]:
        require_keys(item, ("id", "author", "text", "url", "published_at", "collected_at"))
        post_id = item["id"]
        if not isinstance(post_id, str) or not POST_ID.fullmatch(post_id) or post_id in ids:
            raise InvalidData("Invalid or duplicate archived post ID")
        if not valid_handle(item["author"]):
            raise InvalidData("Invalid archived author")
        if not isinstance(item["text"], str) or len(item["text"]) > MAX_TEXT:
            raise InvalidData("Invalid archived text")
        if item["url"] != canonical_url(item["author"], post_id):
            raise InvalidData("Invalid archived post URL")
        published = parse_timestamp(item["published_at"])
        collected = parse_timestamp(item["collected_at"])
        if checked is None or collected > checked or published > collected + timedelta(minutes=10):
            raise InvalidData("Invalid archived post time")
        if started:
            if collected < started or (published < started and collected != started):
                raise InvalidData("Archived post predates the collection boundary")
            if published < started:
                initial_count += 1
        ids.add(post_id)
    if initial_count > 10:
        raise InvalidData("Archive exceeds the initial historical post limit")


def validate_state(state):
    _validate_state(state, 2)


def sorted_posts(items):
    return sorted(items, key=lambda item: (
        parse_timestamp(item["published_at"]), int(item["id"])), reverse=True)


def migrate_state(state):
    if isinstance(state, dict) and state.get("version") == 2:
        validate_state(state)
        return False
    _validate_state(state, 1)
    state["version"] = 2
    state["started_at"] = None
    state["items"] = sorted_posts(state["items"])[:10]
    validate_state(state)
    return True


class TextContent(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.hidden = []

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "template", "noscript"):
            self.hidden.append(tag)
        elif not self.hidden and tag in ("p", "div", "br", "li", "blockquote"):
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if self.hidden:
            if tag == self.hidden[-1]:
                self.hidden.pop()
        elif tag in ("p", "div", "li", "blockquote"):
            self.parts.append("\n")

    def handle_data(self, data):
        if not self.hidden:
            self.parts.append(data)


def plain_text(markup):
    parser = TextContent()
    parser.feed(markup)
    parser.close()
    text = "".join(parser.parts).replace(f"https://{FEED_HOST}/t.co/", "https://t.co/")
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)
    text = "\n".join(" ".join(line.split()) for line in text.splitlines()).strip()
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text if len(text) <= MAX_TEXT else text[:MAX_TEXT - 1].rstrip() + "…"


class NoRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def fetch_posts(handle, now):
    request = Request(
        f"https://{FEED_HOST}/{handle}/rss",
        headers={
            "User-Agent": "KIUK-News/1.0 (+https://kiukmaster.com/news/)",
            "Accept": "application/rss+xml, application/xml, text/xml",
            "Accept-Encoding": "identity",
        },
    )
    with build_opener(NoRedirects()).open(request, timeout=20) as response:
        if response.status != 200:
            raise InvalidData("Unexpected HTTP status")
        data = response.read(MAX_RESPONSE + 1)
    if len(data) > MAX_RESPONSE:
        raise InvalidData("RSS response exceeds size limit")
    document = data.decode("utf-8", errors="strict")
    if re.search(r"<!\s*(DOCTYPE|ENTITY)\b", document, re.IGNORECASE):
        raise InvalidData("XML declarations are not permitted")
    root = ET.fromstring(document)
    channels = root.findall("channel")
    if root.tag != "rss" or len(channels) != 1:
        raise InvalidData("Expected one RSS channel")
    channel = channels[0]
    channel_title = channel.findtext("title", "").strip()
    if not re.search(r" / @" + re.escape(handle) + r"\Z", channel_title, re.IGNORECASE):
        raise InvalidData("RSS channel does not match source")
    posts = {}
    checked_at = timestamp(now)
    for item in channel.findall("item"):
        title = item.findtext("title", "").strip()
        if title.startswith(("RT @", "R to @")):
            continue
        author = item.findtext(DC_CREATOR, "").strip().removeprefix("@")
        try:
            link = urlsplit(item.findtext("link", "").strip())
        except ValueError as exc:
            raise InvalidData("Invalid RSS post URL") from exc
        match = POST_PATH.fullmatch(link.path)
        if (link.scheme != "https" or link.netloc != FEED_HOST or link.query
                or not match or author.lower() != handle.lower()
                or match[1].lower() != handle.lower()):
            raise InvalidData("RSS post author or URL does not match source")
        post_id = match[2]
        if item.findtext("guid", "").strip() != post_id:
            raise InvalidData("RSS post ID mismatch")
        try:
            published = parsedate_to_datetime(item.findtext("pubDate", ""))
            if published.tzinfo is None:
                raise InvalidData("RSS publication time has no timezone")
            published = published.astimezone(UTC)
        except (TypeError, ValueError, OverflowError) as exc:
            raise InvalidData("Invalid RSS publication time") from exc
        if published > now + timedelta(minutes=10):
            raise InvalidData("RSS publication time is in the future")
        body = item.findtext("description", "")
        text = plain_text(body) or plain_text(title.removeprefix("Pinned: "))
        posts[post_id] = {
            "id": post_id,
            "author": handle,
            "text": text,
            "url": canonical_url(handle, post_id),
            "published_at": timestamp(published),
            "collected_at": checked_at,
        }
    return list(posts.values())


def error_label(exc):
    if isinstance(exc, HTTPError):
        return f"HTTP {exc.code}"
    if isinstance(exc, (URLError, TimeoutError, OSError)):
        return "Network request failed"
    if isinstance(exc, UnicodeError):
        return "RSS is not valid UTF-8"
    if isinstance(exc, ET.ParseError):
        return "RSS XML is invalid"
    return str(exc)


def write_atomic(path, state):
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", newline="\n",
                                         dir=path.parent, prefix=".news-", suffix=".json",
                                         delete=False) as stream:
            temporary = Path(stream.name)
            json.dump(state, stream, ensure_ascii=False, indent=2)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def collect(state, sources):
    now = datetime.now(UTC).replace(microsecond=0)
    checked_at = timestamp(now)
    if state["checked_at"] and parse_timestamp(state["checked_at"]) > now:
        raise InvalidData("Archive check time is later than the current clock")
    started = parse_timestamp(state["started_at"], nullable=True)
    items = {item["id"]: item for item in state["items"]}
    candidates = {}
    failed = 0
    successful = 0
    added = 0
    state["checked_at"] = checked_at
    for source in sources:
        handle = source["handle"]
        previous = state["sources"].get(handle, {})
        try:
            posts = fetch_posts(handle, now)
            if any(existing is not None and existing["author"].lower() != handle.lower()
                   for post in posts
                   for existing in (items.get(post["id"]), candidates.get(post["id"]))):
                raise InvalidData("Post ID conflicts with an archived author")
            account_added = 0
            for post in posts:
                if started is None:
                    candidates[post["id"]] = post
                    continue
                old = items.get(post["id"])
                if old:
                    items[post["id"]] = {**old, "text": post["text"]}
                elif parse_timestamp(post["published_at"]) >= started:
                    account_added += 1
                    items[post["id"]] = post
            latest = max((post["published_at"] for post in posts), default=None)
            previous_latest = previous.get("latest_post_at")
            state["sources"][handle] = {
                "status": "ok",
                "checked_at": checked_at,
                "last_success_at": checked_at,
                "latest_post_at": max(filter(None, (latest, previous_latest)), default=None),
                "error": None,
            }
            successful += 1
            added += account_added
            print(f"{handle}: ok received={len(posts)} added={account_added}")
        except (InvalidData, HTTPError, URLError, TimeoutError, OSError, UnicodeError, ET.ParseError) as exc:
            state["sources"][handle] = {
                "status": "error",
                "checked_at": checked_at,
                "last_success_at": previous.get("last_success_at"),
                "latest_post_at": previous.get("latest_post_at"),
                "error": error_label(exc),
            }
            failed += 1
            print(f"{handle}: error")
    if started is None:
        if successful == len(sources) and len(candidates) >= 10:
            state["items"] = sorted_posts(candidates.values())[:10]
            state["started_at"] = checked_at
            added = len(state["items"])
        else:
            print(f"Initialization pending: candidates={len(candidates)} required=10 failed_sources={failed}")
    else:
        state["items"] = sorted_posts(items.values())
    if successful:
        state["last_success_at"] = checked_at
    validate_state(state)
    return failed, added


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--state", type=Path, default=Path("data/news.json"))
    parser.add_argument("--sources", type=Path, default=Path("data/news_sources.json"))
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--validate-only", action="store_true")
    mode.add_argument("--migrate", action="store_true", help="Migrate a valid v1 archive without network requests")
    args = parser.parse_args()
    try:
        sources = read_json(args.sources)
        validate_sources(sources)
        state = read_json(args.state)
        if args.migrate:
            migrated = migrate_state(state)
            if migrated:
                write_atomic(args.state, state)
            print(f"Archive migration: changed={int(migrated)} version=2 posts={len(state['items'])}")
            return 0
        validate_state(state)
        if args.validate_only:
            print(f"Archive valid: posts={len(state['items'])} sources={len(state['sources'])}")
            return 0
        failed, added = collect(state, sources)
        write_atomic(args.state, state)
        print(f"Collection complete: sources={len(sources)} failed={failed} added={added} total={len(state['items'])} initialized={int(state['started_at'] is not None)}")
        return 1 if failed or state["started_at"] is None else 0
    except (InvalidData, OSError, UnicodeError, json.JSONDecodeError) as exc:
        reason = str(exc) if isinstance(exc, InvalidData) else type(exc).__name__
        print(f"Collection stopped: {reason}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
