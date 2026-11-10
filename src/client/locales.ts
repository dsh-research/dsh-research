/**
 * Panel copy. The shell owns no text of its own, so every string a reader
 * sees is registered here in both languages.
 * @module dsh-research/client/locales
 */

/** Locale namespace this plugin registers under. */
export const NS = 'settings.researchMarket'

/** Copy keys of the panel. */
export type MarketLocaleKey =
  | 'nativeManagement'
  | 'nativeRestart'
  | 'copyPackage'
  | 'nav'
  | 'title'
  | 'tabDiscover'
  | 'tabInstalled'
  | 'allCategories'
  | 'more'
  | 'catLiterature'
  | 'catReference'
  | 'catWriting'
  | 'catWorkbench'
  | 'catPacks'
  | 'emptyInstalled'
  | 'intro'
  | 'search'
  | 'loading'
  | 'empty'
  | 'install'
  | 'installing'
  | 'progressInstall'
  | 'progressRemove'
  | 'progressElapsed'
  | 'installed'
  | 'installedVersion'
  | 'publishedOn'
  | 'update'
  | 'confirmUpdateTitle'
  | 'confirmUpdateBody'
  | 'restart'
  | 'uninstall'
  | 'uninstalling'
  | 'restartNow'
  | 'restartTitle'
  | 'confirmInstallTitle'
  | 'confirmRemoveTitle'
  | 'confirmRestartTitle'
  | 'confirmProfile'
  | 'confirmWillRun'
  | 'confirmOurs'
  | 'confirmThird'
  | 'confirmRemoveBody'
  | 'confirmRestartBody'
  | 'confirmYes'
  | 'confirmNo'
  | 'confirmClose'
  | 'restarting'
  | 'restartHint'
  | 'restartWaiting'
  | 'restartBack'
  | 'restartLost'
  | 'restartStayed'
  | 'restartManualTitle'
  | 'restartManualBody'
  | 'restartManualHint'
  | 'reload'
  | 'failed'
  | 'copy'
  | 'copied'
  | 'noNpm'
  | 'ours'
  | 'stars'
  | 'retry'
  | 'error'
  | 'stale'
  | 'revision'
  | 'count'
  | 'profileNote'
  | 'disclosure'
  | 'site'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The research market settings page. */
    'settings.researchMarket': MarketLocaleKey
  }
}

export const zh: Record<MarketLocaleKey, string> = {
  nativeManagement: '由当前宿主的插件管理器执行。',
  nativeRestart: '变更已保存。请退出并重新打开当前应用，使变更生效。',
  copyPackage: '复制包名',
  nav: '科研插件',
  title: '科研插件',
  tabDiscover: '发现',
  tabInstalled: '已安装',
  allCategories: '全部',
  more: '它具体能做什么 →',
  catLiterature: '文献检索与阅读',
  catReference: '文献管理与引用',
  catWriting: '写作与评审',
  catWorkbench: '科研工作台',
  catPacks: '技能包',
  emptyInstalled: '还没有从这里安装任何插件。',
  intro: '人工挑选的科研插件，安装到当前使用的环境',
  search: '搜索插件、能力、关键词…',
  loading: '正在读取目录…',
  empty: '没有匹配的插件。',
  install: '安装',
  installing: '安装中…',
  progressInstall: '首次安装需要下载并解析依赖，大插件可能要 1–3 分钟。这期间可以离开本页，装完会记在这里。',
  progressRemove: '正在从 profile 中移除并清理依赖…',
  progressElapsed: '已用 {n} 秒',
  installed: '已安装',
  installedVersion: '已装 v{v}',
  publishedOn: '发布于 {d}',
  update: '更新到 v{v}',
  restart: '重启 dsh 后生效',
  uninstall: '卸载',
  uninstalling: '卸载中…',
  restartNow: '重启 dsh',
  restartTitle: '重启后新装或卸载的插件才会生效',
  confirmInstallTitle: '安装 {name}？',
  confirmUpdateTitle: '更新 {name}？',
  confirmRemoveTitle: '卸载 {name}？',
  confirmRestartTitle: '重启 dsh？',
  confirmProfile: '这会写入 profile ',
  confirmWillRun: '将执行：',
  confirmOurs: '这个插件由 AI4Scholar 维护，出了问题可以直接找我们。安装会改写 profile 的清单并重装依赖，需要重启时会在完成后提示。',
  confirmThird: '这个插件由 {publisher} 维护，不是我们——我们读过它的代码才收录，但它的行为与更新不由我们控制。安装会改写 profile 的清单并重装依赖，需要重启时会在完成后提示。',
  confirmRemoveBody: '会从 profile 中移除该插件，磁盘上的包也会被删除。可以随时重新安装。',
  confirmUpdateBody: '从 v{from} 更新到 v{to}——目录里的版本就是我们审读过代码的版本。需要重启时会在完成后提示。',
  confirmRestartBody: '当前 dsh 进程会退出，随后自动拉起新的。本页会短暂断开，刷新即可回来；正在进行的对话会中断。',
  confirmYes: '确认',
  confirmNo: '取消',
  confirmClose: '关闭',
  restarting: '重启中…',
  restartHint: '有 {n} 项改动等待生效。重启后本页会短暂断开，刷新即可。',
  restartWaiting: '重启中…本页会自己确认新进程回来了，不用手动刷新。',
  restartBack: '已经回来了。刷新本页就能用上新装的插件。',
  restartLost: '进程退出了，但没等到它回来。先看日志 {log}；要自己拉起来就运行 {command}。',
  restartStayed: '宿主没有退出，改动还没生效。',
  restartManualTitle: '这个 dsh 得你自己重启',
  restartManualBody: '它是在终端里启动的，输出属于那个终端。我在后台拉起一个替代进程是能做到的，但你会失去 Ctrl-C 和正在看的日志，而它照样占着端口——你下次运行 dsh web 只会看到 EADDRINUSE，而且屏幕上没有任何东西解释为什么。所以这里什么都不做：回到那个终端，Ctrl-C，再运行下面这行。',
  restartManualHint: '回到启动 dsh 的那个终端：Ctrl-C，然后运行 {command}。',
  reload: '刷新',
  failed: '安装失败',
  copy: '复制命令',
  copied: '已复制',
  noNpm: '仅提供仓库安装',
  ours: 'AI4Scholar 维护',
  stars: '星',
  retry: '重试',
  error: '读取目录失败：',
  stale: '这是缓存快照，最近一次刷新失败。',
  revision: '目录版本 ',
  count: '{n} / {total} 个',
  profileNote: '当前 profile：',
  disclosure: '收录不代表背书。本索引由 AI4Scholar 维护，其中部分插件也由我们开发。安装前请自行审查源码与权限。',
  site: '完整索引 →',
}

