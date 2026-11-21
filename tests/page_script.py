"""R26 對回應內的 JavaScript 做有限的靜態檢查。"""

import re
from collections.abc import Sequence
from typing import Final
from urllib.parse import urljoin, urlsplit

# 字串及正規表示式保持為單一詞元。避免把範例文字當成 DOM 操作。
_TOKENS: Final = re.compile(
    r"""//[^\r\n]* | /\*.*?\*/ | "(?:\\.|[^"\\])*" | '(?:\\.|[^'\\])*'
    | \x60(?:\\.|[^\\\x60])*\x60 | /(?![/*])(?:\\. | \[(?:\\.|[^\]\\\n])*\] | [^/\\[\n])+/[a-z]*
    | [\w$]+ | \.\.\. | \S""",
    re.DOTALL | re.VERBOSE,
)


def _literal(token: str) -> str | None:
    if (
        token.startswith(('"', "'", "`"))
        and "\\" not in token
        and not (token.startswith("`") and "${" in token)
    ):
        return token[1:-1]
    return None


def _module_target(tokens: list[str], index: int, module: bool) -> str | None:
    # import("…") 也能出現在傳統腳本中。只判斷完整的字面引數。
    if tokens[index + 1] == "(":
        return _literal(tokens[index + 2]) if tokens[index + 3] in {")", ","} else None
    if not module:
        return None
    if tokens[index] == "import" and (target := _literal(tokens[index + 1])) is not None:
        return target
    # import … from 或 export {…} / * from。遇到其他語句邊界即停止。
    for pos in range(index + 1, len(tokens) - 1):
        word = tokens[pos]
        if word == "from" and (target := _literal(tokens[pos + 1])) is not None:
            return target
        if not (
            word.replace("$", "_").isidentifier()
            or word in {"*", "{", "}", ","}
            or _literal(word) is not None
        ):
            break
    return None


def check_scripts(
    scripts: Sequence[tuple[bool, str]], page_url: str, has_script_src: bool, import_map: bool
) -> None:
    """R26 檢查可直接辨識的 API 與載入目標。動態名稱及事件分派交由瀏覽器驗收。"""
    names: set[str] = set()
    indirect = has_script_src or import_map
    listener_types: set[str] = set()
    literal_listeners = True
    origin = urlsplit(page_url)
    for module, source in scripts:
        words = [w for w in _TOKENS.findall(source) if not w.startswith(("//", "/*"))]
        # 補空詞元以統一處理腳本結尾與開頭的相鄰詞元。
        tokens = [*words, "", "", "", ""]
        bare_fetch = all(
            tokens[i + 1] == "(" and tokens[i - 1] != "function"
            for i, word in enumerate(words)
            if word == "fetch" and tokens[i - 1] != "."
        )
        for i, word in enumerate(words):
            name = _literal(word) or word
            names.add(name)
            prev = tokens[i - 1]
            if (word.startswith("`") and "${" in word) or word.startswith("/"):
                # 插值可能含程式。帶斜線的片段也可能是除法運算式。
                # 只收集可能的名稱。此處的文字不能用來認定違規。
                names.update(re.findall(r"[\w$]+", word))
                if "addEventListener" in word:
                    literal_listeners = False
                if "[" in word:
                    indirect = True
            if name == "addEventListener":
                call = i + 2 if tokens[i + 1] == "]" else i + 1
                event = _literal(tokens[call + 1])
                if tokens[call] == "(" and event is not None and tokens[call + 2] == ",":
                    listener_types.add(event)
                else:
                    literal_listeners = False
            if word == "innerHTML" and prev == ".":
                raise AssertionError("頁面腳本直接使用了 innerHTML")
            if word == "[":
                member = _literal(tokens[i + 1])
                if (
                    member == "innerHTML"
                    and tokens[i + 2] == "]"
                    and (tokens[i + 3] == "=" or tokens[i + 3 : i + 5] == ["+", "="])
                ):
                    raise AssertionError("頁面腳本寫入了 innerHTML")
                if (prev.isidentifier() or prev in {")", "]", ".", "{", ","}) and (
                    member is None or tokens[i + 2] != "]"
                ):
                    indirect = True
            if word in {"import", "export"} and prev != "." and not import_map:
                target = _module_target(tokens, i, module)
                if target is not None:
                    assert target.lower().startswith(("data:", "#")), f"腳本載入外部模組 {target}"
                indirect = True
            if word == "fetch" and tokens[i + 1] == "(" and tokens[i + 3] in {")", ","}:
                target = _literal(tokens[i + 2])
                global_fetch = (
                    tokens[i - 2] in {"window", "globalThis", "self"} if prev == "." else bare_fetch
                )
                if target and global_fetch:
                    url = urlsplit(urljoin(page_url, target))
                    if url.scheme in {"http", "https"}:
                        assert (url.scheme, url.netloc) == (origin.scheme, origin.netloc), target
        # 動態查找或內嵌程式碼可能提供方法名稱。無法從字面排除時交由瀏覽器驗收。
        indirect |= bool({"eval", "Function", "Reflect", "Proxy"} & names)
        indirect |= any(r"\u" in word or r"\x" in word for word in words)
    if not indirect:
        assert {"textContent", "addEventListener", "close"} <= names
        if literal_listeners:
            assert {"run_finished", "reset"} <= listener_types
