import { readFile } from "node:fs/promises";
import ts from "typescript";
import { expect, test } from "vitest";
import { HTTP, useWorker } from "../helpers/server";

const server = useWorker();
const inline = (target: string) => {
  expect(target.trim()).toMatch(/^(?:$|#|data:)/i);
};

function checkSrcset(source: string): void {
  // 資料 URI 可以含有逗號，先讀取 URL，再略過寬度或像素密度描述。
  let rest = source.trim();
  while (rest) {
    const url = /^\S+/.exec(rest)?.[0] ?? "";
    inline(url.replace(/,+$/, ""));
    rest = rest.slice(url.length).trimStart();
    if (!url.endsWith(",")) {
      const next = rest.indexOf(",");
      rest = next < 0 ? "" : rest.slice(next + 1).trimStart();
    }
  }
}

function checkCss(source: string): void {
  const css = source.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const match of css.matchAll(/\burl\(\s*(["']?)(.*?)\1\s*\)|@import\s*["']([^"']+)/gis))
    inline(match[2] ?? match[3] ?? "");
}
function checkScript(source: string, listeners: Set<string>): void {
  const program = ts.createSourceFile(
    "page.js",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  function visit(node: ts.Node): void {
    if (ts.isPropertyAccessExpression(node)) expect(node.name.text).not.toBe("innerHTML");
    if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression))
      expect(node.argumentExpression.text).not.toBe("innerHTML");
    if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier))
      inline(node.moduleSpecifier.text);
    if (ts.isCallExpression(node)) {
      const target = node.arguments[0];
      const callee = node.expression;
      const method = ts.isPropertyAccessExpression(callee)
        ? callee.name.text
        : ts.isElementAccessExpression(callee) && ts.isStringLiteralLike(callee.argumentExpression)
          ? callee.argumentExpression.text
          : ts.isIdentifier(callee)
            ? callee.text
            : undefined;
      if (method === "addEventListener") {
        // 動態註冊的名稱交由瀏覽器驗收；字面可見的名稱可在此直接核對。
        listeners.add(target && ts.isStringLiteralLike(target) ? target.text : "*");
      }
      if (target && ts.isStringLiteralLike(target)) {
        if (node.expression.kind === ts.SyntaxKind.ImportKeyword) inline(target.text);
        if (
          ts.isIdentifier(node.expression) &&
          node.expression.text === "fetch" &&
          /^https?:|^\/\//i.test(target.text)
        )
          expect(new URL(target.text, server.url).origin).toBe(server.url);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(program);
}
test("R26 AC12 靜態首頁的元素、內嵌資源與產物位元組", { timeout: 20_000 }, async () => {
  const [workerPage, pythonPage] = await Promise.all([
    readFile(new URL("../../public/index.html", import.meta.url)),
    readFile(new URL("../../../app/static/index.html", import.meta.url)),
  ]);
  expect(workerPage.equals(pythonPage)).toBe(true);
  const response = await server.request("/");
  expect(response.status).toBe(HTTP.ok);
  expect(response.headers.get("content-type")?.toLowerCase()).toMatch(
    /^text\/html\s*;\s*charset="?utf-8"?$/,
  );
  const html = await response.text();
  const ids = new Map<string, string[]>();
  const scripts: string[] = [];
  const listeners = new Set<string>();
  const markup = html
    .replace(
      /<(script|style)\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi,
      (_whole: string, tag: string, attrs: string, body: string) => {
        if (tag.toLowerCase() === "style") checkCss(body);
        else if (!/\btype\s*=\s*["'](?:application\/json|importmap)["']/i.test(attrs)) {
          scripts.push(body);
          checkScript(body, listeners);
        }
        return "<" + tag + attrs + ">";
      },
    )
    .replace(/<!--[\s\S]*?-->/g, "");
  for (const match of markup.matchAll(/<([\w:-]+)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/g)) {
    const tag = match[1]?.toLowerCase();
    const attrs = new Map<string, string>();
    for (const attr of (match[2] ?? "").matchAll(
      /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g,
    )) {
      if (attr[1]) attrs.set(attr[1].toLowerCase(), attr[2] ?? attr[3] ?? attr[4] ?? "");
    }
    const id = attrs.get("id");
    if (id && tag) ids.set(id, [...(ids.get(id) ?? []), tag]);
    for (const name of ["src", "poster"]) if (attrs.has(name)) inline(attrs.get(name) ?? "");
    if (tag === "object") inline(attrs.get("data") ?? "");
    if (
      tag === "link" &&
      /\b(stylesheet|icon|preload|prefetch|modulepreload|manifest)\b/i.test(attrs.get("rel") ?? "")
    )
      inline(attrs.get("href") ?? "");
    if (tag === "use" || tag === "image")
      inline(attrs.get("href") ?? attrs.get("xlink:href") ?? "");
    for (const name of ["srcset", "imagesrcset"]) checkSrcset(attrs.get(name) ?? "");
    checkCss(attrs.get("style") ?? "");
  }
  expect(ids.get("scenario")).toEqual(["select"]);
  for (const id of ["install-btn", "run-status", "stage-list", "task-list", "follow-btn"])
    expect(ids.get(id)).toHaveLength(1);
  if (!listeners.has("*")) {
    expect(listeners.has("run_finished")).toBe(true);
    expect(listeners.has("reset")).toBe(true);
  }
  const js = scripts.join("\n");
  for (const name of ["textContent", "addEventListener", "close", "run_finished", "reset"])
    expect(js).toContain(name);
});