export const en: Record<MarketLocaleKey, string> = {
  nativeManagement: 'The current host’s plugin manager will apply this change.',
  nativeRestart: 'Changes saved. Close and reopen the current application to apply them.',
  copyPackage: 'Copy package',
  nav: 'Research plugins',
  title: 'Research plugins',
  tabDiscover: 'Discover',
  tabInstalled: 'Installed',
  allCategories: 'All',
  more: 'What it actually does →',
  catLiterature: 'Literature',
  catReference: 'References',
  catWriting: 'Writing & review',
  catWorkbench: 'Workbenches',
  catPacks: 'Skill packs',
  emptyInstalled: 'Nothing installed from here yet.',
  intro: 'Hand-picked research plugins, installed into the profile you are running',
  search: 'Search plugins, capabilities, keywords…',
  loading: 'Reading the catalog…',
  empty: 'No plugin matches.',
  install: 'Install',
  installing: 'Installing…',
  progressInstall: 'A first install downloads and resolves dependencies; a large plugin can take 1–3 minutes. You can leave this page — the result is recorded here.',
  progressRemove: 'Removing it from the profile and cleaning up dependencies…',
  progressElapsed: '{n}s elapsed',
  installed: 'Installed',
  installedVersion: 'v{v} on disk',
  publishedOn: 'released {d}',
  update: 'Update to v{v}',
  restart: 'Restart dsh to load it',
  uninstall: 'Remove',
  uninstalling: 'Removing…',
  restartNow: 'Restart dsh',
  restartTitle: 'Installed and removed plugins take effect after a restart',
  confirmInstallTitle: 'Install {name}?',
  confirmUpdateTitle: 'Update {name}?',
  confirmRemoveTitle: 'Remove {name}?',
  confirmRestartTitle: 'Restart dsh?',
  confirmProfile: 'This writes into profile ',
  confirmWillRun: 'It will run:',
  confirmOurs: 'AI4Scholar maintains this one, so problems with it come back to us. Installing rewrites the profile manifest and reinstalls its dependencies; the page reports if a restart is needed.',
  confirmThird: '{publisher} maintains this one, not us — we read its code before listing it, but neither its behaviour nor its updates are ours to control. Installing rewrites the profile manifest and reinstalls its dependencies; the page reports if a restart is needed.',
  confirmRemoveBody: 'The plugin leaves the profile and its package is deleted from disk. You can install it again at any time.',
  confirmUpdateBody: 'Moves it from v{from} to v{to} — the catalog version is the one whose code we reviewed. The page reports if a restart is needed.',
  confirmRestartBody: 'This dsh process exits and a fresh one is started. The page drops briefly — reload it — and any conversation in progress is interrupted.',
  confirmYes: 'Confirm',
  confirmNo: 'Cancel',
  confirmClose: 'Close',
  restarting: 'Restarting…',
  restartHint: '{n} change(s) waiting. The page drops briefly during the restart — reload it.',
  restartWaiting: 'Restarting… this page will confirm the replacement itself; no need to reload yet.',
  restartBack: 'It is back. Reload this page to use what you installed.',
  restartLost: 'The process exited but never came back. Check {log}, or start it yourself with {command}.',
  restartStayed: 'The host did not exit, so nothing has taken effect.',
  restartManualTitle: 'This dsh is yours to restart',
  restartManualBody: 'It was started in a terminal, and its output belongs to that terminal. Spawning a replacement in the background is possible, but it would cost you Ctrl-C and the log you are watching, and the invisible replacement would still hold the port — so your next `dsh web` would fail with EADDRINUSE and nothing on screen would say why. Nothing is done here instead: go back to that terminal, press Ctrl-C, and run the line below.',
  restartManualHint: 'Back in the terminal you started dsh in: Ctrl-C, then run {command}.',
  reload: 'Reload',
  failed: 'Install failed',
  copy: 'Copy command',
  copied: 'Copied',
  noNpm: 'repository install only',
  ours: 'by AI4Scholar',
  stars: 'stars',
  retry: 'Retry',
  error: 'Could not read the catalog: ',
  stale: 'This is a cached snapshot; the last refresh failed.',
  revision: 'Catalog revision ',
  count: '{n} of {total}',
  profileNote: 'Profile: ',
  disclosure: 'Listing is not endorsement. This index is maintained by AI4Scholar, which also authors some of the entries. Review a plugin’s source and permissions before installing it.',
  site: 'Full index →',
}
