import os, sys, subprocess

# 找到 MSVC 的 link.exe
link_paths = [
    r"C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Tools\MSVC\14.43.34808\bin\Hostx64\x64\link.exe",
    r"C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.43.34808\bin\Hostx64\x64\link.exe",
]
link_exe = None
for p in link_paths:
    if os.path.exists(p):
        link_exe = p
        break

if not link_exe:
    print("ERROR: 找不到 MSVC link.exe，请安装 Visual Studio Build Tools")
    sys.exit(1)

print(f"使用 link.exe: {link_exe}")

# 设置环境变量
env = os.environ.copy()
env["CARGO_TARGET_DIR"] = r"C:\Users\Administrator\AppData\Local\Temp\tauri-target"

# 把 MSVC bin 目录放到 PATH 最前面（在 Git/usr/bin 之前）
msvc_bin = os.path.dirname(link_exe)
paths = [msvc_bin] + [p for p in env.get("PATH","").split(";") if "Git\\usr\\bin" not in p]
env["PATH"] = ";".join(paths)

# 运行 tauri build
project = r"C:\Users\Administrator\WorkBuddy\2026-05-26-09-57-28\music-tool-v2"
cmd = ["npm", "run", "tauri", "build"]
print(f"运行: {' '.join(cmd)}")
print(f"PATH 前3项: {'; '.join(paths[:3])}")
print("-" * 60)

proc = subprocess.run(cmd, cwd=project, env=env, capture_output=False, text=True)
sys.exit(proc.returncode)
