## 选择你的安装包

| 电脑                                     | 下载文件                                                                                                                                | 安装方式                         |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Mac · Apple Silicon · macOS 13+          | [下载 macOS 安装包（.dmg）](https://github.com/lioneltchami/Headspace/releases/download/v2.0.2/Headspace-2.0.2-arm64.dmg)               | 打开 DMG，将应用拖入「应用程序」 |
| Windows 10/11 · Intel / AMD 64 位（x64） | [下载 Windows 安装包（.exe）](https://github.com/lioneltchami/Headspace/releases/download/v2.0.2/Headspace-2.0.2-windows-x64-setup.exe) | 双击 EXE，按安装向导完成安装     |

`.sha256` 是对应文件的完整性校验码，不是安装包。官网提供 macOS 与 Windows 两个下载入口。

## 2.0.2 — 菜单栏托盘图标

- macOS 菜单栏托盘改为 Headspace 标记的模板剪影，与应用图标一致。
- 安装包与 Homebrew cask 随本版本重建。

## 2.0.1 — 新图标

- 应用图标、菜单栏托盘、官网 favicon 与分享图更换为新的黑色 notch 切割造型标记。
- 安装包与 Homebrew cask 随本版本重建。

## 2.0.0 — TO-DO Panel 更名为 Headspace

- 应用更名为 Headspace，应用标识改为 `com.lioneltchami.headspace`；仓库与官网迁至 [lioneltchami/Headspace](https://github.com/lioneltchami/Headspace) 与 <https://lioneltchami.github.io/Headspace/>。
- 数据目录改为 `Headspace`。首次启动时若 `Headspace` 目录不存在，会把旧的 `Dynamic Panel` 目录复制一次；已有的 `Headspace` 目录绝不覆盖，旧目录保留作备份。LocalStorage 数据格式不变。
- 因应用标识变更：macOS 会重新请求相机、麦克风、辅助功能与自动化权限；保险库与 DashScope 密钥使用系统加密，可能需要重新输入。
- Windows 不会覆盖升级：安装 Headspace 并确认数据后，再卸载旧的「TO-DO Panel」。
- 界面、菜单、通知、官网与文档全面改为英文；渲染层脚本拆分为独立功能模块（无打包步骤）。

## 首次安装

Mac 采用 ad-hoc 签名，不进行 Apple 公证。若首次被系统拦截，打开「系统设置 → 隐私与安全性」并点击「仍要打开」。

Windows 安装包目前没有商业代码签名，首次运行可能显示「Windows 已保护你的电脑」。请确认来自本仓库 Release 并核对校验码，再通过「更多信息 → 仍要运行」继续。安装在当前用户目录，无需管理员权限。受组织策略管理的电脑可能需要管理员批准。

Windows 使用 GitHub 托管 Windows runner 验证安装、程序启动、核心 IPC、系统加密、快捷键、录音/摄像头模拟设备生命周期、重新安装数据保留与卸载。物理摄像头/麦克风、Windows 10 实机、多显示器硬件与特定安全软件不属于此次自动测试覆盖范围。
