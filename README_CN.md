<p align="center"><strong>dsh-research</strong></p>

# 科研插件市场，直接从插件页打开

[English](README.md) | 中文

[![npm](https://img.shields.io/npm/v/dsh-research?label=npm)](https://www.npmjs.com/package/dsh-research) [![dsh-plugin](https://img.shields.io/badge/topic-dsh--plugin-blue)](https://github.com/topics/dsh-plugin) ![license](https://img.shields.io/badge/license-MIT-green)

精选的科研插件市场：在 **插件 → 已安装 → dsh-research** 中直接打开，也保留设置侧边栏的**「科研插件」**页面，列出人工挑选的文献检索、文献管理、写作与评审类插件，**点「安装」直接装进你正在运行的 profile**。

桌面端：在 **插件 → 添加插件** 中输入 `dsh-research`。更新时使用宿主插件管理器里的更新操作。

Web 端：

```sh
dsh plugin --profile web add dsh-research
```

安装后按宿主提示启用或重启，然后打开 **插件 → 已安装 → dsh-research**。也可以使用 **设置 → 科研插件**；旧版 Harness 继续使用这个设置入口。

## dsh-research.com

面板背后的这份目录，在 **[dsh-research.com](https://dsh-research.com)** 上也能看：同一份名单，浏览器里打开 [/plugins](https://dsh-research.com/plugins/) 就是。每条写清它能做什么、哪里做不到；另有一篇上手教程，从一台什么都没装的机器讲到一份能放的幻灯片。网站由一个 JSON 文件生成，面板拉的也是同一个文件，两边不会各说各的。

## 为什么要有它

官方市场已经能装社区注册表里的任何插件，而且做得很好。它做不到的是告诉一个研究生：一千一百个插件里，哪几个是给你的。这件事才是这个插件在做的。

## 点「安装」时到底发生了什么

新版 Harness 通过宿主原生插件管理器安装、更新和卸载；桌面端的 `desktop` profile 由 Electron 管理，不使用 CLI 修改。安装固定到目录中的版本，更新使用宿主提供的更新及回滚流程。只有宿主报告需要重启时，页面才提示退出并重新打开应用。

操作通过宿主经过身份认证的、仅限所有者的接口执行，保留目录白名单和并发操作保护。`Origin` 校验没有放宽；桌面端转发请求省略该请求头时，由宿主负责认证和来源检查。

旧版 Web 宿主继续使用带同源校验的 CLI 路径。原生管理仅操作当前运行的 profile；请不要配置指向其他 profile 的覆盖值。桌面端的复制按钮复制带版本的包名，可粘贴到宿主的「添加插件」中。

配置 `allowInstall: false` 可以让面板退化成只读目录。

## 配置

组合包插入一行（`id: research-market`）。在 profile 的 `cordis.patch.yml` 里覆盖（patch 会整体替换 `config`，保留的键要一起写）：

```yaml
- id: research-market
  config:
    catalogUrl: https://dsh-research.com/v1/market.json
    # profile 默认取当前运行环境，桌面端无需设置
    allowInstall: true
    cacheSeconds: 900
    timeoutMs: 8000
```

`catalogUrl` 接受任何实现了 [DSH Community Market 目录源契约](https://github.com/anywhere-labs/deepseek-harness-desktop/blob/master/dsh-community-market/docs/catalog-provider-contract.md)的端点。指向你自己的，面板就列你的。

## 说明

- 面板里的名单和 [dsh-research.com/plugins](https://dsh-research.com/plugins/) 上的是同一份，由同一个 `market.json` 生成。**没读过的不收**：用我们画的按钮去装别人的包，出了问题用户第一个找的会是我们。
- 进程层改编自 [dsh-market](https://github.com/dsh-market/dsh-market)（MIT）。它替我们踩明白了四件事：`ctx.shell` 写不了 profile（那是 Agent 沙箱）、macOS 从 Dock 启动时 PATH 里没有 Homebrew、pnpm v10 无 TTY 时不设 `CI` 会永久卡死、Windows 上 `dsh` 是 `.cmd` shim。
- 安装失败会保留宿主返回的诊断；需要批准依赖构建脚本时，请在宿主插件管理器中处理。

## 许可证

MIT
