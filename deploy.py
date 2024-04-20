import os
import random

from subprocess import run
from pathlib import Path

ON_CF = os.getenv("CF_PAGES") == "1"

if ON_CF:
    print("Running on Cloudflare Pages, trying to git fetch --all")
    run(["git", "fetch", "--all"], check=False)


def get_env_info() -> dict[str, str]:
    # 读取环境变量
    env_info = {}
    # git branch
    branch = run(
        ["git", "branch", "--show-current"],
        capture_output=True,
        text=True,
        encoding="utf-8",
    ).stdout
    env_info["branch"] = branch.strip()
    # git commit hash
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
            # 如果是, 则将颜色替换为 random(这里是为了区分不同的分支, 并且颜色相对固定)
            file_branch_name = file.parent.name
            randomer = random.Random(file_branch_name)
            hash_color = randomer.randint(0, 0xFFFFFF)
            border = border_template.format(f"#{hash_color:06x}")

            # git 信息:
            version_info = f"{file_branch_name}/{branch}:{tag}<br/>{message}"
            marker = marker_template.format(version_info)

            print(f"Branch: {file_branch_name}\n{border}\n{marker}\n")

        else:
            # 淡绿色!
            border = border_template.format("greenyellow")

            # git 信息:
            version_info = f"{branch}:{tag}"
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
