import type { StageDef, Scenario } from "../../src/domain";
// R4、R5 的獨立期望值，保留表格順序。
export const stages: readonly StageDef[] = [
  {
    id: "prepare",
    name: "準備環境",
    tasks: [
      {
        id: "check_os",
        name: "檢查作業系統",
        log_lines: 8,
      },
      {
        id: "check_disk",
        name: "檢查磁碟空間",
        log_lines: 6,
      },
      {
        id: "check_deps",
        name: "檢查相依套件",
        log_lines: 12,
      },
    ],
  },
  {
    id: "download",
    name: "下載套件",
    tasks: [
      {
        id: "fetch_manifest",
        name: "取得套件清單",
        log_lines: 6,
      },
      {
        id: "download_packages",
        name: "下載套件",
        log_lines: 30,
      },
      {
        id: "verify_checksum",
        name: "驗證雜湊",
        log_lines: 10,
      },
    ],
  },
  {
    id: "install",
    name: "安裝",
    tasks: [
      {
        id: "extract",
        name: "解壓縮",
        log_lines: 20,
      },
      {
        id: "copy_files",
        name: "複製檔案",
        log_lines: 40,
      },
      {
        id: "register",
        name: "註冊元件",
        log_lines: 8,
      },
    ],
  },
  {
    id: "configure",
    name: "設定",
    tasks: [
      {
        id: "write_config",
        name: "寫入設定",
        log_lines: 10,
      },
      {
        id: "set_permissions",
        name: "設定權限",
        log_lines: 6,
      },
      {
        id: "start_service",
        name: "啟動服務",
        log_lines: 12,
      },
    ],
  },
];
export const cases: readonly Scenario[] = [
  {
    id: "success",
    label: "全部成功",
    fail_task_id: null,
    fail_after_lines: null,
    error_code: null,
    message: null,
    hint: null,
  },
  {
    id: "network_unreachable",
    label: "無法連線到套件伺服器",
    fail_task_id: "fetch_manifest",
    fail_after_lines: 0,
    error_code: "E_NETWORK",
    message: "無法連線到套件伺服器 packages.example.com:443",
    hint: "請檢查網路、Proxy 與防火牆設定後重新安裝",
  },
  {
    id: "dependency_missing",
    label: "缺少相依套件",
    fail_task_id: "check_deps",
    fail_after_lines: 7,
    error_code: "E_DEPENDENCY",
    message: "缺少相依套件 libssl（需要 >= 3.0）",
    hint: "請先安裝 libssl 3.0 以上版本後重新安裝",
  },
  {
    id: "checksum_mismatch",
    label: "套件雜湊值不符",
    fail_task_id: "verify_checksum",
    fail_after_lines: 9,
    error_code: "E_CHECKSUM",
    message: "套件 core-2.4.1.pkg 的 SHA-256 雜湊值不符",
    hint: "請清除下載快取後重新下載，或改用其他鏡像站",
  },
  {
    id: "disk_full",
    label: "磁碟空間不足",
    fail_task_id: "copy_files",
    fail_after_lines: 23,
    error_code: "E_DISK_FULL",
    message: "磁碟空間不足，/opt 剩餘 0 MB",
    hint: "請釋放至少 2 GB 空間後重新安裝",
  },
  {
    id: "permission_denied",
    label: "權限不足",
    fail_task_id: "set_permissions",
    fail_after_lines: 3,
    error_code: "E_PERMISSION",
    message: "無法寫入 /etc/app：權限不足",
    hint: "請以系統管理員權限執行安裝",
  },
  {
    id: "service_timeout",
    label: "服務啟動逾時",
    fail_task_id: "start_service",
    fail_after_lines: 12,
    error_code: "E_SERVICE_TIMEOUT",
    message: "服務 app-daemon 在 30 秒內沒有回應",
    hint: "請查看服務 log，並確認連接埠 8443 沒有被佔用",
  },
];
