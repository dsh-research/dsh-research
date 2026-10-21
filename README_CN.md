<p align="center"><strong>dsh-research</strong></p>

# 科研插件市场，直接从插件页打开

[English](README.md) | 中文

[![npm](https://img.shields.io/npm/v/dsh-research?label=npm)](https://www.npmjs.com/package/dsh-research) [![dsh-plugin](https://img.shields.io/badge/topic-dsh--plugin-blue)](https://github.com/topics/dsh-plugin) ![license](https://img.shields.io/badge/license-MIT-green)

精选的科研插件市场：在 **插件 → 已安装 → dsh-research** 中直接打开，也保留设置侧边栏的**「科研插件」**页面，列出人工挑选的文献检索、文献管理、写作与评审类插件，**点「安装」直接装进你正在运行的 profile**。

```sh
dsh plugin --profile web add dsh-research
```

重启 DSH Desktop 或 `dsh web`，然后打开 **插件 → 已安装 → dsh-research**。也可以使用 **设置 → 科研插件**；旧版 Harness 继续使用这个设置入口。

## dsh-research.com

面板背后的这份目录，在 **[dsh-research.com](https://dsh-research.com)** 上也能看：同一份名单，浏览器里打开 [/plugins](https://dsh-research.com/plugins/) 就是。每条写清它能做什么、哪里做不到；另有一篇上手教程，从一台什么都没装的机器讲到一份能放的幻灯片。网站由一个 JSON 文件生成，面板拉的也是同一个文件，两边不会各说各的。

## 为什么要有它

官方市场已经能装社区注册表里的任何插件，而且做得很好。它做不到的是告诉一个研究生：一千一百个插件里，哪几个是给你的。这件事才是这个插件在做的。

## 点「安装」时到底发生了什么

面板替你执行 `dsh plugin --profile <你的 profile> add <包名>` —— 就是你自己会敲的那条命令。四道边界管着它：

| | |
|---|---|
| **白名单** | 浏览器可以请求任意包名，但**只有目录里有的才会被真正执行**。目录是我们发布的静态文件。 |
| **同源校验** | 一个能改变状态的路由若对任何页面开放，你访问过的网站就能往你的 profile 里装东西。 |
| **一次只装一个** | 两个并发的 `dsh plugin add` 会在同一个 `package.json` 上打架，可能把 profile 写坏。 |
| **你的 profile，不是猜的** | 目标来自本进程启动时的 `--profile`，所以你在测试 profile 里操作，绝不会改到真实的那个。 |

配置 `allowInstall: false` 可以让面板退化成只读目录。

## 配置

组合包插入一行（`id: research-market`）。在 profile 的 `cordis.patch.yml` 里覆盖（patch 会整体替换 `config`，保留的键要一起写）：

```yaml
- id: research-market
  config:
    catalogUrl: https://dsh-research.com/v1/market.json
    profile: web            # 默认取本进程启动时的 profile
    allowInstall: true
    cacheSeconds: 900
    timeoutMs: 8000
```

`catalogUrl` 接受任何实现了 [DSH Community Market 目录源契约](https://github.com/anywhere-labs/deepseek-harness-desktop/blob/master/dsh-community-market/docs/catalog-provider-contract.md)的端点。指向你自己的，面板就列你的。

## 说明

- 面板里的名单和 [dsh-research.com/plugins](https://dsh-research.com/plugins/) 上的是同一份，由同一个 `market.json` 生成。**没读过的不收**：用我们画的按钮去装别人的包，出了问题用户第一个找的会是我们。
- 进程层改编自 [dsh-market](https://github.com/dsh-market/dsh-market)（MIT）。它替我们踩明白了四件事：`ctx.shell` 写不了 profile（那是 Agent 沙箱）、macOS 从 Dock 启动时 PATH 里没有 Homebrew、pnpm v10 无 TTY 时不设 `CI` 会永久卡死、Windows 上 `dsh` 是 `.cmd` shim。
- 新装的插件要重启后才加载，行内会提示。

## 许可证

MIT
