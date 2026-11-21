1. **T4.4b: PASS** (0 deviations). Two caveats on how I ran the checks: A2 used a fault-injection proxy instead of a literal stop-and-reload (details under A2), and the Check A request sequences come partly from `fetch` hooks I injected in the page, because `read_network_requests` only starts tracking after its first call.

2. **Check A: R27 errors and retry**

   **A1: `EventSource` becomes `CLOSED` while running — OK**
   - Steps:
     - Server A on `:18500` with `a.db`. I opened the page, clicked install, and the run was streaming (`第 1 輪（全部成功）：安裝執行中…`).
     - I stopped server A, then started server B on the same port with an empty `b.db`.
   - `#run-status` and timing (page clock):

     | Time | `#run-status` |
     |---|---|
     | 10.86 s | `連線中斷，瀏覽器重新連線中…` (server A gone, `EventSource` CONNECTING) |
     | 13.89 s | `SSE 連線已關閉，3 秒後重試` (server B's `404` closed the `EventSource`) |
     | 16.895 s | `GET /install` fetched, 3.0 s after the error |
     | 16.903 s | `尚未執行過安裝` |

   - Server B's access log shows `GET /install/events?last_event_id=1.4` → `404`, then `GET /install` → `404`. There was no `/install/logs` request, since the `404` means no run.
   - End state: 4 stages and 3 tasks (the stage shown) all `pending`, and `#install-btn` enabled.

   **A2: sync-flow error that is not a `409` — OK**
   - Steps:
     - A literal "stop the server and reload" can't work, because the page itself wouldn't load. I used a fault-injection proxy on `:18501` instead.
     - The proxy forwards everything to the backend except `GET /install`, where it resets the TCP connection while a flag file exists. The backend was up with a finished run (`b.db`).
     - I loaded the page through the proxy. Plan and scenarios loaded fine, then `GET /install` failed with a network error.
   - `#run-status`: `同步失敗：無法連線到伺服器，3 秒後重試`.
   - `GET /install` was retried at 2.77 s, 5.77 s and 8.78 s (every 3.0 s), and the text was re-shown each time.
   - I removed the flag without reloading. The next retry (at about 14.8 s) succeeded, and the page showed `第 1 輪（全部成功）：安裝完成，全部成功` with all 4 stages `succeeded`. It recovered by itself.
   - I did not run the literal variant of stopping the server and re-rendering the page with the server down. That would only exercise the `init()` plan-load retry, not the sync flow.

   **A3: stop the server mid-run and restart on the same DB — facts only**
   - Steps: I clicked install (run 2) and, about 4 s in, stopped the server. About 5 s later I restarted it on the same `b.db`.
   - Startup recovery logged `recovered interrupted run 2`.
   - Timeline after the stop:

     | Time | `#run-status` |
     |---|---|
     | 5.6 s | `連線中斷，瀏覽器重新連線中…` |
     | 8.6 s, 11.6 s | same text, repeated (browser `EventSource` auto-reconnect attempts about every 3 s) |
     | 14.6 s | `第 2 輪（全部成功）：安裝失敗（E_INTERRUPTED）伺服器在安裝途中停止` |

   - No `SSE 連線已關閉…` message appeared, and no new `GET /install` was requested after the initial sync. The only fetches in the page log were the initial `POST /install`, `GET /install` and `GET /install/logs`.
   - After the restart, the server log shows a single `GET /install/events?last_event_id=2.4` → `200`. That is the `EventSource` auto-reconnect; the earlier attempts were refused while the server was down, so they aren't in the log. The page then received the recovery events and finished.
   - End state: stage 1 `failed`, the other three `pending`, `#install-btn` enabled.

3. **Check B: R26 text safety — OK**
   - A stdlib mock on `:18502` served the real `app/static/index.html`. Every string field (stage, task, scenario label, log text including an `error`-level line, and the failed task's `message` and `hint`) contained `<b>BOLD</b><img src=x onerror="document.title='PWNED'">`. `/install/events` returned `204`.
   - The markup showed as literal text everywhere: `#scenario` option, stage button, task head, both log lines, the error box (`錯誤代碼：E_X` / `原因：MSG …` / `排除建議：HINT …`) and `#run-status` (`第 1 輪（SC <b>BOLD</b>…）：安裝失敗（E_X）MSG …`).
   - `querySelectorAll('b,img')` returned 0 inside `#stage-list`, `#task-list`, `#scenario`, `#run-status`, `header`, `main` and across the whole document.
   - `document.title` stayed `安裝進度`, not `PWNED`.

4. **Deviations:** none.

5. **Cleanup**
   - My tabs are closed: the one I created and the empty tab that `tabs_context_mcp` created. The tab group is gone.
   - Servers on 18500, 18501 and 18502 were stopped with `kill`. `lsof -iTCP:18500-18599 -sTCP:LISTEN` printed nothing and exited 1, so the range is free.
   - `./.t44b-tmp/` is deleted (`ls` confirms), and `./install.db` does not exist.
