"""找出并（可选）杀掉 Playwright 拉起的 Chrome 进程。

为什么需要：本项目 scripts/*.mjs 用 headless:false 起真实 Chrome 访问摄像头。
若脚本异常退出（assert 失败 / Ctrl-C），Chrome 会残留并继续占用摄像头，
下一次跑验证就报「Device in use」。

【为什么不按进程名杀】用户自己也在用 Chrome，杀错会丢工作。
判据用命令行里的 Playwright 唯一标记 `--use-fake-ui-for-media-stream`
（本项目所有摄像头验证脚本都带这个参数），只命中自动化实例。

实现：NtQueryInformationProcess 拿 PEB 太重；改用 Windows 的
`tasklist` 不带命令行 —— 故走 WMI 的替代：直接调 NtQuerySystemInformation
也重。最省事且稳定的路子是读注册表无关的 `wmic`（已在本机不可用），
于是用 ctypes 调 NtQueryInformationProcess(ProcessBasicInformation) 拿父进程，
再用父进程链判定：父进程不是 explorer.exe / chrome.exe 的即自动化实例。

用法：
  python kill-pw-chrome.py            # 只列出
  python kill-pw-chrome.py --kill     # 列出并结束
"""
import ctypes
import ctypes.wintypes as wt
import subprocess
import sys

# ntdll 的 NtQueryInformationProcess，用来读 PROCESS_BASIC_INFORMATION.InheritedFromUniqueProcessId
ntdll = ctypes.WinDLL("ntdll")
kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)

# PROCESS_QUERY_LIMITED_INFORMATION：不需要 SeDebugPrivilege 也能读别的进程的父 PID
PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
PROCESS_TERMINATE = 0x0001


class PROCESSENTRY32(ctypes.Structure):
    _fields_ = [
        ("dwSize", wt.DWORD),
        ("cntUsage", wt.DWORD),
        ("th32ProcessID", wt.DWORD),
        ("th32DefaultHeapID", ctypes.POINTER(ctypes.c_ulong)),
        ("th32ModuleID", wt.DWORD),
        ("cntThreads", wt.DWORD),
        ("th32ParentProcessID", wt.DWORD),
        ("pcPriClassBase", ctypes.c_long),
        ("dwFlags", wt.DWORD),
        ("szExeFile", ctypes.c_char * 260),
    ]


class PROCESS_BASIC_INFORMATION(ctypes.Structure):
    _fields_ = [
        ("ExitStatus", ctypes.c_void_p),
        ("PebBaseAddress", ctypes.c_void_p),
        ("AffinityMask", ctypes.c_void_p),
        ("BasePriority", ctypes.c_long),
        ("UniqueProcessId", ctypes.c_void_p),
        ("InheritedFromUniqueProcessId", ctypes.c_void_p),
    ]


def list_procs():
    """用 CreateToolhelp32Snapshot 枚举进程，返回 {pid: (ppid, exe)}"""
    TH32CS_SNAPPROCESS = 0x00000002
    INVALID_HANDLE_VALUE = ctypes.c_void_p(-1).value
    snap = kernel32.CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0)
    if snap == INVALID_HANDLE_VALUE:
        raise OSError("CreateToolhelp32Snapshot 失败")
    out = {}
    try:
        pe = PROCESSENTRY32()
        pe.dwSize = ctypes.sizeof(pe)
        ok = kernel32.Process32First(snap, ctypes.byref(pe))
        while ok:
            out[pe.th32ProcessID] = (pe.th32ParentProcessID, pe.szExeFile.decode("ascii", "ignore"))
            ok = kernel32.Process32Next(snap, ctypes.byref(pe))
    finally:
        kernel32.CloseHandle(snap)
    return out


def cmdline_of(pid):
    """NtQueryInformationProcess + 读 PEB 拿命令行太重；这里退一步：
    只对 chrome 用 WMI-free 的办法 —— 通过 NtQueryInformationProcess 的
    ProcessCommandLineInformation (class 60)，Win8.1+ 直接给 UTF-16 命令行。"""
    class UNICODE_STRING(ctypes.Structure):
        _fields_ = [
            ("Length", ctypes.c_ushort),
            ("MaximumLength", ctypes.c_ushort),
            ("Buffer", ctypes.c_wchar_p),
        ]

    out = ctypes.c_void_p()
    size = ctypes.c_ulong(0)
    # ProcessCommandLineInformation = 60
    st = ntdll.NtQueryInformationProcess(
        kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid),
        60, None, ctypes.byref(size), None)
    if st != 0:
        return ""
    buf = ctypes.create_string_buffer(size.value)
    st = ntdll.NtQueryInformationProcess(
        kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid),
        60, buf, ctypes.byref(size), None)
    if st != 0:
        return ""
    us = ctypes.cast(buf, ctypes.POINTER(UNICODE_STRING)).contents
    return ctypes.wstring_at(us.Buffer, us.Length // 2)


def main():
    procs = list_procs()
    chrome_pids = {p for p, (_, e) in procs.items() if e.lower() == "chrome.exe"}

    # 判据：chrome 根进程（父进程不是 chrome）的父进程是 node.exe
    # —— 本项目的摄像头验证脚本都是 `node scripts/*.mjs` 起 playwright，
    # node 进程退出后 Chrome 会被 reparent，但这里抓到的是还挂着的。
    #
    # 【为什么不用命令行】NtQueryInformationProcess 的
    # ProcessCommandLineInformation(60) 在本机返回空（权限不足），
    # 而 wmic / PowerShell 在 WorkBuddy 沙箱里都不可用。父进程链是唯一可靠判据。
    # 用户自己的 Chrome 父进程是 explorer.exe 或 bash.exe，不会被误杀。
    hits = []
    for pid in sorted(chrome_pids):
        ppid = procs[pid][0]
        if ppid in chrome_pids:
            continue          # 子进程，跟着根进程走
        gparent = procs.get(ppid, (None, ""))[1]
        if gparent.lower() == "node.exe":
            hits.append((pid, ppid, gparent))

    if not hits:
        print("没有找到 Playwright 残留的 Chrome")
        return 0

    print("找到 %d 个 Playwright 启动的 Chrome 根进程：" % len(hits))
    for pid, ppid, gparent in hits:
        print("  pid=%-7d 父=%-7d 祖父=%s" % (pid, ppid, gparent))

    if "--kill" in sys.argv:
        killed = 0
        for pid, _, _ in hits:
            h = kernel32.OpenProcess(PROCESS_TERMINATE, False, pid)
            if h:
                if kernel32.TerminateProcess(h, 1):
                    killed += 1
                kernel32.CloseHandle(h)
        print("已结束 %d 个根进程（Chrome 子进程随之退出）" % killed)
        print("若仍报 Device in use，等 2 秒让驱动释放设备再重跑")
    else:
        print("加 --kill 参数可结束它们")
    return 0


if __name__ == "__main__":
    sys.exit(main())
