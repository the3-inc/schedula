"""実コンテナー内で3教材の公開APIと独立検証を確認する。"""

import argparse
import hashlib
import json
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit
from urllib.request import Request, urlopen

from web.handler import PREFIX, lambda_handler
from web.lessons import PUBLIC_IDS, SAMPLES, sample
from web.paths import BASE, SITE


class Page(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.links, self.ids = [], set()
        self.feed(text)

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if "id" in attrs:
            self.ids.add(attrs["id"])
        for name in ("href", "src"):
            if name in attrs:
                self.links.append(attrs[name])


def check_pages(load):
    """製品所有の静的参照を検査する。会社との往復は会社側の接続検査が担当する。"""
    cache = {}

    def get(path):
        if path not in cache:
            cache[path] = load(path)
        return cache[path]

    lessons = {item["id"] for item in json.loads(get(BASE + "demo/samples/lessons.json")[1])}
    for path in (BASE + "demo/", BASE + "docs/"):
        media, text = get(path)
        assert "text/html" in media, path
        for link in Page(text).links:
            target = urlsplit(urljoin(SITE + path, link))
            if link in {
                "https://policies.google.com/technologies/partner-sites",
                "https://tools.google.com/dlpage/gaoptout",
                "https://github.com/the3-inc/schedula",
                "https://pypi.org/project/shift-schedula/0.2.0/",
            }:
                continue
            if target.scheme == "mailto":
                continue
            assert target.scheme == urlsplit(SITE).scheme, link
            assert target.netloc == urlsplit(SITE).netloc, link
            # 会社トップ・製品紹介は会社の成果物。製品の初回公開を会社公開に依存させない。
            if target.path in {"/", BASE}:
                continue
            assert target.path.startswith(BASE), link
            media, body = get(target.path)
            if not target.path.endswith("/"):
                assert "text/html" not in media, link
            if target.fragment:
                ids = Page(body).ids | (lessons if target.path == BASE + "demo/" else set())
                assert target.fragment in ids, link


def check_public_pages():
    def load(path):
        with urlopen(SITE + path, timeout=15) as received:
            if received.geturl() != SITE + path:
                raise ValueError(f"静的参照が別のURLへ転送されました: {path}")
            return received.headers.get("Content-Type", ""), received.read().decode(
                "utf-8", errors="replace"
            )

    check_pages(load)
    print("public pages: static references and lesson fragments verified")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--public", action="store_true")
    options = parser.parse_args()
    if options.public:
        check_public_pages()
    for lesson_id in PUBLIC_IDS:
        value = sample(lesson_id)
        if lesson_id == "verify":
            value = {
                "request": value,
                "solution": json.loads((SAMPLES / "manual-verify.solution.json").read_text()),
            }
        body = json.dumps(value, ensure_ascii=False)
        host = "example.lambda-url.ap-northeast-1.on.aws"
        if not options.public:
            result = lambda_handler(
                {
                    "rawPath": PREFIX + ("verify-json" if lesson_id == "verify" else "solve-json"),
                    "requestContext": {"http": {"method": "POST"}, "domainName": host},
                    "headers": {
                        "host": host,
                        "origin": SITE,
                        "content-type": "application/json",
                        "x-demo-lesson": lesson_id,
                        "x-amz-content-sha256": hashlib.sha256(body.encode()).hexdigest(),
                    },
                    "body": body,
                },
                None,
            )
        if options.public:
            request = Request(
                SITE + PREFIX + ("verify-json" if lesson_id == "verify" else "solve-json"),
                data=body.encode(),
                headers={
                    "Content-Type": "application/json",
                    "Origin": SITE,
                    "X-Demo-Lesson": lesson_id,
                    "X-Amz-Content-Sha256": hashlib.sha256(body.encode()).hexdigest(),
                },
            )
            with urlopen(request, timeout=40) as received:
                result = {"statusCode": received.status, "body": received.read().decode()}
        assert result["statusCode"] == 200, result
        assert json.loads(result["body"])["verification"]["valid"], result
        print(f"{lesson_id}: verified")
