# 极简主页 (Minimalist Homepage) for Obsidian

[![GitHub release (latest SemVer)](https://img.shields.io/github/v/release/2doright/obsidian-minimalist-homepage?style=for-the-badge&sort=semver)](https://github.com/2doright/obsidian-minimalist-homepage/releases/latest)
[![GitHub all releases](https://img.shields.io/github/downloads/2doright/obsidian-minimalist-homepage/total?style=for-the-badge)](https://github.com/2doright/obsidian-minimalist-homepage/releases)

一个 Obsidian 插件，旨在为您创建一个高度可定制、信息丰富且美观的卡片化主页。

## 特性

*   **卡片化布局**: 将您的主页信息组织成清晰、现代的卡片网格。
*   **高度可定制**: 通过详细的设置面板，您可以控制：
    *   **主页文件指定**: 将插件的特殊样式（全宽、无标题栏）应用于您选择的任何笔记。
    *   **模块显隐与配置**: 自由选择显示或隐藏各个信息模块，并调整其特定参数。
*   **丰富的内置信息模块**:
    *   **每日模块**: 每日从指定类型（如诗、词、文言文等，基于文档属性筛选）的笔记中随机展示一篇内容。
    *   **文件夹网格**:
        *   以卡片形式展示您 vault 中的顶层文件夹（可排除特定文件夹）。
        *   显示每个文件夹下的子文件夹和笔记列表，支持折叠和“查看更多”。
        *   每个文件夹卡片内显示最近更新的笔记。
        *   包含一个专门的卡片显示 vault 根目录下的笔记。
    *   **侧边栏信息区**:
        *   **文档统计**: 显示笔记总数和总字数（可配置排除路径）。
        *   **待办事项**: （新位置）根据标签或文件夹路径筛选并显示待处理的任务列表。
        *   **待整理笔记**: （原 `todo-notes-section`）根据特定标签或查询条件显示需要进一步处理的笔记。
        *   **最近编辑**: 显示最近修改过的笔记列表（排除主页本身和指定文件夹）。
        *   **快速访问**:
            *   **常用标签**: 统计并显示最常用的标签及其计数，点击可直接搜索。
            *   **Obsidian 书签**: 集成并显示您在 Obsidian 中创建的书签。
*   **交互优化**:
    *   文件夹列表和平滑的展开/折叠动画效果。
    *   可配置的手风琴模式（同级折叠或全局折叠）。
    *   美观的 CSS 样式，支持 Obsidian 的明亮和黑暗模式。
*   **便捷操作**:
    *   **命令支持**:
        *   快速跳转到主页。
        *   重新加载主页内容。
        *   直接打开插件设置。
    *   **Ribbon 图标**: 一键跳转到主页。
    *   **启动时自动打开主页**: 可选设置，方便您一打开 Obsidian 即进入主页。
*   **国际化**: 设置界面支持中文和英文。

## 如何使用

1.  **安装插件**:
    *   （未来，尚未发布到社区插件市场）通过 Obsidian 的社区插件浏览器搜索 "极简主页" (Minimalist Homepage) 并安装。
    *   **当前手动安装**:
        *   从 GitHub Releases 页面下载最新的 `main.js`, `styles.css`, `manifest.json` 文件。
        *   在您的 Obsidian vault 的 `.obsidian/plugins/` 目录下创建一个新的文件夹，例如 `minimalist-homepage`。
        *   将下载的三个文件放入该文件夹中。
        *   重启 Obsidian。
        *   在 Obsidian 的第三方插件设置中启用 "极简主页"。
2.  **配置主页文件**:
    *   在插件设置中，找到 "主页文件路径 (Homepage File Path)" 选项。
    *   输入您希望作为主页的 Markdown 文件的完整路径 (例如 `Home.md` 或 `Dashboards/MyHomepage.md`)。
    *   插件会自动为该文件应用全宽、无标题栏的样式。
3.  **在您的主页文件中添加代码块**:
    *   在您指定为主页的那个 Markdown 文件中，添加以下代码块，通常作为文件的唯一内容或放在最顶部：
      ```markdown
         ```minimalist-homepage
         ```
      ```
4.  **自定义模块**:
    *   进入 "极简主页" 的插件设置。
    *   根据您的喜好启用/禁用各个模块，并调整它们的具体配置，如显示数量、筛选条件、标题等。
5.  **使用命令和 Ribbon 图标**:
    *   通过命令面板 (默认 `Ctrl/Cmd + P`) 执行 "打开主页"、"重新加载主页内容" 或 "打开主页设置"。
    *   点击 Obsidian 左侧 Ribbon 栏的房子图标快速打开主页。

## 未来计划 (部分已开始规划)

*   **高级动态笔记列表模块**:
    *   允许用户创建多个自定义的笔记列表模块。
    *   提供强大的、可嵌套的筛选条件编辑器，支持基于文档属性（标签、自定义元数据）的与、或、非逻辑组合。
    *   在主页上以多栏网格形式展示筛选结果。
    *   可配置的筛选条件“胶囊”指示器。
*   更多模块和自定义选项。
*   持续的性能优化和用户体验改进。

## 反馈与贡献

欢迎通过 GitHub Issues 提出问题、报告 Bug 或提供功能建议。
如果您有兴趣贡献代码，请随时 Fork 本仓库并发起 Pull Request。

## 鸣谢

*   Obsidian 社区提供的宝贵资源和灵感。
