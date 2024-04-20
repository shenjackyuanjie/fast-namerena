import os

from subprocess import run
from pathlib import Path

ON_CF = os.getenv("CF_PAGES") == "1"


def get_env_info() -> dict[str, str]:
    # 读取环境变量
    env_info = {}
    # git branch
    # if on cf, read it from env: CF_PAGES_BRANCH
    if ON_CF:
        branch = os.getenv("CF_PAGES_BRANCH") or "unknown"
    else:
        branch = run(
            ["git", "branch", "--show-current"],
            capture_output=True,
            text=True,
            encoding="utf-8",
        ).stdout
    env_info["branch"] = branch.strip()
    # git commit hash
    # on cf -> get from CF_PAGES_COMMIT_SHA
    if ON_CF:
        commit = os.getenv("CF_PAGES_COMMIT_SHA") or "unknown"
    else:
        commit = run(
            ["git", "rev-parse", "HEAD"],
            capture_output=True,
            text=True,
            encoding="utf-8",
        ).stdout
    env_info["commit"] = commit.strip()
    # git commit message
    message = run(
        ["git", "log", "-1", "--pretty=%B"],
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    env_info["message"] = message.stdout.strip()
    # git tag
    if ON_CF:
        tag = os.getenv("CF_PAGES_COMMIT_TAG") or "cf"
    else:
        tag = run(
            ["git", "describe", "--tags"], capture_output=True, text=True, encoding="utf-8"
        ).stdout
    env_info["tag"] = tag.strip()
    return env_info


if __name__ == "__main__":
    # 虽然但是, 我还是决定用 python 写这个脚本

    border_raw = "/* border: 2px solid marker_color */"
    border_template = "border: 2px solid {};"
    marker_raw = '<div id="version-marker" style="display: none;"></div>'
    marker_template = '<div id="version-marker">{}</div>'

    # 读取环境变量
    env_info = get_env_info()
    tag = env_info["tag"]
    branch = env_info["branch"]
    commit = env_info["commit"]
    message = env_info["message"]

    for file in Path.cwd().rglob("index.html"):
        try:
            with open(file, "r", encoding="utf-8") as f:
                raw_content = f.read()
        except Exception as e:
            print(f"Error: {e}")
            continue
        print(f"Reading: {file}")

        # 替换内容
        # 首先判断是否是 /branch 目录下的 index.html
        if "branch" in str(file):
            # 如果是, 则将颜色替换为 hash(这里是为了区分不同的分支)
            file_branch_name = file.parent.name
            hash_color = hash(file_branch_name) & 0xFFFFFF
            border = border_template.format(f"#{hash_color:06x}")

            # git 信息:
            version_info = f"{file_branch_name}/{branch}:{tag}<br/>{message}"
            marker = marker_template.format(version_info)

            print(f"Branch: {file_branch_name}\n{border}\n{marker}\n")

        else:
            border = border_template.format("#000")

            # git 信息:
            version_info = f"{branch}:{tag.split('-')[0]}"
            marker = marker_template.format(version_info)
            print(f"Master: {border}\n{marker}\n")

        raw_content = raw_content.replace(border_raw, border).replace(
            marker_raw, marker
        )

        # 写入文件
        try:
            with open(file, "w", encoding="utf-8") as f:
                f.write(raw_content)
        except Exception as e:
            print(f"Error writing file: {e}")
            continue
