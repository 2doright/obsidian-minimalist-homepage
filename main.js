// --- IMPORT OBSIDIAN MODULES ---
// #IMPORT_MODULES
const { Plugin, MarkdownView, WorkspaceLeaf, TFile, TFolder, PluginSettingTab, Setting, Notice, moment, MarkdownRenderer, Component } = require('obsidian');

// --- UTILITY FUNCTION: Get Page Display Name ---
// #UTILITY_GET_PAGE_DISPLAY_NAME
/**
 * Gets a display-friendly name for a page/file.
 * Prioritizes frontmatter 'title', then filename (if not generic), then full name without .md.
 * @param {TFile} file The file object.
 * @param {object} [frontmatter] Optional pre-fetched frontmatter.
 * @returns {string}
 */

// --- PLUGIN SETTINGS INTERFACE AND DEFAULT VALUES ---
// #SETTINGS_INTERFACE_DEFAULT
/**
 * @typedef {Object} HomepageSettings
 * @property {string} homepageFilePath
 * @property {boolean} showDailyDisplay
 * @property {string} dailyDisplayMainLabel
 * @property {string} dailyDisplayForms // Comma-separated string
 * @property {boolean} showFolderGrid
 * @property {string} excludedTopFolders // Comma-separated string
 * @property {number} recentNotesInCategoryLimit
 * @property {number} initialNotesInSubfolderDisplay
 * @property {boolean} accordionModeForDetails
 * @property {boolean} globalAccordionMode; // If true, opening any <details> collapses ALL others on the page
 * @property {string} maxHeightForScrolledList
 * @property {boolean} showVaultStats
 * @property {string} vaultStatsTitle
 * @property {string} excludedFromWordcount // Comma-separated string
 * @property {boolean} showTodoSidebarSection
 * @property {string} todoSidebarSectionTitle
 * @property {string} todoSidebarSectionSources
 * @property {number} todoSidebarSectionLimit
 * @property {boolean} showTodoNotes
 * @property {string} todoTagDisplay
 * @property {string} todoTagQuery
 * @property {number} todoFilesLimit
 * @property {boolean} showRecentEdits
 * @property {number} recentFilesLimitSidebar
 * @property {boolean} showQuickAccess
 * @property {boolean} showQuickAccessTopTags
 * @property {number} topTagsLimit
 * @property {boolean} showQuickAccessBookmarks // This will be for Obsidian's native bookmarks
 * @property {string} quickAccessBookmarksTitle
 * Dataview sources like "", "folder", or tags
 * @property {string} dailyDisplayMetadataField // The frontmatter field key for daily display filtering
 * @property {DynamicNoteListModule[]} dynamicNoteListModules
 */

// #INTERFACE_DYNAMIC_NOTE_LIST_MODULE

/**
* @typedef {'contains' | 'not_contains' | 'is' | 'is_not' | 'starts_with' | 'ends_with' | 'exists' | 'not_exists' | 'greater_than' | 'less_than' | 'matches_regex'} FilterOperator
*/

/**
* Represents a single filter condition.
* @typedef {Object} FilterCondition
* @property {string} id - Unique ID for this condition.
* @property {string} property - The document property (e.g., "tags", "form", "status"). "tags" is special.
* @property {FilterOperator} operator
* @property {any} [value] - The value to compare against. Not needed for 'exists'/'not_exists'.
*                         For 'tags' with 'contains'/'not_contains', this should be a single tag string.
*/

/**
* Represents a group of filter conditions. (MVP: No nested groups in FilterGroup itself initially)
* @typedef {Object} FilterGroup
* @property {'AND' | 'OR'} logic - How conditions *within* this group are combined.
* @property {FilterCondition[]} conditions - Array of individual filter conditions.
* @property {boolean} [isNegated] - If true, the result of this group (conditions combined by logic) is negated.
*/

/**
* Settings for a single dynamic note list module instance.
* @typedef {Object} DynamicNoteListModule
* @property {string} id - Unique ID for the module instance.
* @property {string} userDefinedTitle - User-friendly title for this module in settings.
* @property {boolean} enabled - Whether this module instance is active.
* @property {FilterGroup} filterGroup - The filter group for this module.
* @property {{columns: number, pillColors: {and: string, or: string, not: string}}} displaySettings
*           - columns: Number of columns for display.
*           - pillColors: Configurable colors for filter pills.
*/

const DEFAULT_SETTINGS = {
    homepageFilePath: "Home.md",
    openHomepageOnStartup: false, // 默认关闭
    showDailyDisplay: true,
    dailyDisplayMainLabel: "每日鉴赏",
    dailyDisplayMetadataField: "form",
    dailyDisplayForms: "诗,词,文言文",
    showFolderGrid: true,
    excludedTopFolders: ".obsidian,.trash,Attachment,Scripts", // Default common exclusions
    recentNotesInCategoryLimit: 5,
    initialNotesInSubfolderDisplay: 5,
    accordionModeForDetails: true,
    globalAccordionMode: true, // 全局折叠
    maxHeightForScrolledList: "250px",
    showVaultStats: true,
    vaultStatsTitle: "文档统计",
    excludedFromWordcount: "",
    showTodoNotes: true,
    showTodoSidebarSection: true,
    todoSidebarSectionTitle: "待办事项", // 将在 SettingTab 中进行国际化
    todoSidebarSectionSources: "", 
    todoSidebarSectionLimit: 7,
    todoTagDisplay: "待整理笔记",
    todoTagQuery: "#待整理",
    todoFilesLimit: 5,
    showRecentEdits: true,
    recentFilesLimitSidebar: 7,
    showQuickAccess: true,
    showQuickAccessTopTags: true,
    topTagsLimit: 10,
    showQuickAccessBookmarks: true,
    quickAccessBookmarksTitle: "我的书签",
    dynamicNoteListModules: [ // Example of one default module, can be empty array
        {
            id: `dnl-${Date.now()}`, // Simple unique ID generation
            userDefinedTitle: "My First Dynamic List",
            enabled: true,
            filterGroup: {
                logic: 'AND',
                conditions: [
                    // Example: { id: `fc-${Date.now()}`, property: 'tags', operator: 'contains', value: 'important' },
                    // Example: { id: `fc-${Date.now()+1}`, property: 'status', operator: 'is', value: 'active' }
                ],
                isNegated: false
            },
            displaySettings: {
                columns: 3,
                pillColors: { // Default colors
                    and: 'var(--color-green)', // Or specific hex/rgb like '#4CAF50'
                    or: 'var(--color-orange)',  // '#FF9800'
                    not: 'var(--color-red)'     // '#F44336'
                }
            }
        }
    ],
    dynamicNoteListModules: [] // Start with an empty array for a cleaner default
};

const BODY_CLASS_FOR_HOMEPAGE = 'homepage-is-active';
const HOMEPAGE_CODE_BLOCK_ID = 'custom-dynamic-homepage-content';

// --- MAIN PLUGIN CLASS ---
// #PLUGIN_CLASS_DEFINITION
class CustomDynamicHomepagePlugin extends Plugin {
    /** @type {HomepageSettings} */
    settings;

    // --- LIFECYCLE METHOD: onload ---
    // #LIFECYCLE_ONLOAD
    async onload() {
        console.log('Loading Custom Dynamic Homepage plugin...');
        await this.loadSettings();

        // --- ADD SETTINGS TAB ---
        // #SETTINGS_TAB_ADD
        this.addSettingTab(new HomepageSettingTab(this.app, this));

        // --- ADD COMMAND TO OPEN HOMEPAGE ---
        // #COMMAND_OPEN_HOMEPAGE
        this.addCommand({
            id: 'open-custom-homepage',
            name: this.getLocalizedString({ en: 'Open Homepage', zh: '打开主页' }),
            callback: () => {
                this.navigateToHomepage(); // Default: try to reuse existing leaf or open new
            },
        });

        // --- COMMAND: Reload Homepage Content ---
        // #COMMAND_RELOAD_HOMEPAGE
        this.addCommand({
            id: 'reload-custom-homepage-content',
            name: this.getLocalizedString({ en: 'Reload Homepage Content', zh: '重新加载主页内容' }),
            checkCallback: (checking) => {
                // Only enable if the active view is the homepage
                const activeFile = this.app.workspace.getActiveFile();
                const isHomepageActive = activeFile && activeFile.path === this.settings.homepageFilePath;
                if (isHomepageActive) {
                    if (!checking) { // If actually executing
                        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
                        if (view) {
                            // This will re-run all code block processors in the view
                            view.leaf.rebuildView(); 
                            new Notice(this.getLocalizedString({ en: "Homepage content reloaded.", zh: "主页内容已重新加载。" }), 2000);
                        }
                    }
                    return true; // Command should be shown/enabled
                }
                return false; // Command should be hidden/disabled
            }
        });

        // --- COMMAND: Open Homepage Settings ---
        // #COMMAND_OPEN_SETTINGS
        this.addCommand({
            id: 'open-custom-homepage-settings',
            name: this.getLocalizedString({ en: 'Open Homepage Settings', zh: '打开主页设置' }),
            callback: () => {
                // First, ensure the settings modal is open
                this.app.setting.open();
                // Then, try to navigate to the plugin's specific settings tab
                // This might require a slight delay if open() is asynchronous in its display,
                // but usually, it prepares the ground for openTabById.
                this.app.setting.openTabById(this.manifest.id);
            }
        });

        // --- ADD RIBBON ICON TO OPEN HOMEPAGE ---
        // #RIBBON_ICON_OPEN_HOMEPAGE
        // Use a suitable Obsidian icon name (e.g., 'home', 'lucide-home', 'layout-dashboard')
        // You can find icon names here: https://lucide.dev/ or by inspecting Obsidian's UI.
        // 'home' is a common one.
        const ribbonIconEl = this.addRibbonIcon('home', this.getLocalizedString({ en: 'Open Homepage', zh: '打开主页' }), (evt) => {
            this.navigateToHomepage();
        });
        // Optionally, add a class to the ribbon icon for additional styling if needed
        ribbonIconEl.addClass('custom-dynamic-homepage-ribbon-icon');


        // --- HANDLE OPEN ON STARTUP ---
        // #LOGIC_OPEN_ON_STARTUP
        if (this.settings.openHomepageOnStartup) {
            // We need to wait for the workspace to be fully loaded before trying to open files.
            // 'layout-ready' is a good event for this.
            // If the plugin loads *after* layout-ready (e.g. user enables it later),
            // this onLayoutReady might not fire immediately for *this* load.
            // So, we also check if layout is already ready.
            
            const openHomepageLogic = () => {
                // Check if a file is already open, especially if it's the homepage.
                // If Obsidian is set to "open last used tabs", the homepage might already be active.
                const activeFile = this.app.workspace.getActiveFile();
                if (activeFile && activeFile.path === this.settings.homepageFilePath) {
                    // Homepage is already active, do nothing extra.
                    // Our existing active-leaf-change handler will apply styles.
                    console.log("CustomHomepage: Homepage is already active on startup.");
                    this.checkAndApplyHomepageStylesForLeaf(this.app.workspace.getActiveViewOfType(MarkdownView)?.leaf);
                    return;
                }
                // If another file is open, or no file, then navigate.
                console.log("CustomHomepage: Navigating to homepage on startup.");
                this.navigateToHomepage(); // Default behavior
            };

            if (this.app.workspace.layoutReady) {
                // Layout is already ready, execute immediately
                openHomepageLogic();
            } else {
                // Layout not yet ready, register a one-time event
                this.registerEvent(
                    this.app.workspace.on('layout-ready', () => {
                        openHomepageLogic();
                    }, this) // Pass 'this' as context for one-time event
                );
            }
        }

        // --- REGISTER WORKSPACE EVENT LISTENERS ---
        // #EVENT_LISTENER_ACTIVE_LEAF_CHANGE
        this.registerEvent(
            this.app.workspace.on('active-leaf-change', this.handleActiveLeafChange)
        );

        // #EVENT_LISTENER_LAYOUT_READY
        this.app.workspace.onLayoutReady(() => {
            this.checkAndApplyHomepageStylesForLeaf(this.app.workspace.getActiveViewOfType(MarkdownView)?.leaf);
            this.injectDynamicStyles(); // Inject styles based on settings
        });

        // --- REGISTER MARKDOWN CODE BLOCK PROCESSOR ---
        // #CODE_BLOCK_PROCESSOR_HOMEPAGE
        this.registerMarkdownCodeBlockProcessor(HOMEPAGE_CODE_BLOCK_ID, (source, el, ctx) => {
            const currentFilePath = ctx.sourcePath;
            if (currentFilePath === this.settings.homepageFilePath) {
                el.addClass('homepage-container');
                el.empty();
                // Call the main rendering function
                this.renderHomepageContent(el, source, ctx);
            } else {
                el.createEl('p', { text: `This code block '${HOMEPAGE_CODE_BLOCK_ID}' is intended for use only in '${this.settings.homepageFilePath}'. Current file: ${currentFilePath}` });
            }
        });

        this.checkAndApplyHomepageStylesForLeaf(this.app.workspace.getActiveViewOfType(MarkdownView)?.leaf);
        this.injectDynamicStyles(); // Initial injection

        console.log('Custom Dynamic Homepage plugin loaded.');
    }

    // --- LIFECYCLE METHOD: onunload ---
    // #LIFECYCLE_ONUNLOAD
    onunload() {
        console.log('Unloading Custom Dynamic Homepage plugin...');
        document.body.classList.remove(BODY_CLASS_FOR_HOMEPAGE);
        // Remove dynamic style tag if it exists
        const dynamicStyleEl = document.getElementById('custom-homepage-dynamic-styles');
        if (dynamicStyleEl) {
            dynamicStyleEl.remove();
        }

    }

    // #UTILITY_NAVIGATE_TO_HOMEPAGE
    async navigateToHomepage() { // REMOVED alwaysNewTab parameter
        const homepagePath = this.settings.homepageFilePath;
        if (!homepagePath) {
            new Notice(this.getLocalizedString({
                en: "Homepage file path is not configured in settings.",
                zh: "主页文件路径未在设置中配置。"
            }));
            return;
        }

        let homepageFile = this.app.vault.getAbstractFileByPath(homepagePath);
        if (!(homepageFile instanceof TFile)) {
            new Notice(this.getLocalizedString({
                en: `Homepage file "${homepagePath}" not found. Please create it or check the path.`,
                zh: `主页文件 "${homepagePath}" 未找到。请创建它或检查路径。`
            }));
            return; 
        }

        // Check if the homepage is already open in any leaf
        const leaves = this.app.workspace.getLeavesOfType("markdown");
        for (const leaf of leaves) {
            if (leaf.view instanceof MarkdownView && leaf.view.file && leaf.view.file.path === homepagePath) {
                // Homepage is already open, activate its leaf
                this.app.workspace.setActiveLeaf(leaf, { focus: true });
                return; // Exit after activating
            }
        }

        // Homepage is not open, so open it in a new tab
        const targetLeaf = this.app.workspace.getLeaf('tab'); // Always get a new tab leaf
        await targetLeaf.openFile(homepageFile, { active: true }); // active: true makes the new leaf active
    }

    // --- SETTINGS MANAGEMENT ---
    // #SETTINGS_MANAGEMENT_LOAD
    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    // #SETTINGS_MANAGEMENT_SAVE
    async saveSettings() {
        await this.saveData(this.settings);
        this.injectDynamicStyles(); // Re-inject styles if settings that affect them change
        // Force re-render of homepage if it's active
        // Call rerender AFTER saving, so new settings are available
        await this.rerenderHomepageIfActive(); // Make sure this is awaited if it becomes async
    }
    
    // --- DYNAMIC STYLE INJECTION ---
    // #STYLE_INJECTION_DYNAMIC
    injectDynamicStyles() {
        let dynamicStyleEl = document.getElementById('custom-homepage-dynamic-styles');
        if (!dynamicStyleEl) {
            dynamicStyleEl = document.createElement('style');
            dynamicStyleEl.id = 'custom-homepage-dynamic-styles';
            document.head.appendChild(dynamicStyleEl);
        }
        dynamicStyleEl.textContent = `
            :root {
                --notes-list-max-height-scroll: ${this.settings.maxHeightForScrolledList};
            }
        `;
    }

    // --- EVENT HANDLER: Active Leaf Change ---
    // #HANDLER_ACTIVE_LEAF_CHANGE
    handleActiveLeafChange = (leaf) => {
        if (leaf) {
            this.checkAndApplyHomepageStylesForLeaf(leaf);
        } else {
            this.removeHomepageBodyStyles();
        }
    }

    // --- CORE LOGIC: Check and Apply/Remove Body Styles based on Leaf ---
    // #LOGIC_CHECK_APPLY_STYLES
    checkAndApplyHomepageStylesForLeaf(leaf) {
        if (leaf instanceof WorkspaceLeaf && leaf.view instanceof MarkdownView) {
            const currentFile = leaf.view.file;
            if (currentFile instanceof TFile && currentFile.path === this.settings.homepageFilePath) {
                this.addHomepageBodyStyles();
            } else {
                this.removeHomepageBodyStyles();
            }
        } else {
            this.removeHomepageBodyStyles();
        }
    }

    // --- UTILITY: Add/Remove Body Styles ---
    // #UTILITY_BODY_STYLES
    addHomepageBodyStyles() {
        if (!document.body.classList.contains(BODY_CLASS_FOR_HOMEPAGE)) {
            document.body.classList.add(BODY_CLASS_FOR_HOMEPAGE);
        }
    }
    removeHomepageBodyStyles() {
        if (document.body.classList.contains(BODY_CLASS_FOR_HOMEPAGE)) {
            document.body.classList.remove(BODY_CLASS_FOR_HOMEPAGE);
        }
    }

    // #UTILITY_GET_PAGE_DISPLAY_NAME
    /**
     * Gets a display-friendly name for a page/file.
     * Prioritizes frontmatter 'title', then filename (if not generic), then full name without .md.
     * @param {TFile} file The file object.
     * @param {object} [frontmatter] Optional pre-fetched frontmatter.
     * @returns {string}
     */
    getPageDisplayName(file, frontmatter) { // 注意，作为方法，第一个参数不是 this
        if (!file) return this.getLocalizedString({ en: "Invalid Note", zh: "无效笔记" });

        // 'this' 现在指向插件实例，所以 this.app 是可用的
        const fm = frontmatter || this.app.metadataCache.getFileCache(file)?.frontmatter;

        if (fm && fm.title && String(fm.title).trim() !== "") {
            return String(fm.title).trim();
        }
        // 使用 this.getLocalizedString 来国际化 "未命名" 等字符串
        const unnamedPatterns = [
            this.getLocalizedString({ en: "untitled", zh: "未命名" }),
            this.getLocalizedString({ en: "no title", zh: "无标题" }) // 添加更多可能的模式
        ];
        const unnamedRegex = new RegExp(`^(${unnamedPatterns.join('|')})`, 'i');


        if (file.basename && !unnamedRegex.test(file.basename.trim())) {
            return file.basename.trim();
        }
        const nameWithoutExt = file.name.replace(/\.md$/i, '').trim();
        if (nameWithoutExt && !unnamedRegex.test(nameWithoutExt)) {
            return nameWithoutExt;
        }
        return this.getLocalizedString({ en: "Unnamed Note", zh: "未命名笔记" });
    }
    // --- UTILITY: Internationalization Helper ---
    // #UTILITY_I18N_HELPER
    /**
     * Returns the appropriate string based on the current Obsidian locale.
     * @param {{en: string, zh: string}} strings Object containing 'en' and 'zh' versions.
     * @returns {string}
     */
    getLocalizedString(strings) {
        const currentLocale = moment.locale(); // e.g., 'en', 'zh-cn'
        if (currentLocale.startsWith('zh')) { // Covers 'zh-cn', 'zh-tw', etc.
            return strings.zh;
        }
        return strings.en; // Default to English
    }
    // --- UTILITY: Rerender homepage if active ---


    // #UTILITY_RERENDER_HOMEPAGE
rerenderHomepageIfActive() {
    const activeFile = this.app.workspace.getActiveFile();
    if (activeFile && activeFile.path === this.settings.homepageFilePath) {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view && view.editor) { // Check for editor existence
            // A more robust way to force re-render of a specific code block:
            // Find the code block section in the editor and "touch" it or use a command.
            // However, a simpler approach that often works for preview mode is to
            // tell Obsidian that the file content has changed slightly, forcing a re-process.
            // This is a bit of a hack.
            
            // Alternative: Directly find the DOM element and re-run.
            // We need to find the specific <div> element that our code block processor rendered into.
            // The processor itself gets an 'el' argument.
            
            // Let's try to re-trigger the markdown processor for the view if possible.
            // This can be done by telling Obsidian the view's data has changed.
            console.log("CustomHomepage: Attempting to re-render homepage due to settings change.");
            
            // This is a strong re-render, essentially reloads the view's display content
            view.leaf.rebuildView(); 

            // After rebuilding, our code block processor should run again for the active view.
            // We might need a slight delay for the rebuild to complete before our processor's output is visible.
            // However, usually, rebuildView() itself should trigger it.

            new Notice(this.getLocalizedString({
                en: "Homepage settings updated. Content is being refreshed.",
                zh: "主页设置已更新，内容正在刷新。"
            }), 3000); // Show notice for 3 seconds

        } else {
             new Notice(this.getLocalizedString({
                en: "Homepage settings updated. Please manually re-open or refresh the homepage to see all changes.",
                zh: "主页设置已更新，请手动重新打开或刷新主页以查看所有更改。"
            }), 5000);
        }
    }
}

    // --- INTERACTIVITY HELPERS FOR FOLDER GRID ---
    // #HELPER_FOLDER_GRID_INTERACTIVITY
    /**
     * Toggles the display of more notes in a list.
     * @param {string} listId The ID of the <ul> element.
     * @param {HTMLElement} linkElement The <a> element that was clicked.
     */
    toggleMoreNotes(listId, linkElement) {
        const list = document.getElementById(listId);
        if (!list) return;

        const isShowingAllWithScroll = list.classList.contains('enable-scroll-on-overflow');
        const initialDisplayCount = parseInt(linkElement.dataset.initialDisplayCount || '0');
        const totalNotes = parseInt(linkElement.dataset.totalNotes || '0');

        if (isShowingAllWithScroll) {
            list.classList.remove('enable-scroll-on-overflow');
            list.classList.add('hide-overflow-notes');
            // 更新链接文本为 "查看全部 X 篇 (已显示 Y)"
            linkElement.textContent = this.getLocalizedString({
                en: `View all ${totalNotes} notes (showing ${initialDisplayCount})`,
                zh: `查看全部 ${totalNotes} 篇 (已显示 ${initialDisplayCount})`
            });
        } else {
            list.classList.remove('hide-overflow-notes');
            list.classList.add('enable-scroll-on-overflow');
            // 更新链接文本为 "收起部分笔记"
            linkElement.textContent = this.getLocalizedString({
                en: 'Collapse some notes',
                zh: '收起部分笔记'
            });
        }
    }

    /**
     * Sets up accordion behavior for <details> elements within a container.
     * @param {HTMLElement} containerEl The container element holding the <details> elements for initial scan.
     * @param {string} detailsSelector CSS selector for the <details> elements (e.g., 'details.collapsible-section').
     */
    setupAccordion(containerEl, detailsSelector) {
        // 如果两个手风琴模式都没开，则不执行任何操作
        if (!this.settings.accordionModeForDetails && !this.settings.globalAccordionMode) {
            return;
        }

        // 获取当前卡片内或指定容器内的所有 <details> 元素
        const detailsElementsInScope = Array.from(containerEl.querySelectorAll(detailsSelector));

        detailsElementsInScope.forEach(detail => {
            // 移除可能已存在的旧监听器，以防重复注册 (如果此函数被多次调用在同一元素上)
            // 但由于我们使用 this.registerDomEvent，Obsidian 会处理卸载，所以通常不需要手动移除。

            this.registerDomEvent(detail, 'toggle', (event) => {
                if (detail.open) {
                    if (this.settings.globalAccordionMode) {
                        // 全局模式：关闭页面上所有其他符合选择器的 <details>
                        // 我们需要获取整个主页容器内的所有 relevant details 元素
                        const homepageRootContainer = detail.closest('.homepage-container'); // 假设所有主页内容都在 .homepage-container 内
                        if (homepageRootContainer) {
                            const allDetailsOnPage = Array.from(homepageRootContainer.querySelectorAll(detailsSelector));
                            allDetailsOnPage.forEach(otherDetail => {
                                if (otherDetail !== detail && otherDetail.open) {
                                    otherDetail.open = false;
                                }
                            });
                        }
                    } else if (this.settings.accordionModeForDetails) {
                        // 同级模式：仅关闭同一父元素下的其他 <details>
                        const parentElement = detail.parentElement;
                        if (parentElement) {
                            const siblingDetails = Array.from(parentElement.querySelectorAll(`:scope > ${detailsSelector}`));
                            siblingDetails.forEach(otherDetail => {
                                if (otherDetail !== detail && otherDetail.open) {
                                    otherDetail.open = false;
                                }
                            });
                        }
                    }
                }
            });
        });
    }

    // --- HELPER: Get Task Text from File Line ---
    // #HELPER_GET_TASK_TEXT_FROM_FILE
    /**
     * Asynchronously reads a file and extracts the text of a specific line,
     * stripping the Markdown task prefix.
     * @param {TFile} file The file object.
     * @param {number} lineNumber The 0-indexed line number.
     * @returns {Promise<string>} The task text, or a placeholder if an error occurs.
     */
    async getOriginalTaskText(file, lineNumber) {
        try {
            const content = await this.app.vault.cachedRead(file);
            const lines = content.split('\n');
            if (lineNumber >= 0 && lineNumber < lines.length) {
                // Strip common task prefixes: "- [ ] ", "- [x] ", "- [/] ", "- ", "* [ ] ", "* " etc.
                // This regex tries to be more general for common list/task markers.
                return lines[lineNumber].replace(/^[\s\t]*[-*+]\s*(\[[ \w\/xX-]\]\s*)?/, '').trim();
            }
            return `[行号超出范围: ${lineNumber + 1}]`;
        } catch (error) {
            console.warn(`CustomHomepage: Error reading file ${file.path} for task text at line ${lineNumber + 1}`, error);
            return `[读取文件错误: ${file.basename}]`;
        }
    }

    // --- MAIN HOMEPAGE RENDERING FUNCTION (Placeholder) ---
    // #RENDER_HOMEPAGE_CONTENT_MAIN
    async renderHomepageContent(containerEl, source, ctx) {
        console.log("renderHomepageContent called. Settings:", this.settings);
        containerEl.empty(); // Ensure it's clean before rendering

        // Add main layout structure
        const gridLayout = containerEl.createDiv({ cls: 'homepage-grid-layout' });
        const mainContentArea = gridLayout.createDiv({ cls: 'main-content-area' });
        const sidebarArea = gridLayout.createDiv({ cls: 'sidebar-area' });

        // --- SECTION: Daily Display ---
        // #SECTION_DAILY_DISPLAY
        if (this.settings.showDailyDisplay) {
            const dailySection = mainContentArea.createEl('section', { cls: 'homepage-section daily-display-section' });
            
            // Header for Daily Display (contains title and selected note info)
            const dailyHeader = dailySection.createDiv({ cls: 'daily-display-top-header' });
            dailyHeader.createSpan({ cls: 'daily-display-main-label' })
                .createEl('i', { cls: 'fas fa-feather-alt' }); // FontAwesome icon
            dailyHeader.querySelector('.daily-display-main-label').appendText(` ${this.settings.dailyDisplayMainLabel}`);

            const dailyContentWrapper = dailySection.createDiv({ cls: 'daily-display-content-wrapper' });
            const dailyNoteContentEl = dailyContentWrapper.createDiv({ cls: 'daily-note-content-rendered', id: `daily-note-md-content-${Date.now()}` }); // Unique ID for potential multiple instances

            try {
                const metadataFieldKey = this.settings.dailyDisplayMetadataField.trim();
                const allowedFormsInput = this.settings.dailyDisplayForms.split(',').map(s => s.trim().toLowerCase()).filter(s => s.length > 0);

                if (!metadataFieldKey || allowedFormsInput.length === 0) {
                    dailyHeader.createSpan({ cls: 'empty-message daily-header-empty', text: '每日鉴赏设置不完整 (元数据字段或适用类型未配置)。' });
                    dailyNoteContentEl.hide(); // Hide content area if settings incomplete
                } else {
                    const allMarkdownFiles = this.app.vault.getMarkdownFiles();
                    const candidateNotes = [];

                    for (const file of allMarkdownFiles) {
                        const cache = this.app.metadataCache.getFileCache(file);
                        const fm = cache?.frontmatter;
                        if (fm && fm[metadataFieldKey]) {
                            const fieldValue = String(fm[metadataFieldKey]).toLowerCase(); // Make it a string and lowercase for comparison
                            // Handle cases where frontmatter value might be an array (like tags)
                            const valuesToCheck = Array.isArray(fm[metadataFieldKey]) 
                                                ? fm[metadataFieldKey].map(v => String(v).toLowerCase()) 
                                                : [fieldValue];
                            
                            if (valuesToCheck.some(val => allowedFormsInput.includes(val))) {
                                candidateNotes.push({ file: file, frontmatter: fm });
                            }
                        }
                    }
                    
                    let dailyNoteToRender = null;
                    if (candidateNotes.length > 0) {
                        const todaySeed = parseInt(moment().format("YYYYMMDD"));
                        // Simple seeded random function
                        const seededRandom = (seed) => { let x = Math.sin(seed) * 10000; return x - Math.floor(x); };
                        const randomIndex = Math.floor(seededRandom(todaySeed) * candidateNotes.length);
                        dailyNoteToRender = candidateNotes[randomIndex];

                        if (dailyNoteToRender && dailyNoteToRender.file) {
                            const titleAuthorGroup = dailyHeader.createDiv({cls: 'daily-note-title-author-group'});
                            
                            // Get display name (passing app for metadataCache access if needed by the function)
                            const noteDisplayName = this.getPageDisplayName(dailyNoteToRender.file, dailyNoteToRender.frontmatter); 
                                                        // ^ 如果 getPageDisplayName 改为纯函数，则传递 this.app.metadataCache

                            titleAuthorGroup.createSpan({ cls: 'daily-note-title-inline' })
                                .createEl('a', {
                                    cls: 'internal-link',
                                    href: dailyNoteToRender.file.path,
                                    text: noteDisplayName,
                                    attr: { 'data-href': dailyNoteToRender.file.path } // For Obsidian's internal link handling
                                });

                            let authorText = "";
                            if (dailyNoteToRender.frontmatter && dailyNoteToRender.frontmatter.author) {
                                let rawAuthor = dailyNoteToRender.frontmatter.author;
                                // Simplified author parsing from your original script
                                if (typeof rawAuthor === 'string' && rawAuthor.startsWith("[[") && rawAuthor.endsWith("]]")) {
                                    const linkParts = rawAuthor.substring(2, rawAuthor.length - 2).split("|");
                                    authorText = linkParts.length > 1 ? linkParts[1] : linkParts[0];
                                } else if (typeof rawAuthor === 'object' && rawAuthor.path && typeof rawAuthor.path === 'string') { // Dataview link object
                                    const authorPage = this.app.vault.getAbstractFileByPath(rawAuthor.path);
                                    if (authorPage instanceof TFile) {
                                        authorText = this.getPageDisplayName(authorPage, this.app.metadataCache.getFileCache(authorPage)?.frontmatter) || rawAuthor.path.split('/').pop().replace(/\.md$/, '');
                                    } else {
                                        authorText = rawAuthor.path.split('/').pop().replace(/\.md$/, '');
                                    }
                                } else {
                                    authorText = String(rawAuthor);
                                }
                            }
                            if (authorText) {
                                titleAuthorGroup.createSpan({ cls: 'daily-note-author-inline', text: authorText });
                            }

                            // Asynchronously load and render Markdown content
                            this.app.vault.cachedRead(dailyNoteToRender.file).then(rawContent => {
                                const fmRegex = /^---[\s\S]*?---[\r\n]*/;
                                const contentToRender = rawContent.replace(fmRegex, "").trim();
                                
                                // Create a component for the MarkdownRenderer
                                // Using 'this' (the plugin instance) as the component is fine here
                                MarkdownRenderer.renderMarkdown(contentToRender, dailyNoteContentEl, dailyNoteToRender.file.path, this);
                                dailyNoteContentEl.show();
                            }).catch(e => {
                                console.error("CustomHomepage: Error rendering daily display note content:", e);
                                dailyNoteContentEl.setText("无法渲染内容。");
                                dailyNoteContentEl.show();
                            });

                        } else { // Should not happen if candidateNotes.length > 0
                            dailyHeader.createSpan({ cls: 'empty-message daily-header-empty', text: '今日未能选中笔记。' });
                            dailyNoteContentEl.hide();
                        }
                    } else {
                        dailyHeader.createSpan({ cls: 'empty-message daily-header-empty', text: `无符合条件的笔记 (元数据字段 "${metadataFieldKey}" 包含 "${allowedFormsInput.join(", ")}")。` });
                        dailyNoteContentEl.hide();
                    }
                }
            } catch (error) {
                console.error("CustomHomepage: Error processing daily display section:", error);
                dailyHeader.createSpan({ cls: 'empty-message daily-header-empty', text: '加载每日鉴赏时出错。' });
                dailyNoteContentEl.setText('错误详情请查看开发者控制台。');
                dailyNoteContentEl.show();
            }
        }

        // --- SECTION: Dynamic Note List ---
        // #SECTION_DYNAMIC_NOTE_LIST_MODULES_AREA
        const dynamicModulesArea = mainContentArea.createDiv({cls: 'dynamic-note-lists-area'});
        this.settings.dynamicNoteListModules.forEach(moduleConfig => {
            if (!moduleConfig.enabled) return;

            const moduleInstanceEl = dynamicModulesArea.createDiv({cls: 'dynamic-note-list-instance'});
            // 1. Render Filter Pills (based on moduleConfig.filterGroup)
            // this.renderFilterPills(moduleInstanceEl.createDiv({cls: 'filter-pills-container'}), moduleConfig.filterGroup, moduleConfig.displaySettings.pillColors);
            
            // 2. Filter notes (this will be an async operation)
            // const filteredNotes = await this.evaluateModuleFilters(this.app.vault.getMarkdownFiles(), moduleConfig.filterGroup);
            
            // 3. Render notes in columns
            // const notesGridEl = moduleInstanceEl.createDiv({cls: 'notes-grid-display'});
            // notesGridEl.style.gridTemplateColumns = `repeat(${moduleConfig.displaySettings.columns}, 1fr)`;
            // filteredNotes.forEach(note => { /* render note item/card */ });

            moduleInstanceEl.createEl('p', {text: `Module: ${moduleConfig.userDefinedTitle} - Content placeholder`}); // Temporary
        });

        // --- SECTION: Folder Grid ---
        // #SECTION_FOLDER_GRID
        if (this.settings.showFolderGrid) {
            const folderGridContainer = mainContentArea.createDiv({ cls: 'folder-grid' });
            try {
                const root = this.app.vault.getRoot();
                const excludedFoldersArray = this.settings.excludedTopFolders.split(',')
                    .map(f => f.trim().toLowerCase()).filter(f => f.length > 0);

                const topLevelTFolders = root.children
                    .filter(item => item instanceof TFolder && !excludedFoldersArray.includes(item.name.toLowerCase()))
                    .sort((a, b) => {
                        // Basic numeric-first sort, then localeCompare
                        const aName = a.name;
                        const bName = b.name;
                        const aIsNumeric = /^\d/.test(aName);
                        const bIsNumeric = /^\d/.test(bName);
                        if (aIsNumeric && !bIsNumeric) return -1;
                        if (!aIsNumeric && bIsNumeric) return 1;
                        // Use Obsidian's locale for sorting if available, otherwise default
                        const currentLocale = moment.locale();
                        return aName.localeCompare(bName, currentLocale.startsWith('zh') ? 'zh-CN' : undefined);
                    });

                let foundContentFolders = 0;

                for (const folder of topLevelTFolders) {
                    const folderPath = folder.path;
                    // Get all markdown files within this top-level folder and its subfolders
                    const notesInThisWholeCategory = this.app.vault.getMarkdownFiles().filter(f => f.path.startsWith(folderPath + "/") && f.path.toLowerCase().endsWith('.md'));

                    if (notesInThisWholeCategory.length === 0) continue;
                    foundContentFolders++;

                    const folderCard = folderGridContainer.createDiv({ cls: 'folder-card' });
                    const folderCardHeader = folderCard.createDiv({ cls: 'folder-card-header' });
                    folderCardHeader.createEl('h3', { text: folder.name });
                    const folderCardContent = folderCard.createDiv({ cls: 'folder-card-content' });

                    const uniqueFolderIdPart = folder.name.replace(/[^a-zA-Z0-9]/g, '') + Date.now().toString().slice(-5);

                    // --- Subfolders ---
                    const subTFolders = folder.children
                        .filter(child => child instanceof TFolder)
                        .map(sub => {
                            const notesInSub = notesInThisWholeCategory.filter(n => n.path.startsWith(sub.path + "/"));
                            return { tFolder: sub, name: sub.name, path: sub.path, notes: notesInSub };
                        })
                        .filter(sub => sub.notes.length > 0)
                        .sort((a,b) => a.name.localeCompare(b.name, moment.locale().startsWith('zh') ? 'zh-CN' : undefined));

                    if (subTFolders.length > 0) {
                        subTFolders.forEach((sub, subIndex) => {
                            const subfolderListId = `sfl-${uniqueFolderIdPart}-${subIndex}`;
                            const detailsEl = folderCardContent.createEl('details', { cls: 'collapsible-section subfolder-details' });
                            const summaryEl = detailsEl.createEl('summary');
                            summaryEl.createSpan({ cls: 'collapse-icon' });
                            summaryEl.createSpan({ cls: 'summary-text-label', text: sub.name });
                            summaryEl.createSpan({ cls: 'note-count', text: sub.notes.length.toString() });

                            const notesListWrapper = detailsEl.createDiv({ cls: 'notes-list-wrapper' });
                            const ul = notesListWrapper.createEl('ul', { 
                                cls: 'notes-list notes-list-in-subfolder hide-overflow-notes', 
                                attr: { id: subfolderListId } 
                            });

                            sub.notes
                                .sort((a,b) => a.name.localeCompare(b.name, moment.locale().startsWith('zh') ? 'zh-CN' : undefined))
                                .forEach((note, noteIndex) => {
                                    const itemClass = noteIndex >= this.settings.initialNotesInSubfolderDisplay ? 'overflow-note-item' : '';
                                    const li = ul.createEl('li', { cls: itemClass });
                                    const noteNameLink = li.createSpan({cls: 'note-name-link'});
                                    noteNameLink.createEl('a', {
                                        cls: 'internal-link',
                                        href: note.path,
                                        text: this.getPageDisplayName(note, this.app.metadataCache.getFileCache(note)?.frontmatter),
                                        attr: { 'data-href': note.path }
                                    });
                                    li.createSpan({ cls: 'note-meta-item note-time', text: moment(note.stat.mtime).fromNow() });
                                });

                            if (sub.notes.length > this.settings.initialNotesInSubfolderDisplay) {
                                const toggleLink = notesListWrapper.createEl('a', {
                                    cls: 'toggle-more-link',
                                    href: 'javascript:void(0);',
                                    text: this.getLocalizedString({
                                        en: `View all ${sub.notes.length} notes (showing ${this.settings.initialNotesInSubfolderDisplay})`,
                                        zh: `查看全部 ${sub.notes.length} 篇 (已显示 ${this.settings.initialNotesInSubfolderDisplay})`
                                    })
                                });
                                toggleLink.dataset.totalNotes = sub.notes.length.toString();
                                toggleLink.dataset.initialDisplayCount = this.settings.initialNotesInSubfolderDisplay.toString();
                                this.registerDomEvent(toggleLink, 'click', () => this.toggleMoreNotes(subfolderListId, toggleLink));
                            }
                        });
                    }

                    // --- Direct Notes in Folder ---
                    // Notes directly in this top-level folder, excluding a note named like the folder itself (e.g., 00 Notes/00 Notes.md)
                    const directNotesInFolder = notesInThisWholeCategory.filter(p => 
                        p.parent && p.parent.path === folderPath && p.basename.toLowerCase() !== folder.name.toLowerCase()
                    );

                    if (directNotesInFolder.length > 0) {
                        const directNotesListId = `dnl-${uniqueFolderIdPart}`;
                        const detailsEl = folderCardContent.createEl('details', { cls: 'collapsible-section direct-notes-details' });
                        const summaryEl = detailsEl.createEl('summary');
                        summaryEl.createSpan({ cls: 'collapse-icon' });
                        summaryEl.createSpan({ cls: 'summary-text-label', text: this.getLocalizedString({ en: 'Other Notes', zh: '其他笔记' }) });
                        summaryEl.createSpan({ cls: 'note-count', text: directNotesInFolder.length.toString() });
                        
                        const notesListWrapper = detailsEl.createDiv({ cls: 'notes-list-wrapper' });
                        const ul = notesListWrapper.createEl('ul', { 
                            cls: 'notes-list notes-list-direct hide-overflow-notes', 
                            attr: { id: directNotesListId } 
                        });

                        directNotesInFolder
                            .sort((a,b) => a.name.localeCompare(b.name, moment.locale().startsWith('zh') ? 'zh-CN' : undefined))
                            .forEach((note, noteIndex) => {
                                const itemClass = noteIndex >= this.settings.initialNotesInSubfolderDisplay ? 'overflow-note-item' : '';
                                const li = ul.createEl('li', { cls: itemClass });
                                const noteNameLink = li.createSpan({cls: 'note-name-link'});
                                noteNameLink.createEl('a', {
                                    cls: 'internal-link',
                                    href: note.path,
                                    text: this.getPageDisplayName(note, this.app.metadataCache.getFileCache(note)?.frontmatter),
                                    attr: { 'data-href': note.path }
                                });
                                li.createSpan({ cls: 'note-meta-item note-time', text: moment(note.stat.mtime).fromNow() });
                            });

                        if (directNotesInFolder.length > this.settings.initialNotesInSubfolderDisplay) {
                           const toggleLink = notesListWrapper.createEl('a', {
                                cls: 'toggle-more-link',
                                href: 'javascript:void(0);',
                                text: this.getLocalizedString({
                                    en: `View all ${directNotesInFolder.length} notes (showing ${this.settings.initialNotesInSubfolderDisplay})`,
                                    zh: `查看全部 ${directNotesInFolder.length} 篇 (已显示 ${this.settings.initialNotesInSubfolderDisplay})`
                                })
                            });
                            toggleLink.dataset.totalNotes = directNotesInFolder.length.toString();
                            toggleLink.dataset.initialDisplayCount = this.settings.initialNotesInSubfolderDisplay.toString();
                            this.registerDomEvent(toggleLink, 'click', () => this.toggleMoreNotes(directNotesListId, toggleLink));
                        }
                    }
                    
                    // Setup accordion for this card's collapsible sections
                    this.setupAccordion(folderCardContent, 'details.collapsible-section');

                    // --- Recent Notes in this Category (Top-Level Folder) ---
                    if (this.settings.recentNotesInCategoryLimit > 0 && notesInThisWholeCategory.length > 0) {
                        const recentNotesContainer = folderCardContent.createDiv({ cls: 'recent-updates-direct' });
                        recentNotesContainer.createEl('h4', { 
                            cls: 'card-inline-title', 
                            text: this.getLocalizedString({ en: 'Recently Updated', zh: '最近更新' }) 
                        });
                        const notesListWrapper = recentNotesContainer.createDiv({cls: 'notes-list-wrapper'});
                        const ul = notesListWrapper.createEl('ul', { cls: 'notes-list recent-in-category-list' });

                        notesInThisWholeCategory
                            .sort((a, b) => b.stat.mtime - a.stat.mtime) // Sort descending by modification time
                            .slice(0, this.settings.recentNotesInCategoryLimit)
                            .forEach(note => {
                                const li = ul.createEl('li');
                                const noteNameLink = li.createSpan({cls: 'note-name-link'});
                                noteNameLink.createEl('a', {
                                    cls: 'internal-link',
                                    href: note.path,
                                    text: this.getPageDisplayName(note, this.app.metadataCache.getFileCache(note)?.frontmatter),
                                    attr: { 'data-href': note.path }
                                });
                                li.createSpan({ cls: 'note-meta-item note-time', text: moment(note.stat.mtime).fromNow() });
                            });
                    }
                } // End of for...of topLevelTFolders


                // #FOLDER_GRID_ROOT_NOTES_CARD
                const directRootNotes = this.app.vault.getMarkdownFiles().filter(file => {
                    if (!file.parent || file.parent.path !== '/') return false; // Must be in root
                    // Optional: exclude if filename matches an excluded top folder name (unlikely for root files)
                    // if (excludedFoldersArray.includes(file.basename.toLowerCase())) return false;
                    return true;
                }).sort((a, b) => a.name.localeCompare(b.name, moment.locale().startsWith('zh') ? 'zh-CN' : undefined));

                if (directRootNotes.length > 0) {
                    foundContentFolders++; // Increment if we found root notes, to prevent "No folders found" message if only root notes exist.

                    const rootNotesCard = folderGridContainer.createDiv({ cls: 'folder-card root-notes-card' }); // Add specific class if needed
                    const rootNotesCardHeader = rootNotesCard.createDiv({ cls: 'folder-card-header' });
                    rootNotesCardHeader.createEl('h3', { text: this.getLocalizedString({ en: 'Vault Root Notes', zh: '根目录笔记' }) });
                    const rootNotesCardContent = rootNotesCard.createDiv({ cls: 'folder-card-content' });

                    const uniqueRootIdPart = 'rootnotes-' + Date.now().toString().slice(-5);
                    
                    // --- List of all root notes (with "show more") ---
                    const rootNotesListId = `rnl-${uniqueRootIdPart}`;
                    // No <details> needed here as per requirement
                    const notesListWrapper = rootNotesCardContent.createDiv({ cls: 'notes-list-wrapper' }); // Wrapper for styling and show more
                    const ul = notesListWrapper.createEl('ul', { 
                        cls: 'notes-list notes-list-direct-root hide-overflow-notes', // New specific class for root notes list
                        attr: { id: rootNotesListId } 
                    });

                    directRootNotes.forEach((note, noteIndex) => {
                        // Using initialNotesInSubfolderDisplay setting for limit here, can be a new setting if desired
                        const itemClass = noteIndex >= this.settings.initialNotesInSubfolderDisplay ? 'overflow-note-item' : '';
                        const li = ul.createEl('li', { cls: itemClass });
                        const noteNameLink = li.createSpan({cls: 'note-name-link'});
                        noteNameLink.createEl('a', {
                            cls: 'internal-link',
                            href: note.path,
                            text: this.getPageDisplayName(note, this.app.metadataCache.getFileCache(note)?.frontmatter),
                            attr: { 'data-href': note.path }
                        });
                        li.createSpan({ cls: 'note-meta-item note-time', text: moment(note.stat.mtime).fromNow() });
                    });

                    if (directRootNotes.length > this.settings.initialNotesInSubfolderDisplay) {
                       const toggleLink = notesListWrapper.createEl('a', {
                            cls: 'toggle-more-link',
                            href: 'javascript:void(0);',
                            text: this.getLocalizedString({
                                en: `View all ${directRootNotes.length} notes (showing ${this.settings.initialNotesInSubfolderDisplay})`,
                                zh: `查看全部 ${directRootNotes.length} 篇 (已显示 ${this.settings.initialNotesInSubfolderDisplay})`
                            })
                        });
                        toggleLink.dataset.totalNotes = directRootNotes.length.toString();
                        toggleLink.dataset.initialDisplayCount = this.settings.initialNotesInSubfolderDisplay.toString();
                        this.registerDomEvent(toggleLink, 'click', () => this.toggleMoreNotes(rootNotesListId, toggleLink));
                    }

                    // --- Recent Notes in Vault Root ---
                    if (this.settings.recentNotesInCategoryLimit > 0 && directRootNotes.length > 0) {
                        const recentRootNotesContainer = rootNotesCardContent.createDiv({ cls: 'recent-updates-direct' });
                        recentRootNotesContainer.createEl('h4', { 
                            cls: 'card-inline-title', 
                            text: this.getLocalizedString({ en: 'Recently Updated', zh: '最近更新' }) 
                        });
                        const recentListWrapper = recentRootNotesContainer.createDiv({cls: 'notes-list-wrapper'});
                        const recentUl = recentListWrapper.createEl('ul', { cls: 'notes-list recent-in-category-list' });

                        directRootNotes // Already sorted by name, re-sort for recent
                            .sort((a, b) => b.stat.mtime - a.stat.mtime) // Sort descending by modification time
                            .slice(0, this.settings.recentNotesInCategoryLimit)
                            .forEach(note => {
                                const li = recentUl.createEl('li');
                                const noteNameLink = li.createSpan({cls: 'note-name-link'});
                                noteNameLink.createEl('a', {
                                    cls: 'internal-link',
                                    href: note.path,
                                    text: this.getPageDisplayName(note, this.app.metadataCache.getFileCache(note)?.frontmatter),
                                    attr: { 'data-href': note.path }
                                });
                                li.createSpan({ cls: 'note-meta-item note-time', text: moment(note.stat.mtime).fromNow() });
                            });
                    }
                } // End of if (directRootNotes.length > 0)
                
                if (foundContentFolders === 0) {
                    folderGridContainer.createEl('p', { 
                        cls: 'empty-message', 
                        text: this.getLocalizedString({ 
                            en: 'No top-level folders with Markdown notes found (after exclusions).', 
                            zh: '未能找到包含 Markdown 笔记的顶层文件夹（已排除设置中的文件夹）。' 
                        }) 
                    });
                }

            } catch (error) {
                console.error("CustomHomepage: Error processing folder grid section:", error);
                folderGridContainer.createEl('p', { 
                    cls: 'empty-message', 
                    text: this.getLocalizedString({ 
                        en: 'Error loading folder grid. Check console for details.', 
                        zh: '加载文件夹网格时出错，详情请查看开发者控制台。' 
                    }) 
                });
            }
        }
        
        // --- SIDEBAR ---

        // --- SECTION: Vault Stats ---
        // #SECTION_VAULT_STATS
        if (this.settings.showVaultStats) {
            const statsSection = sidebarArea.createEl('section', { cls: 'homepage-section vault-stats-section' });
            const titleEl = statsSection.createEl('h2', { cls: 'sidebar-title-centered' });
            titleEl.createEl('i', {cls: 'fas fa-calculator'}); // FontAwesome icon
            titleEl.appendText(` ${this.settings.vaultStatsTitle}`);

            const statsContent = statsSection.createDiv({ cls: 'vault-stats-content' });

            // --- Item: Total Notes ---
            const totalNotesItem = statsContent.createDiv({ cls: 'vault-stats-item' });
            totalNotesItem.createSpan({ cls: 'vault-stats-label', text: this.getLocalizedString({ en: 'Total Notes:', zh: '笔记总数:' }) });
            const totalNotesValueEl = totalNotesItem.createSpan({ cls: 'vault-stats-value', text: '-' });

            // --- Item: Total Words ---
            const totalWordsItem = statsContent.createDiv({ cls: 'vault-stats-item' });
            totalWordsItem.createSpan({ cls: 'vault-stats-label', text: this.getLocalizedString({ en: 'Total Words:', zh: '总字数:' }) });
            const totalWordsValueEl = totalWordsItem.createSpan({ cls: 'vault-stats-value', text: '-' });

            // --- Logic to calculate stats ---
            try {
                const excludedTopFoldersArray = this.settings.excludedTopFolders.split(',')
                    .map(f => f.trim().toLowerCase()).filter(f => f.length > 0);
                
                // For word count, we use a separate exclusion list from settings
                const excludedFromWordcountArray = this.settings.excludedFromWordcount.split(',')
                    .map(p => p.trim().toLowerCase()).filter(p => p.length > 0);

                const allMarkdownFiles = this.app.vault.getMarkdownFiles();

                // Filter files for total notes count (uses excludedTopFolders)
                const filesForTotalNotesCount = allMarkdownFiles.filter(file => {
                    const filePathLower = file.path.toLowerCase();
                    // Check if the file is within any of the top-level excluded folders
                    const inExcludedTopFolder = excludedTopFoldersArray.some(exFolder => filePathLower.startsWith(exFolder + "/"));
                    return !inExcludedTopFolder;
                });
                totalNotesValueEl.setText(filesForTotalNotesCount.length.toLocaleString());

                // Filter files for word count (uses excludedTopFolders AND excludedFromWordcount)
                const filesForWordCount = allMarkdownFiles.filter(file => {
                    const filePathLower = file.path.toLowerCase();
                    const inExcludedTopFolder = excludedTopFoldersArray.some(exFolder => filePathLower.startsWith(exFolder + "/"));
                    const inExcludedWordcountPath = excludedFromWordcountArray.some(exPath => filePathLower.startsWith(exPath));
                    return !inExcludedTopFolder && !inExcludedWordcountPath;
                });

                if (filesForWordCount.length > 0) {
                    totalWordsValueEl.setText(this.getLocalizedString({ en: 'Calculating...', zh: '计算中...' }));
                    
                    let currentTotalWords = 0;
                    const promises = filesForWordCount.map(file => 
                        this.app.vault.cachedRead(file)
                            .then(content => {
                                if (content && typeof content === 'string') {
                                    const fmRegex = /^---[\s\S]*?---[\r\n]*/;
                                    const contentWithoutFM = content.replace(fmRegex, "").trim();
                                    // Simple word count: split by whitespace. Filters out empty strings from multiple spaces.
                                    if (contentWithoutFM) {
                                        currentTotalWords += contentWithoutFM.split(/\s+/).filter(Boolean).length;
                                    }
                                }
                            })
                            .catch(err => {
                                console.warn(`CustomHomepage: Could not read file for word count: ${file.path}`, err);
                                // Optionally count this as 0 or skip
                            })
                    );

                    Promise.all(promises)
                        .then(() => {
                            totalWordsValueEl.setText(currentTotalWords.toLocaleString());
                        })
                        .catch(err => {
                            console.error("CustomHomepage: Error during word count calculation batch", err);
                            totalWordsValueEl.setText(this.getLocalizedString({ en: 'Error', zh: '错误' }));
                        });
                } else {
                    totalWordsValueEl.setText("0");
                }

            } catch (error) {
                console.error("CustomHomepage: Error processing vault stats:", error);
                totalNotesValueEl.setText(this.getLocalizedString({ en: 'Error', zh: '错误' }));
                totalWordsValueEl.setText(this.getLocalizedString({ en: 'Error', zh: '错误' }));
            }
        }

        // --- SECTION: Sidebar To-Do List ---
        // #SECTION_SIDEBAR_TODO_LIST 
        if (this.settings.showTodoSidebarSection) {
            const todoSidebarSection = sidebarArea.createEl('section', { cls: 'homepage-section todo-sidebar-section' });
            const titleEl = todoSidebarSection.createEl('h2', { cls: 'sidebar-title-centered' });
            titleEl.createEl('i', { cls: 'fas fa-list-check' }); // FontAwesome icon for tasks
            titleEl.appendText(` ${this.settings.todoSidebarSectionTitle}`);

            const tasksListContainer = todoSidebarSection.createDiv({ cls: 'todo-sidebar-list-container' });

            try {
                const limit = this.settings.todoSidebarSectionLimit;
                const sourcesQuery = this.settings.todoSidebarSectionSources.trim().toLowerCase();
                const excludedTopFoldersArray = this.settings.excludedTopFolders.split(',')
                    .map(f => f.trim().toLowerCase()).filter(f => f.length > 0);

                let allRelevantFiles = this.app.vault.getMarkdownFiles();

                // Filter files based on sourcesQuery (simplified) - Copied and adapted
                if (sourcesQuery) {
                    if (sourcesQuery.startsWith('#')) {
                        const tagName = sourcesQuery.substring(1);
                        allRelevantFiles = allRelevantFiles.filter(file => {
                            const cache = this.app.metadataCache.getFileCache(file);
                            const tags = cache?.frontmatter?.tags;
                            let fileTags = cache?.tags?.map(t => t.tag.substring(1).toLowerCase()) || [];
                            if (tags) {
                                if (Array.isArray(tags)) fileTags = fileTags.concat(tags.map(t => String(t).toLowerCase()));
                                else fileTags.push(String(tags).toLowerCase());
                            }
                            return [...new Set(fileTags)].includes(tagName);
                        });
                    } else if (sourcesQuery.includes('/') || this.app.vault.getAbstractFileByPath(sourcesQuery) instanceof TFolder) { 
                        const folderPath = sourcesQuery.endsWith('/') ? sourcesQuery : sourcesQuery + "/";
                        allRelevantFiles = allRelevantFiles.filter(file => file.path.toLowerCase().startsWith(folderPath.toLowerCase()));
                    } else if (sourcesQuery) { // General keyword in path (less reliable for tasks)
                        allRelevantFiles = allRelevantFiles.filter(file => file.path.toLowerCase().includes(sourcesQuery));
                    }
                }
                
                const allTasks = [];
                for (const file of allRelevantFiles) {
                    const filePathLower = file.path.toLowerCase();
                    if (excludedTopFoldersArray.some(exFolder => filePathLower.startsWith(exFolder + "/"))) {
                        continue; 
                    }

                    const cache = this.app.metadataCache.getFileCache(file);
                    if (cache && cache.listItems) {
                        for (const item of cache.listItems) {
                            if (item.task && (item.task === ' ' || item.task === '/')) { 
                                const taskTextContent = await this.getOriginalTaskText(file, item.position.start.line);
                                allTasks.push({
                                    text: taskTextContent,
                                    file: file,
                                    line: item.position.start.line,
                                    status: item.task, 
                                    mtime: file.stat.mtime 
                                });
                            }
                        }
                    }
                } 

                allTasks.sort((a, b) => {
                    if (a.file.stat.mtime !== b.file.stat.mtime) {
                        return b.file.stat.mtime - a.file.stat.mtime; 
                    }
                    return a.line - b.line; 
                });

                const tasksToShow = allTasks.slice(0, limit);

                if (tasksToShow.length > 0) {
                    tasksToShow.forEach(task => {
                        // Each task item is now a link itself
                        const taskItemLink = tasksListContainer.createEl('a', {
                            cls: 'internal-link todo-sidebar-item', // Item itself is the link
                            href: task.file.path, // CHANGED: Link to the file path directly
                            attr: { 
                                'data-href': task.file.path, // CHANGED: data-href also points to the file path
                                // 'title': task.file.path // REMOVED or SIMPLIFIED: title attribute is less critical if hover shows file preview
                                                             // You can keep it if you want a simple path tooltip, or remove it.
                                                             // If kept, just task.file.path is enough.
                            }
                        });
                        
                        const taskTextSpan = taskItemLink.createSpan({ cls: 'todo-sidebar-item-text' });
                        let taskContent = task.text; 
                        
                        const taskRenderComponent = new Component();
                        this.addChild(taskRenderComponent);
                        MarkdownRenderer.renderMarkdown(taskContent, taskTextSpan, task.file.path, taskRenderComponent)
                            .finally(() => {
                                if (taskRenderComponent && !taskRenderComponent._loaded) {
                                    this.removeChild(taskRenderComponent);
                                }
                            });
                    });
                } else {
                    tasksListContainer.createEl('p', { 
                        cls: 'empty-message', 
                        text: this.getLocalizedString({ en: 'All tasks completed!', zh: '所有任务已完成！' }) 
                    });
                }

            } catch (error) {
                console.error("CustomHomepage: Error processing Sidebar To-Do List:", error);
                tasksListContainer.createEl('p', { 
                    cls: 'empty-message', 
                    text: this.getLocalizedString({ en: 'Error loading tasks. Check console.', zh: '加载待办清单出错，请查看控制台。' }) 
                });
            }
        }

        // --- SECTION: To-Do Notes ---
        // #SECTION_TODO_NOTES
        if (this.settings.showTodoNotes) {
            const todoSection = sidebarArea.createEl('section', { cls: 'homepage-section todo-notes-section' });
            const titleEl = todoSection.createEl('h2', { cls: 'sidebar-title-centered' });
            titleEl.createEl('i', {cls: 'fas fa-exclamation-triangle'}); // FontAwesome icon
            titleEl.appendText(` ${this.settings.todoTagDisplay}`);

            const todoListContainer = todoSection.createDiv({ cls: 'recent-files-list' }); // Re-use recent-files-list styling

            try {
                const query = this.settings.todoTagQuery.trim();
                const limit = this.settings.todoFilesLimit;
                const excludedTopFoldersArray = this.settings.excludedTopFolders.split(',')
                    .map(f => f.trim().toLowerCase()).filter(f => f.length > 0);

                if (!query) {
                    todoListContainer.createEl('p', { 
                        cls: 'empty-message', 
                        text: this.getLocalizedString({ en: 'To-Do query is not configured.', zh: '“待整理笔记”的查询条件未配置。' }) 
                    });
                } else {
                    let allMarkdownFiles = this.app.vault.getMarkdownFiles();
                    let filteredNotes = [];

                    // Basic Query Logic:
                    if (query.startsWith('#')) { // Tag query
                        const tagName = query.substring(1);
                        filteredNotes = allMarkdownFiles.filter(file => {
                            const cache = this.app.metadataCache.getFileCache(file);
                            // Ensure tags exist and handle both string and array formats for tags in frontmatter
                            const tags = cache?.frontmatter?.tags;
                            let fileTags = cache?.tags?.map(t => t.tag.substring(1)) || []; // Tags from body like #tag
                            if (tags) { // Tags from frontmatter
                                if (Array.isArray(tags)) {
                                    fileTags = fileTags.concat(tags.map(t => String(t).toLowerCase()));
                                } else {
                                    fileTags.push(String(tags).toLowerCase());
                                }
                            }
                            // Deduplicate and check
                            return [...new Set(fileTags)].includes(tagName.toLowerCase());
                        });
                    } else if (query.includes('/')) { // Likely a folder path query (simplified)
                        const folderPath = query.toLowerCase().endsWith('/') ? query.toLowerCase() : query.toLowerCase() + "/";
                        filteredNotes = allMarkdownFiles.filter(file => file.path.toLowerCase().startsWith(folderPath));
                    } else if (query) { // Treat as a general keyword in path/name if not tag/folder (can be expanded)
                         filteredNotes = allMarkdownFiles.filter(file => file.path.toLowerCase().includes(query.toLowerCase()));
                    }


                    // Further exclude based on excludedTopFoldersArray
                    filteredNotes = filteredNotes.filter(file => {
                        const filePathLower = file.path.toLowerCase();
                        return !excludedTopFoldersArray.some(exFolder => filePathLower.startsWith(exFolder + "/"));
                    });

                    // Sort by modification time, oldest first
                    filteredNotes.sort((a, b) => a.stat.mtime - b.stat.mtime);

                    // Apply limit
                    const notesToShow = filteredNotes.slice(0, limit);

                    if (notesToShow.length > 0) {
                        notesToShow.forEach(file => {
                            const itemEl = todoListContainer.createDiv({ cls: 'recent-file-item' });
                            itemEl.createEl('a', {
                                cls: 'internal-link recent-file-link',
                                text: this.getPageDisplayName(file, this.app.metadataCache.getFileCache(file)?.frontmatter),
                                href: file.path,
                                attr: { 'data-href': file.path }
                            });
                            const metaEl = itemEl.createDiv({ cls: 'recent-file-meta' });
                            let folderDisplayPath = '';
                            let folderDisplayName = '';

                            if (file.parent && file.parent.path !== '/') { // Check if parent exists and is not the root
                                folderDisplayName = file.parent.name;
                                folderDisplayPath = file.parent.path;
                            } else {
                                folderDisplayName = this.getLocalizedString({ en: 'Vault Root', zh: '根目录' });
                                folderDisplayPath = '/'; // Or this.app.vault.getRoot().path
                            }

                            metaEl.createSpan({ 
                                cls: 'recent-file-folder', 
                                text: folderDisplayName,
                                attr: { title: folderDisplayPath }
                            });
                            metaEl.createSpan({ cls: 'note-time', text: moment(file.stat.mtime).fromNow() });
                        });
                    } else {
                        todoListContainer.createEl('p', { 
                            cls: 'empty-message', 
                            text: this.getLocalizedString({ en: 'Great! No notes to organize.', zh: '太棒了！没有待整理的笔记。' }) 
                        });
                    }
                }
            } catch (error) {
                console.error("CustomHomepage: Error processing To-Do notes section:", error);
                todoListContainer.createEl('p', { 
                    cls: 'empty-message', 
                    text: this.getLocalizedString({ en: 'Error loading To-Do notes. Check console.', zh: '加载待整理笔记出错，请查看控制台。' }) 
                });
            }
        }
        // --- SECTION: Recent Edits ---
        // #SECTION_RECENT_EDITS
        if (this.settings.showRecentEdits) {
            const recentSection = sidebarArea.createEl('section', { cls: 'homepage-section recent-edits-section' });
            const titleEl = recentSection.createEl('h2', { cls: 'sidebar-title-centered' });
            titleEl.createEl('i', {cls: 'fas fa-history'}); // FontAwesome icon
            titleEl.appendText(` ${this.getLocalizedString({ en: 'Recent Edits', zh: '最近编辑' })}`); // Title is now internationalized

            const recentListContainer = recentSection.createDiv({ cls: 'recent-files-list' });

            try {
                const limit = this.settings.recentFilesLimitSidebar;
                const excludedTopFoldersArray = this.settings.excludedTopFolders.split(',')
                    .map(f => f.trim().toLowerCase()).filter(f => f.length > 0);
                
                // Get current homepage path from the context to exclude it
                const homepagePath = ctx.sourcePath; 

                let allMarkdownFiles = this.app.vault.getMarkdownFiles();
                
                // Filter notes
                let filteredNotes = allMarkdownFiles.filter(file => {
                    // Exclude current homepage file
                    if (file.path === homepagePath) return false;

                    const filePathLower = file.path.toLowerCase();
                    // Exclude files in excludedTopFolders
                    if (excludedTopFoldersArray.some(exFolder => filePathLower.startsWith(exFolder + "/"))) {
                        return false;
                    }
                    return true;
                });

                // Sort by modification time, newest first
                filteredNotes.sort((a, b) => b.stat.mtime - a.stat.mtime);

                // Apply limit
                const notesToShow = filteredNotes.slice(0, limit);

                if (notesToShow.length > 0) {
                    notesToShow.forEach(file => {
                        const itemEl = recentListContainer.createDiv({ cls: 'recent-file-item' });
                        itemEl.createEl('a', {
                            cls: 'internal-link recent-file-link',
                            text: this.getPageDisplayName(file, this.app.metadataCache.getFileCache(file)?.frontmatter),
                            href: file.path,
                            attr: { 'data-href': file.path }
                        });
                        const metaEl = itemEl.createDiv({ cls: 'recent-file-meta' });
                        let folderDisplayPath = '';
                        let folderDisplayName = '';

                        if (file.parent && file.parent.path !== '/') { // Check if parent exists and is not the root
                            folderDisplayName = file.parent.name;
                            folderDisplayPath = file.parent.path;
                        } else {
                            folderDisplayName = this.getLocalizedString({ en: 'Vault Root', zh: '根目录' });
                            folderDisplayPath = '/'; // Or this.app.vault.getRoot().path
                        }

                        metaEl.createSpan({ 
                            cls: 'recent-file-folder', 
                            text: folderDisplayName,
                            attr: { title: folderDisplayPath }
                        });
                        metaEl.createSpan({ cls: 'note-time', text: moment(file.stat.mtime).fromNow() });
                    });
                } else {
                    recentListContainer.createEl('p', { 
                        cls: 'empty-message', 
                        text: this.getLocalizedString({ en: 'No recently edited files found (excluding the homepage).', zh: '暂无最近编辑的文件（不包括主页本身）。' }) 
                    });
                }
            } catch (error) {
                console.error("CustomHomepage: Error processing Recent Edits section:", error);
                recentListContainer.createEl('p', { 
                    cls: 'empty-message', 
                    text: this.getLocalizedString({ en: 'Error loading recent edits. Check console.', zh: '加载最近编辑出错，请查看控制台。' }) 
                });
            }
        }
        
        // --- SECTION: Quick Access (Placeholder) ---
        // #SECTION_QUICK_ACCESS
        if (this.settings.showQuickAccess) {
            const quickAccessSection = sidebarArea.createEl('section', { cls: 'homepage-section quick-access-section' });
            quickAccessSection.createEl('h2', { text: '快速访问', cls: 'sidebar-title-centered' }); // Title can be setting too
            
            // --- Sub-Section: Top Tags (within Quick Access) ---
            // #SUBSECTION_QA_TOP_TAGS (New marker for clarity)
            if (this.settings.showQuickAccess && this.settings.showQuickAccessTopTags) {
                const topTagsContainer = quickAccessSection.createDiv({cls: 'quick-access-item'}); // Each QA part is an item
                topTagsContainer.createEl('h4', { text: this.getLocalizedString({ en: 'Top Tags', zh: '常用标签' }) });
                
                const tagListEl = topTagsContainer.createEl('ul', { cls: 'tag-list' });

                try {
                    const limit = this.settings.topTagsLimit;
                    const excludedTopFoldersArray = this.settings.excludedTopFolders.split(',')
                        .map(f => f.trim().toLowerCase()).filter(f => f.length > 0);

                    const tagCounts = new Map();
                    const allMarkdownFiles = this.app.vault.getMarkdownFiles();

                    allMarkdownFiles.forEach(file => {
                        // Exclude files from excluded top folders for tag counting as well
                        const filePathLower = file.path.toLowerCase();
                        if (excludedTopFoldersArray.some(exFolder => filePathLower.startsWith(exFolder + "/"))) {
                            return; // Skip this file
                        }

                        const cache = this.app.metadataCache.getFileCache(file);
                        if (!cache) return;

                        let fileUniqueTags = new Set();

                        // Get tags from frontmatter (string or array)
                        const fmTags = cache.frontmatter?.tags;
                        if (fmTags) {
                            if (Array.isArray(fmTags)) {
                                fmTags.forEach(tag => fileUniqueTags.add(String(tag).trim().replace(/^#/, '').toLowerCase()));
                            } else {
                                fileUniqueTags.add(String(fmTags).trim().replace(/^#/, '').toLowerCase());
                            }
                        }

                        // Get tags from file body (e.g., #tag)
                        if (cache.tags) {
                            cache.tags.forEach(tagObj => {
                                fileUniqueTags.add(tagObj.tag.replace(/^#/, '').toLowerCase());
                            });
                        }
                        
                        // Increment count for each unique tag in the current file
                        fileUniqueTags.forEach(cleanedTag => {
                            if (cleanedTag) { // Ensure tag is not empty
                                tagCounts.set(cleanedTag, (tagCounts.get(cleanedTag) || 0) + 1);
                            }
                        });
                    });

                    const sortedTags = Array.from(tagCounts.entries())
                        .sort(([, countA], [, countB]) => countB - countA) // Sort by count descending
                        .slice(0, limit);

                    if (sortedTags.length > 0) {
                        sortedTags.forEach(([tag, count]) => {
                            const listItem = tagListEl.createEl('li');
                            // Create a link that opens the Obsidian search for this tag
                            const searchTag = tag.includes(' ') || /[#/"']/.test(tag) ? `"${tag}"` : tag;
                            listItem.createEl('a', {
                                text: `#${tag}`,
                                cls: 'tag-search-link', // Use class from original CSS for styling
                                href: `obsidian://search?query=${encodeURIComponent("tag:" + searchTag)}`,
                                attr: { target: '_blank', rel: 'noopener noreferrer' } // Good practice for external-like links
                            });
                            listItem.createSpan({ cls: 'tag-count', text: count.toString() });
                        });
                    } else {
                        tagListEl.createEl('li').createEl('p', { 
                            cls: 'empty-message', 
                            text: this.getLocalizedString({ en: 'No tags found in your vault.', zh: '您的 vault 中暂无标签。' }) 
                        });
                    }

                } catch (error) {
                    console.error("CustomHomepage: Error processing Top Tags section:", error);
                    tagListEl.createEl('li').createEl('p', { 
                        cls: 'empty-message', 
                        text: this.getLocalizedString({ en: 'Error loading tags. Check console.', zh: '加载常用标签出错，请查看控制台。' }) 
                    });
                }
            }

            // --- Sub-Section: Obsidian Bookmarks (within Quick Access) ---
            // #SUBSECTION_QA_BOOKMARKS (New marker)
            if (this.settings.showQuickAccess && this.settings.showQuickAccessBookmarks) {
                const bookmarksContainer = quickAccessSection.createDiv({cls: 'quick-access-item'});
                bookmarksContainer.createEl('h4', { text: this.settings.quickAccessBookmarksTitle }); // 使用设置中的标题
                
                const bookmarkListEl = bookmarksContainer.createEl('ul', { cls: 'custom-links-list' }); // 使用与原CSS中自定义链接相似的类

                try {
                    const bookmarksPlugin = this.app.internalPlugins.plugins.bookmarks;
                    if (bookmarksPlugin && bookmarksPlugin.enabled && bookmarksPlugin.instance) {
                        // bookmarksPlugin.instance.getBookmarks() 应该返回一个数组
                        // 我们需要一个扁平化的书签列表，包括分组内的书签
                        const allBookmarkItems = [];
                        
                        // Recursive function to flatten bookmarks, including those in groups
                        const flattenBookmarks = (items) => {
                            if (!items || !Array.isArray(items)) return;
                            for (const item of items) {
                                if (item.type === 'group') {
                                    flattenBookmarks(item.items); // Recursively process group items
                                } else {
                                    allBookmarkItems.push(item);
                                }
                            }
                        };
                        
                        // The actual method to get bookmarks might be directly on instance
                        // or through a manager. Let's assume instance.items or instance.getBookmarks()
                        // For demonstration, let's assume `instance.items` holds the top-level bookmark items.
                        // This part is CRITICAL and depends on the exact Bookmarks plugin API.
                        // You may need to inspect `app.internalPlugins.plugins.bookmarks.instance` in console.
                        const bookmarkData = bookmarksPlugin.instance.items || (typeof bookmarksPlugin.instance.getBookmarks === 'function' ? bookmarksPlugin.instance.getBookmarks() : []);
                        flattenBookmarks(bookmarkData);


                        if (allBookmarkItems.length > 0) {
                            allBookmarkItems.forEach(bookmark => {
                                const listItem = bookmarkListEl.createEl('li');
                                let linkText = bookmark.title || ''; // Use custom title if available
                                let href = '#'; // Default href

                                // Determine link text and href based on bookmark type
                                switch (bookmark.type) {
                                    case 'file':
                                        if (!linkText) linkText = bookmark.path.split('/').pop(); // Filename as fallback
                                        href = bookmark.path;
                                        break;
                                    case 'folder':
                                        // Folders in bookmarks often don't have a direct 'open' action
                                        // We can link to reveal the folder in file explorer
                                        if (!linkText) linkText = bookmark.path.split('/').pop() || bookmark.path;
                                        // For folders, a direct click might not be standard via openLinkText.
                                        // We can make it open the folder in the file explorer if possible,
                                        // or just display it. For simplicity, we'll make it a non-clickable or informational item.
                                        // Or, create a link that attempts to navigate if you know the command.
                                        // For now, let's make it a display item with a folder icon.
                                        listItem.createEl('span', { text: `📁 ${linkText} (文件夹)` });
                                        return; // Skip creating an <a> tag for now for folders
                                    case 'heading':
                                        if (!linkText) linkText = `${bookmark.path.split('/').pop()} > ${bookmark.subpath?.substring(1)}`;
                                        href = `${bookmark.path}${bookmark.subpath}`; // e.g., "path/to/file.md#Heading"
                                        break;
                                    case 'block':
                                        if (!linkText) linkText = `${bookmark.path.split('/').pop()} > ^${bookmark.subpath?.substring(1)}`;
                                        href = `${bookmark.path}${bookmark.subpath}`; // e.g., "path/to/file.md#^blockid"
                                        break;
                                    case 'search':
                                        if (!linkText) linkText = this.getLocalizedString({ en: `Search: ${bookmark.query}`, zh: `搜索: ${bookmark.query}`});
                                        // Constructing an obsidian://search?query=... URL
                                        href = `obsidian://search?vault=${encodeURIComponent(this.app.vault.getName())}&query=${encodeURIComponent(bookmark.query)}`;
                                        break;
                                    default:
                                        if (!linkText && bookmark.path) linkText = bookmark.path;
                                        else if (!linkText) linkText = this.getLocalizedString({en: 'Unknown Bookmark Type', zh: '未知书签类型'});
                                        // For unknown types, don't make it a clickable link unless path is present
                                        if(bookmark.path) href = bookmark.path; else {
                                            listItem.createSpan({text: linkText});
                                            return;
                                        }
                                }
                                
                                const linkEl = listItem.createEl('a', {
                                    text: linkText,
                                    // href: href, // href is set by openLinkText or data-href
                                    cls: (bookmark.type === 'search' || href.startsWith('obsidian://')) ? 'external-link' : 'internal-link', // Style search links as external
                                });

                                if (bookmark.type === 'search' || href.startsWith('obsidian://')) {
                                    linkEl.setAttr('href', href); // For obsidian:// URLs, set href directly
                                    linkEl.setAttr('target', '_blank');
                                    linkEl.setAttr('rel', 'noopener noreferrer');
                                } else {
                                    // For internal links (files, headings, blocks)
                                    linkEl.setAttr('href', href); // obsidian will handle this
                                    linkEl.setAttr('data-href', href); // for consistent internal link handling
                                    // No need to explicitly call openLinkText here if href is set correctly for internal links
                                }
                            });
                        } else {
                            bookmarkListEl.createEl('li').createEl('p', { 
                                cls: 'empty-message', 
                                text: this.getLocalizedString({ en: 'No bookmarks found.', zh: '暂无书签。' }) 
                            });
                        }
                    } else {
                        bookmarkListEl.createEl('li').createEl('p', { 
                            cls: 'empty-message', 
                            text: this.getLocalizedString({ en: 'Bookmarks plugin is not enabled or not available.', zh: '书签插件未启用或不可用。' }) 
                        });
                    }
                } catch (error) {
                    console.error("CustomHomepage: Error processing Obsidian Bookmarks section:", error);
                    bookmarkListEl.createEl('li').createEl('p', { 
                        cls: 'empty-message', 
                        text: this.getLocalizedString({ en: 'Error loading bookmarks. Check console.', zh: '加载书签出错，请查看控制台。' }) 
                    });
                }
            }
        }

        // --- JAVASCRIPT FOR INTERACTIVITY (Placeholder) ---
        // #JS_INTERACTIVITY
        // This is where we'll add event listeners for "toggle more", accordion, etc.
        // For now, we can add the script tag logic for accordion if needed,
        // but ideally, we'll convert this to direct JS.
        if (this.settings.accordionModeForDetails) {
            // Add accordion logic here, directly manipulating details elements
            // after they are rendered.
        }
    }
}

// ... (其他代码保持不变) ...

// --- PLUGIN SETTINGS TAB CLASS ---
// #SETTINGS_TAB_CLASS
class HomepageSettingTab extends PluginSettingTab {
    /** @type {CustomDynamicHomepagePlugin} */
    plugin;

    /**
     * @param {import('obsidian').App} app
     * @param {CustomDynamicHomepagePlugin} plugin
     */
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();

        // --- MAIN TITLE FOR SETTINGS PAGE ---
        // #SETTINGS_PAGE_TITLE
        containerEl.createEl('h1', {
            text: this.plugin.getLocalizedString({
                en: 'Minimalist Homepage Settings',
                zh: '极简主页设置'
            })
        });

        // --- SETTING: Homepage File Path ---
        // #SETTING_ITEM_HOMEPAGE_FILE_PATH
        new Setting(containerEl)
            .setName(this.plugin.getLocalizedString({
                en: 'Homepage File Path',
                zh: '主页文件路径'
            }))
            .setDesc(this.plugin.getLocalizedString({
                en: 'The full path to your homepage Markdown file (e.g., "Home.md" or "Dashboards/Main.md"). Plugin styles for full-width and no-title will apply to this file.',
                zh: '您的主页 Markdown 文件的完整路径（例如："Home.md" 或 "Dashboards/Main.md"）。插件的全宽和无标题样式将应用于此文件。'
            }))
            .addText(text => text
                .setPlaceholder('Home.md')
                .setValue(this.plugin.settings.homepageFilePath)
                .onChange(async (value) => {
                    this.plugin.settings.homepageFilePath = value.trim() || DEFAULT_SETTINGS.homepageFilePath;
                    await this.plugin.saveSettings();
                }));

        // 在 display() 方法中，例如紧跟在 "Homepage File Path" 设置之后
        // #SETTING_ITEM_OPEN_ON_STARTUP
        new Setting(containerEl)
            .setName(this.plugin.getLocalizedString({
                en: "Open Homepage on Startup",
                zh: "启动时自动打开主页"
            }))
            .setDesc(this.plugin.getLocalizedString({
                en: "If enabled, the plugin will automatically open your homepage when Obsidian starts.",
                zh: "如果启用，插件将在 Obsidian 启动时自动打开您的主页。"
            }))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.openHomepageOnStartup)
                .onChange(async (value) => {
                    this.plugin.settings.openHomepageOnStartup = value;
                    await this.plugin.saveSettings();
                }));

        // --- SUB-HEADING: Main Content Area Modules ---
        // #SETTINGS_SUBHEADING_MAIN_CONTENT
        containerEl.createEl('h3', {
            text: this.plugin.getLocalizedString({
                en: 'Main Content Area Modules',
                zh: '主内容区模块'
            })
        });

        // --- SUB-HEADING: Daily Display Section ---
        // #SETTINGS_SUBHEADING_Daily Display Section
        containerEl.createEl('h4', {
            text: this.plugin.getLocalizedString({
                en: 'Daily Display Section',
                zh: '每日模块'
            })
        });

        // --- SETTING: Show Daily Display ---
        // #SETTING_ITEM_SHOW_DAILY_DISPLAY
        new Setting(containerEl)
            .setName(this.plugin.getLocalizedString({
                en: 'Show Daily Display Section',
                zh: '显示每日模块'
            }))
            .setDesc(this.plugin.getLocalizedString({
                en: 'Toggle the "Daily Display" section.',
                zh: '切换“每日模块”的显示状态。'
            }))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showDailyDisplay)
                .onChange(async (value) => {
                    this.plugin.settings.showDailyDisplay = value;
                    await this.plugin.saveSettings();
                }));

        // --- SETTING: Daily Display Main Label ---
        // #SETTING_ITEM_DAILY_DISPLAY_LABEL
        new Setting(containerEl)
            .setName(this.plugin.getLocalizedString({
                en: 'Daily Display Label',
                zh: '每日模块标题'
            }))
            .setDesc(this.plugin.getLocalizedString({
                en: 'Title for the Daily Display section.',
                zh: '“每日模块”的标题文本。'
            }))
            .addText(text => text
                .setPlaceholder(DEFAULT_SETTINGS.dailyDisplayMainLabel)
                .setValue(this.plugin.settings.dailyDisplayMainLabel)
                .onChange(async (value) => {
                    this.plugin.settings.dailyDisplayMainLabel = value || DEFAULT_SETTINGS.dailyDisplayMainLabel;
                    await this.plugin.saveSettings();
                }));

        // #SETTING_ITEM_DAILY_DISPLAY_METADATA_FIELD
        new Setting(containerEl)
            .setName(this.plugin.getLocalizedString({
                en: 'Daily Display Metadata Field Key',
                zh: '每日模块元数据字段名'
            }))
            .setDesc(this.plugin.getLocalizedString({
                en: 'The frontmatter key used to filter notes for Daily Display (e.g., form, type, category).',
                zh: '用于筛选“每日模块”笔记的元数据字段名 (例如：form, type, category)。'
            }))
            .addText(text => text
                .setPlaceholder(DEFAULT_SETTINGS.dailyDisplayMetadataField) // 使用新的默认值
                .setValue(this.plugin.settings.dailyDisplayMetadataField)
                .onChange(async (value) => {
                    this.plugin.settings.dailyDisplayMetadataField = value.trim() || DEFAULT_SETTINGS.dailyDisplayMetadataField;
                    await this.plugin.saveSettings();
                }));

        // --- SETTING: Daily Display Forms ---
        // #SETTING_ITEM_DAILY_DISPLAY_FORMS
        new Setting(containerEl)
            .setName(this.plugin.getLocalizedString({
                en: 'Daily Display Forms (Comma-separated)',
                zh: '每日模块适用文档类型 (逗号分隔)'
            }))
            .setDesc(this.plugin.getLocalizedString({
                en: 'Note frontmatter(e.g. "form") values to consider for daily display (e.g., poem,prose). Case-insensitive.',
                zh: '笔记中元数据(如"form")的值，用于筛选每日模块的内容 (例如：诗,词,文言文)。不区分大小写。'
            }))
            .addText(text => text
                .setPlaceholder(DEFAULT_SETTINGS.dailyDisplayForms)
                .setValue(this.plugin.settings.dailyDisplayForms)
                .onChange(async (value) => {
                    this.plugin.settings.dailyDisplayForms = value; // User input, will be processed later
                    await this.plugin.saveSettings();
                }));

        containerEl.createEl('h4', { 
            text: this.plugin.getLocalizedString({
                en: 'Dynamic Note List Modules', 
                zh: '动态笔记列表模块'
            })
        }).style.marginTop = '30px';

        // Button to add a new dynamic module
        // #SETTING_ADD_DYNAMIC_MODULE_BUTTON
        new Setting(containerEl)
            .setName(this.plugin.getLocalizedString({ en: 'Add New Dynamic List Module', zh: '添加新的动态列表模块' }))
            .setDesc(this.plugin.getLocalizedString({ en: 'Create a new configurable module to display filtered notes in the main content area.', zh: '创建一个新的可配置模块，用于在主内容区域显示筛选后的笔记。'}))
            .addButton(button => button
                .setButtonText(this.plugin.getLocalizedString({ en: '+ Add Module', zh: '+ 添加模块' }))
                .setCta() // Makes it more prominent
                .onClick(async () => {
                    // --- BEGIN: Scroll position workaround ---
                    let scrollY = 0;
                    const settingsContent = containerEl.closest('.vertical-tab-content'); // Common Obsidian settings scroll container
                    if (settingsContent) {
                        scrollY = settingsContent.scrollTop;
                    }
                    // --- END: Scroll position workaround ---
                    
                    const newModuleId = `dnl-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
                    const newModule = {
                        id: newModuleId,
                        userDefinedTitle: this.plugin.getLocalizedString({en: "New Dynamic List ", zh: "新动态列表 "}) + (this.plugin.settings.dynamicNoteListModules.length + 1),
                        enabled: true,
                        filterGroup: { logic: 'AND', conditions: [], isNegated: false },
                        displaySettings: {
                            columns: 3,
                            pillColors: { // Default colors or from a global default
                                and: DEFAULT_SETTINGS.dynamicNoteListModules[0]?.displaySettings.pillColors.and || 'var(--color-green)',
                                or: DEFAULT_SETTINGS.dynamicNoteListModules[0]?.displaySettings.pillColors.or || 'var(--color-orange)',
                                not: DEFAULT_SETTINGS.dynamicNoteListModules[0]?.displaySettings.pillColors.not || 'var(--color-red)'
                            }
                        }
                    };
                    this.plugin.settings.dynamicNoteListModules.push(newModule);
                    await this.plugin.saveSettings();
                    this.display(); // Re-render the settings tab to show the new module

                    // --- BEGIN: Restore scroll position ---
                    if (settingsContent) {
                        // Needs to happen after display() has fully re-rendered.
                        // requestAnimationFrame can help ensure DOM is updated.
                        requestAnimationFrame(() => {
                            settingsContent.scrollTop = scrollY;
                        });
                    }
                    // --- END: Restore scroll position ---
                }));

        // Container for existing dynamic modules
        // #SETTINGS_DYNAMIC_MODULES_LIST_CONTAINER
        const modulesContainer = containerEl.createDiv('dynamic-modules-list-container');

        this.plugin.settings.dynamicNoteListModules.forEach((moduleItem, index) => {
            // #SETTINGS_INDIVIDUAL_DYNAMIC_MODULE_ITEM
            const moduleSettingContainer = modulesContainer.createEl('div', { cls: 'dynamic-module-setting-item' });
            
            // Using a Setting as a header for the collapsible section with controls
            const moduleHeaderSetting = new Setting(moduleSettingContainer)
                .setName(`${this.plugin.getLocalizedString({en:"Module:", zh:"模块:"})} ${moduleItem.userDefinedTitle || `List ${index + 1}`}`)
                .setHeading() // Makes it look like a sub-header for the module
                .addExtraButton(button => button // Enable/Disable Toggle
                    .setIcon(moduleItem.enabled ? 'lucide-power' : 'lucide-power-off')
                    .setTooltip(moduleItem.enabled ? this.plugin.getLocalizedString({en:"Disable this module", zh:"禁用此模块"}) : this.plugin.getLocalizedString({en:"Enable this module", zh:"启用此模块"}))
                    .onClick(async () => {
                        moduleItem.enabled = !moduleItem.enabled;
                        await this.plugin.saveSettings();
                        this.display(); // Re-render
                    }))
                .addExtraButton(button => button // Delete Button
                    .setIcon('trash')
                    .setTooltip(this.plugin.getLocalizedString({en:"Delete this module", zh:"删除此模块"}))
                    .onClick(async () => {
                        if (confirm(this.plugin.getLocalizedString({en:"Are you sure you want to delete this module?", zh:"您确定要删除此模块吗？"}))) {
                            this.plugin.settings.dynamicNoteListModules.splice(index, 1);
                            await this.plugin.saveSettings();
                            this.display(); // Re-render
                        }
                    }));
            
            // --- Placeholder for module's detailed settings (collapsible part) ---
            const detailsEl = moduleSettingContainer.createEl('details', { cls: 'dynamic-module-details' });
            detailsEl.createEl('summary', { text: this.plugin.getLocalizedString({en:"Configure Module", zh:"配置模块"}) });
            const configContentEl = detailsEl.createDiv({cls: 'dynamic-module-config-content'});

            // 1. User Defined Title for this module
            new Setting(configContentEl)
                .setName(this.plugin.getLocalizedString({ en: "Module Title (for settings)", zh: "模块标题 (用于设置界面)" }))
                .addText(text => text
                    .setValue(moduleItem.userDefinedTitle)
                    .onChange(async (value) => {
                        moduleItem.userDefinedTitle = value;
                        await this.plugin.saveSettings();
                        // No need to full re-render display() for this, but header might need update if shown live
                        // For simplicity, we can let the next full display() call update it, or:
                        moduleHeaderSetting.setName(`${this.plugin.getLocalizedString({en:"Module:", zh:"模块:"})} ${moduleItem.userDefinedTitle || `List ${index + 1}`}`);
                    }));

            // 2. Display Settings: Columns
            new Setting(configContentEl)
                .setName(this.plugin.getLocalizedString({ en: "Number of Columns", zh: "列数" }))
                .addSlider(slider => slider
                    .setLimits(1, 5, 1)
                    .setValue(moduleItem.displaySettings.columns)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        moduleItem.displaySettings.columns = value;
                        await this.plugin.saveSettings();
                    }));

            // 3. Filter Group Editor
            // #SETTINGS_FILTER_GROUP_EDITOR
            configContentEl.createEl('h5', { text: this.plugin.getLocalizedString({en:"Filter Conditions", zh:"筛选条件"}) });
            const filterGroupContainer = configContentEl.createDiv({cls: 'filter-group-editor-container'});

            // Get the filterGroup for the current moduleItem
            const currentFilterGroup = moduleItem.filterGroup; // Assumes filterGroup always exists

            // A. Setting for the FilterGroup's logic (AND/OR)
            new Setting(filterGroupContainer)
                .setName(this.plugin.getLocalizedString({ en: "Combine conditions using:", zh: "条件组合方式:" }))
                .setDesc(this.plugin.getLocalizedString({ en: "Choose how multiple conditions in this group are logically combined.", zh: "选择组内多个条件之间的逻辑组合方式。" }))
                .addDropdown(dropdown => dropdown
                    .addOption('AND', this.plugin.getLocalizedString({ en: 'AND (all conditions must match)', zh: '与 (所有条件均需匹配)' }))
                    .addOption('OR', this.plugin.getLocalizedString({ en: 'OR (any condition can match)', zh: '或 (任意条件匹配即可)' }))
                    .setValue(currentFilterGroup.logic)
                    .onChange(async (value) => {
                        currentFilterGroup.logic = value; // Value will be 'AND' or 'OR'
                        await this.plugin.saveSettings();
                        // No need to re-render entire display for this usually, unless UI depends on it
                    }));

            // B. Setting for the FilterGroup's isNegated (NOT operator for the whole group)
            new Setting(filterGroupContainer)
                .setName(this.plugin.getLocalizedString({ en: "Negate this entire group (NOT)", zh: "反转整个筛选组 (非)" }))
                .setDesc(this.plugin.getLocalizedString({ en: "If enabled, notes matching this group's conditions will be excluded, and notes not matching will be included.", zh: "如果启用，符合此组条件的笔记将被排除，不符合条件的笔记将被包含。" }))
                .addToggle(toggle => toggle
                    .setValue(!!currentFilterGroup.isNegated) // Ensure it's a boolean
                    .onChange(async (value) => {
                        currentFilterGroup.isNegated = value;
                        await this.plugin.saveSettings();
                    }));
            
            filterGroupContainer.createEl('hr'); // Separator

            // C. Display existing conditions (placeholder for now, will be detailed list items)
            const conditionsListEl = filterGroupContainer.createDiv({cls: 'filter-conditions-list'});
            if (currentFilterGroup.conditions && currentFilterGroup.conditions.length > 0) {
                currentFilterGroup.conditions.forEach((condition, condIndex) => {
                    // #SETTINGS_INDIVIDUAL_FILTER_CONDITION_ITEM (New marker)
                    const conditionItemContainer = conditionsListEl.createDiv({cls: 'filter-condition-item'});
                    conditionItemContainer.setText(
                        `Condition ${condIndex + 1}: ${condition.property || '[Prop]'} ${condition.operator || '[Op]'} ${condition.value !== undefined ? condition.value : '[Val]'}`
                    );
                    // TODO: Implement full editor for each condition (property, operator, value, delete button)
                    // For now, just a placeholder text.
                });
            } else {
                conditionsListEl.createEl('p', { 
                    cls: 'empty-message-compact', // A more compact empty message
                    text: this.plugin.getLocalizedString({en: "No conditions added yet.", zh: "尚未添加任何条件。"})
                });
            }

            // D. Button to add a new condition
            // #SETTINGS_ADD_FILTER_CONDITION_BUTTON
            new Setting(filterGroupContainer)
                .addButton(button => button
                    .setButtonText(this.plugin.getLocalizedString({ en: "+ Add Condition", zh: "+ 添加条件" }))
                    .onClick(async () => {
                        const newConditionId = `fc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
                        const newCondition = {
                            id: newConditionId,
                            property: '', // Default to empty, user will select
                            operator: 'contains', // Default operator, will be dynamic later
                            value: ''
                            // pillLogicType will be determined by the FilterGroup's logic
                        };
                        if (!currentFilterGroup.conditions) { // Ensure conditions array exists
                            currentFilterGroup.conditions = [];
                        }
                        currentFilterGroup.conditions.push(newCondition);
                        await this.plugin.saveSettings();
                        
                        // We need to re-render at least this module's config, or the whole settings tab
                        // For simplicity with current structure, re-render the whole tab.
                        // Record scroll position to mitigate jump
                        let scrollY = 0;
                        const settingsContent = containerEl.closest('.vertical-tab-content');
                        if (settingsContent) scrollY = settingsContent.scrollTop;
                        
                        this.display(); // Re-render settings tab
                        
                        if (settingsContent) {
                            requestAnimationFrame(() => { settingsContent.scrollTop = scrollY; });
                        }
                    }));
            // 4. Placeholder for Pill Color Settings
            configContentEl.createEl('h5', { text: this.plugin.getLocalizedString({en:"Pill Colors", zh:"筛选条件胶囊颜色"}) });
            const pillColorsEditorEl = configContentEl.createDiv();
            pillColorsEditorEl.setText(this.plugin.getLocalizedString({en:"[Pill Color Editor will be here]", zh:"[胶囊颜色编辑器将在此处]"}));
            // TODO: Implement renderPillColorEditor(pillColorsEditorEl, moduleItem.displaySettings.pillColors, moduleItem.id)


            // Add a separator
            if (index < this.plugin.settings.dynamicNoteListModules.length - 1) {
                modulesContainer.createEl('hr', {cls: 'dynamic-module-separator'});
            }
        });

        // --- SUB-HEADING: Show Folder Grid ---
        // #SETTINGS_SUBHEADING_Show Folder Grid
        containerEl.createEl('h4', {
            text: this.plugin.getLocalizedString({
                en: 'Folder Grid',
                zh: '文件夹网格'
            })
        });

        // --- SUB-HEADING: Accordion Mode ---
        // #SETTINGS_SUBHEADING_Accordion Mode
        containerEl.createEl('h5', {
            text: this.plugin.getLocalizedString({
                en: 'Accordion Mode (for Collapsible)',
                zh: '手风琴模式'
            })
        });
        // --- SETTING: Accordion Mode for Details (同级手风琴) ---
        // #SETTING_ITEM_ACCORDION_MODE
        let accordionModeToggleComponent; // <--- 在这里声明一个变量来持有开关组件的引用
        new Setting(containerEl)
            .setName(this.plugin.getLocalizedString({
                en: 'Enable Accordion Mode for Collapsible Sections',
                zh: '为可折叠区域启用手风琴模式'
            }))
            .setDesc(this.plugin.getLocalizedString({
                en: 'If enabled, opening one collapsible section (e.g., subfolder) will close others at the same level within its card. Ineffective if Global Accordion Mode is enabled.',
                zh: '如果启用，在卡片内打开一个可折叠区域（例如子文件夹）将会关闭同一层级的其他已打开区域。如果“全局手风琴模式”已启用，则此设置无效。' // <--- 更新描述
            }))
            .addToggle(toggle => {
                accordionModeToggleComponent = toggle; // <--- 将开关组件赋值给变量
                toggle
                    .setValue(this.plugin.settings.accordionModeForDetails)
                    .setDisabled(this.plugin.settings.globalAccordionMode) // <--- 根据全局模式的当前状态设置初始禁用状态
                    .onChange(async (value) => {
                        this.plugin.settings.accordionModeForDetails = value;
                        await this.plugin.saveSettings();
                    })
            });

        // --- SETTING: Global Accordion Mode ---
        // #SETTING_ITEM_GLOBAL_ACCORDION_MODE
        new Setting(containerEl)
            .setName(this.plugin.getLocalizedString({
                en: 'Enable Global Accordion Mode',
                zh: '启用全局手风琴模式'
            }))
            .setDesc(this.plugin.getLocalizedString({
                en: 'If enabled, opening any collapsible section on the homepage will close ALL other currently open collapsible sections, regardless of their level or parent. Overrides "Enable Accordion Mode for Collapsible Sections" if active.',
                zh: '如果启用，在主页上打开任何可折叠区域将会关闭所有其他当前已打开的可折叠区域，无论它们的层级或父元素如何。如果启用，此设置将覆盖“为可折叠区域启用手风琴模式”。'
            }))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.globalAccordionMode)
                .onChange(async (value) => {
                    this.plugin.settings.globalAccordionMode = value;
                    await this.plugin.saveSettings();

                    // 当全局模式开关改变时，更新同级模式开关的禁用状态
                    if (accordionModeToggleComponent) {
                        accordionModeToggleComponent.setDisabled(value);
                        // 如果全局模式开启，可以选择性地将同级模式的实际设置值也改为false
                        // if (value && this.plugin.settings.accordionModeForDetails) {
                        //     this.plugin.settings.accordionModeForDetails = false;
                        //     accordionModeToggleComponent.setValue(false); // 更新UI上的值
                        //     await this.plugin.saveSettings(); // 保存这个更改
                        // }
                    }
                }));
        // --- SUB-HEADING: Show Folder Grid ---
        // #SETTINGS_SUBHEADING_Show Folder Grid
        containerEl.createEl('h5', {
            text: this.plugin.getLocalizedString({
                en: 'Folder Grid',
                zh: '文件夹网格'
            })
        });

        // --- SETTING: Show Folder Grid ---
        // #SETTING_ITEM_SHOW_FOLDER_GRID
        new Setting(containerEl)
            .setName(this.plugin.getLocalizedString({
                en: 'Show Folder Grid Section',
                zh: '显示文件夹网格模块'
            }))
            .setDesc(this.plugin.getLocalizedString({
                en: 'Toggle the folder cards section.',
                zh: '切换文件夹卡片模块的显示状态。'
            }))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showFolderGrid)
                .onChange(async (value) => {
                    this.plugin.settings.showFolderGrid = value;
                    await this.plugin.saveSettings();
                }));
        
        // --- SETTING: Excluded Top Folders ---
        // #SETTING_ITEM_EXCLUDED_FOLDERS
         new Setting(containerEl)
            .setName(this.plugin.getLocalizedString({
                en: 'Excluded Top-Level Folders (Comma-separated)',
                zh: '排除的顶层文件夹 (逗号分隔)'
            }))
            .setDesc(this.plugin.getLocalizedString({
                en: 'These folders will not appear in the folder grid and their notes might be excluded from some queries (e.g., .obsidian, .trash, Attachments). Case-sensitive.',
                zh: '这些文件夹不会出现在文件夹网格中，并且其中的笔记可能会从某些查询中排除 (例如：.obsidian, .trash, Attachments)。区分大小写。'
            }))
            .addText(text => text
                .setPlaceholder(DEFAULT_SETTINGS.excludedTopFolders)
                .setValue(this.plugin.settings.excludedTopFolders)
                .onChange(async (value) => {
                    this.plugin.settings.excludedTopFolders = value;
                    await this.plugin.saveSettings();
                }));

        // --- SETTING: Recent Notes in Category Limit ---
        // #SETTING_ITEM_RECENT_NOTES_LIMIT
        new Setting(containerEl)
            .setName(this.plugin.getLocalizedString({
                en: 'Recent Notes in Category Limit (Folder Grid)',
                zh: '分类中最近笔记数量上限 (文件夹网格)'
            }))
            .setDesc(this.plugin.getLocalizedString({
                en: 'Max number of recent notes to show per top-level folder in the folder grid.',
                zh: '在文件夹网格的每个顶层文件夹中显示最近笔记的最大数量。'
            }))
            .addSlider(slider => slider
                .setLimits(0, 20, 1)
                .setValue(this.plugin.settings.recentNotesInCategoryLimit)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.recentNotesInCategoryLimit = value;
                    await this.plugin.saveSettings();
                }));

        // --- SETTING: Initial Notes in Subfolder Display ---
        // #SETTING_ITEM_INITIAL_SUBFOLDER_DISPLAY
        new Setting(containerEl)
            .setName(this.plugin.getLocalizedString({
                en: 'Initial Notes Display Count (Folder Grid Subfolders/Direct)',
                zh: '初始笔记显示数量 (文件夹网格 - 子文件夹/直接笔记)'
            }))
            .setDesc(this.plugin.getLocalizedString({
                en: 'Number of notes to initially show in subfolder lists or direct notes lists before needing to "show more".',
                zh: '在子文件夹列表或直接笔记列表中初始显示的笔记数量，超过此数量则需要点击“查看更多”。'
            }))
            .addSlider(slider => slider
                .setLimits(1, 20, 1)
                .setValue(this.plugin.settings.initialNotesInSubfolderDisplay)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.initialNotesInSubfolderDisplay = value;
                    await this.plugin.saveSettings();
                }));

        // --- SETTING: Max Height for Scrolled List ---
        // #SETTING_ITEM_MAX_HEIGHT_SCROLL
        new Setting(containerEl)
            .setName(this.plugin.getLocalizedString({
                en: 'Max Height for Scrolled Note Lists',
                zh: '滚动笔记列表的最大高度'
            }))
            .setDesc(this.plugin.getLocalizedString({
                en: 'CSS max-height for note lists when "show more" is clicked (e.g., "250px", "30vh").',
                zh: '点击“查看更多”后，笔记列表的 CSS 最大高度 (例如："250px", "30vh")。'
            }))
            .addText(text => text
                .setPlaceholder(DEFAULT_SETTINGS.maxHeightForScrolledList)
                .setValue(this.plugin.settings.maxHeightForScrolledList)
                .onChange(async (value) => {
                    this.plugin.settings.maxHeightForScrolledList = value || DEFAULT_SETTINGS.maxHeightForScrolledList;
                    await this.plugin.saveSettings();
                }));

        // --- SUB-HEADING: Sidebar Modules ---
        // #SETTINGS_SUBHEADING_SIDEBAR
        containerEl.createEl('h3', {
            text: this.plugin.getLocalizedString({
                en: 'Sidebar Modules',
                zh: '侧边栏模块'
            })
        });

        // --- SUB-HEADING: Show Vault Stats ---
        // #SETTINGS_SUBHEADING_Show Vault Stats
        containerEl.createEl('h4', {
            text: this.plugin.getLocalizedString({
                en: 'Vault Stats',
                zh: '文档统计'
            })
        });

        // --- SETTING: Show Vault Stats ---
        // #SETTING_ITEM_SHOW_VAULT_STATS
        new Setting(containerEl)
            .setName(this.plugin.getLocalizedString({
                en: 'Show Vault Stats Section',
                zh: '显示文档统计模块'
            }))
            .setDesc(this.plugin.getLocalizedString({
                en: 'Toggle Vault Stats Section.',
                zh: '切换文档统计模块的显示状态。'
            }))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showVaultStats)
                .onChange(async (value) => {
                    this.plugin.settings.showVaultStats = value;
                    await this.plugin.saveSettings();
                }));
        
        // --- SETTING: Vault Stats Title ---
        // #SETTING_ITEM_VAULT_STATS_TITLE
        new Setting(containerEl)
            .setName(this.plugin.getLocalizedString({
                en: 'Vault Stats Title',
                zh: '文档统计模块标题'
            }))
            .setDesc(this.plugin.getLocalizedString({
                en: 'Title for the Vault Statistics section in the sidebar.',
                zh: '侧边栏中“文档统计”模块的标题。'
            }))
            .addText(text => text
                .setValue(this.plugin.settings.vaultStatsTitle)
                .onChange(async (value) => {
                    this.plugin.settings.vaultStatsTitle = value || DEFAULT_SETTINGS.vaultStatsTitle;
                    await this.plugin.saveSettings();
                }));

        // --- SETTING: Excluded from Wordcount ---
        // #SETTING_ITEM_EXCLUDED_FROM_WORDCOUNT
        new Setting(containerEl)
            .setName(this.plugin.getLocalizedString({
                en: 'Excluded from Word Count (Paths, Comma-separated)',
                zh: '从总字数统计中排除的路径 (逗号分隔)'
            }))
            .setDesc(this.plugin.getLocalizedString({
                en: 'Notes under these paths (e.g., Journal/, Templates/) will not be included in the total word count. Case-sensitive.',
                zh: '这些路径下的笔记 (例如：Journal/, Templates/) 将不计入总字数。区分大小写。'
            }))
            .addText(text => text
                .setValue(this.plugin.settings.excludedFromWordcount)
                .onChange(async (value) => {
                    this.plugin.settings.excludedFromWordcount = value;
                    await this.plugin.saveSettings();
                }));

        // --- SUB-HEADING: To-Do List ---
        // #SETTINGS_SUBHEADING_To-Do List
        containerEl.createEl('h4', {
            text: this.plugin.getLocalizedString({
                en: 'To-Do List',
                zh: '待办事项'
            })
        });

        // --- SETTING: Show Sidebar To-Do List ---
        // #SETTING_ITEM_SHOW_TODO_SIDEBAR_SECTION 
        new Setting(containerEl)
            .setName(this.plugin.getLocalizedString({
                en: "Show To-Do List in Sidebar", 
                zh: "显示待办列表"
            }))
            .setDesc(this.plugin.getLocalizedString({
                en: "Display a list of pending tasks directly in the sidebar.",
                zh: "显示一个待处理任务的列表。"
            }))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showTodoSidebarSection)
                .onChange(async (value) => {
                    this.plugin.settings.showTodoSidebarSection = value;
                    await this.plugin.saveSettings();
                }));

        // --- SETTING: Sidebar To-Do List Title ---
        // #SETTING_ITEM_TODO_SIDEBAR_SECTION_TITLE
        new Setting(containerEl)
            .setName(this.plugin.getLocalizedString({
                en: "Sidebar To-Do List Title", 
                zh: "待办列表标题"
            }))
            .addText(text => text
                .setPlaceholder(DEFAULT_SETTINGS.todoSidebarSectionTitle)
                .setValue(this.plugin.settings.todoSidebarSectionTitle)
                .onChange(async (value) => {
                    this.plugin.settings.todoSidebarSectionTitle = value.trim() || DEFAULT_SETTINGS.todoSidebarSectionTitle;
                    await this.plugin.saveSettings();
                }));

        // --- SETTING: Sidebar To-Do Sources ---
        // #SETTING_ITEM_TODO_SIDEBAR_SECTION_SOURCES
        new Setting(containerEl)
            .setName(this.plugin.getLocalizedString({
                en: "Sidebar To-Do Sources", 
                zh: "待办来源"
            }))
            .setDesc(this.plugin.getLocalizedString({
                en: 'Leave empty for all tasks. Otherwise, use a folder path (e.g., "Projects/") or a tag (e.g., "#todo").', 
                zh: '留空则包含所有任务。否则，可使用文件夹路径 (例如："项目/") 或标签 (例如："#待办")。'
            }))
            .addText(text => text
                .setPlaceholder(this.plugin.getLocalizedString({en: 'e.g., "Inbox/" or "#urgent"', zh: '例如："收件箱/" 或 "#紧急"'}))
                .setValue(this.plugin.settings.todoSidebarSectionSources)
                .onChange(async (value) => {
                    this.plugin.settings.todoSidebarSectionSources = value.trim(); // Allow empty string
                    await this.plugin.saveSettings();
                }));

        // --- SETTING: Sidebar To-Do Limit ---
        // #SETTING_ITEM_TODO_SIDEBAR_SECTION_LIMIT
        new Setting(containerEl)
            .setName(this.plugin.getLocalizedString({
                en: "Sidebar To-Do Limit", 
                zh: "待办数量上限"
            }))
            .addSlider(slider => slider
                .setLimits(1, 30, 1) // Min, Max, Step
                .setValue(this.plugin.settings.todoSidebarSectionLimit)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.todoSidebarSectionLimit = value;
                    await this.plugin.saveSettings();
                }));

        // --- SUB-HEADING: To-Do Notes ---
        // #SETTINGS_SUBHEADING_To-Do Notes
        containerEl.createEl('h4', {
            text: this.plugin.getLocalizedString({
                en: 'To-Do Notes',
                zh: '待整理笔记'
            })
        });

        // --- SETTING: Show To-Do Notes ---
        // #SETTING_ITEM_SHOW_TODO_NOTES
        new Setting(containerEl)
            .setName(this.plugin.getLocalizedString({
                en: 'Show "To-Do Notes" Section',
                zh: '显示“待整理笔记”模块'
            }))
            .setDesc(this.plugin.getLocalizedString({
                en: 'Toggle the "To-Do Notes" Section',
                zh: '切换“待整理笔记”模块的显示状态。'
            }))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showTodoNotes)
                .onChange(async (value) => {
                    this.plugin.settings.showTodoNotes = value;
                    await this.plugin.saveSettings();
                }));
        
        // --- SETTING: TODO_TAG_DISPLAY ---
        // #SETTING_ITEM_TODO_TAG_DISPLAY
        new Setting(containerEl)
            .setName(this.plugin.getLocalizedString({en: 'To-Do Notes Title', zh: '待整理笔记模块标题'}))
            .addText(text => text.setValue(this.plugin.settings.todoTagDisplay).onChange(async val => { this.plugin.settings.todoTagDisplay = val || DEFAULT_SETTINGS.todoTagDisplay; await this.plugin.saveSettings(); }));
        
        // --- SETTING: TODO_TAG_QUERY ---
        // #SETTING_ITEM_TODO_TAG_QUERY
        new Setting(containerEl)
            .setName(this.plugin.getLocalizedString({en: 'To-Do Notes Query', zh: '待整理笔记查询条件'}))
            .setDesc(this.plugin.getLocalizedString({en: 'Dataview-like query for notes needing to-do (e.g., #todo or "folder/path").', zh: '用于筛选待整理笔记的类 Dataview 查询语句 (例如：#待整理 或 "文件夹/路径")。'}))
            .addText(text => text.setValue(this.plugin.settings.todoTagQuery).onChange(async val => { this.plugin.settings.todoTagQuery = val || DEFAULT_SETTINGS.todoTagQuery; await this.plugin.saveSettings(); }));

        // --- SETTING: TODO_FILES_LIMIT ---
        // #SETTING_ITEM_TODO_FILES_LIMIT
        new Setting(containerEl)
            .setName(this.plugin.getLocalizedString({en: 'To-Do Notes Limit', zh: '待整理笔记数量上限'}))
            .addSlider(slider => slider.setLimits(1, 20, 1).setValue(this.plugin.settings.todoFilesLimit).setDynamicTooltip().onChange(async val => {this.plugin.settings.todoFilesLimit = val; await this.plugin.saveSettings();}));

        // --- SUB-HEADING: Recent Edits ---
        // #SETTINGS_SUBHEADING_Recent Edits
        containerEl.createEl('h4', {
            text: this.plugin.getLocalizedString({
                en: 'Recent Edits',
                zh: '最近编辑'
            })
        });

        // --- SETTING: Show Recent Edits ---
        // #SETTING_ITEM_SHOW_RECENT_EDITS
        new Setting(containerEl)
            .setName(this.plugin.getLocalizedString({
                en: 'Show "Recent Edits" Section',
                zh: '显示“最近编辑”模块'
            }))
            .setDesc(this.plugin.getLocalizedString({
                en: 'Toggle the "Recent Edits" Section',
                zh: '切换“最近编辑”模块的显示状态。'
            }))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showRecentEdits)
                .onChange(async (value) => {
                    this.plugin.settings.showRecentEdits = value;
                    await this.plugin.saveSettings();
                }));
        
        // --- SETTING: RECENT_FILES_LIMIT_SIDEBAR ---
        // #SETTING_ITEM_RECENT_FILES_LIMIT_SIDEBAR
        new Setting(containerEl)
            .setName(this.plugin.getLocalizedString({en: 'Recent Edits Limit', zh: '最近编辑数量上限'}))
            .addSlider(slider => slider.setLimits(1, 20, 1).setValue(this.plugin.settings.recentFilesLimitSidebar).setDynamicTooltip().onChange(async val => {this.plugin.settings.recentFilesLimitSidebar = val; await this.plugin.saveSettings();}));

        // --- SUB-HEADING: Quick Access ---
        // #SETTINGS_SUBHEADING_Quick Access
        containerEl.createEl('h4', {
            text: this.plugin.getLocalizedString({
                en: 'Quick Access',
                zh: '快速访问'
            })
        });

        // --- SETTING: Show Quick Access ---
        // #SETTING_ITEM_SHOW_QUICK_ACCESS
        new Setting(containerEl)
            .setName(this.plugin.getLocalizedString({
                en: 'Show "Quick Access" Section (Overall)',
                zh: '显示“快速访问”模块 (总开关)'
            }))
            .setDesc(this.plugin.getLocalizedString({
                en: 'Toggle the "Quick Access" section.',
                zh: '切换“快速访问”模块的显示状态。'
            }))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showQuickAccess)
                .onChange(async (value) => {
                    this.plugin.settings.showQuickAccess = value;
                    await this.plugin.saveSettings();
                }));

        // --- SUB-HEADING: Top Tags ---
        // #SETTINGS_SUBHEADING_Top Tags
        containerEl.createEl('h5', {
            text: this.plugin.getLocalizedString({
                en: 'Top Tags',
                zh: '常用标签'
            })
        });

        // --- SETTING: Show Top Tags in Quick Access ---
        // #SETTING_ITEM_SHOW_QA_TOP_TAGS
        new Setting(containerEl)
            .setName(this.plugin.getLocalizedString({
                en: 'Show "Top Tags" in Quick Access',
                zh: '在快速访问中显示“常用标签”'
            }))
            .setDesc(this.plugin.getLocalizedString({
                en: "Requires 'Show Quick Access Section' to be enabled.",
                zh: "需要启用“显示‘快速访问’模块 (总开关)”。"
            }))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showQuickAccessTopTags)
                .onChange(async (value) => {
                    this.plugin.settings.showQuickAccessTopTags = value;
                    await this.plugin.saveSettings();
                }));
        
        // --- SETTING: TOP_TAGS_LIMIT ---
        // #SETTING_ITEM_TOP_TAGS_LIMIT
        new Setting(containerEl)
            .setName(this.plugin.getLocalizedString({en: 'Top Tags Limit', zh: '常用标签数量上限'}))
            .addSlider(slider => slider.setLimits(1, 20, 1).setValue(this.plugin.settings.topTagsLimit).setDynamicTooltip().onChange(async val => {this.plugin.settings.topTagsLimit = val; await this.plugin.saveSettings();}));

        // --- SUB-HEADING: Bookmarks ---
        // #SETTINGS_SUBHEADING_Bookmarks
        containerEl.createEl('h5', {
            text: this.plugin.getLocalizedString({
                en: 'Bookmarks',
                zh: '书签'
            })
        });
        // --- SETTING: Show Bookmarks in Quick Access ---
        // #SETTING_ITEM_SHOW_QA_BOOKMARKS
        new Setting(containerEl)
            .setName(this.plugin.getLocalizedString({
                en: 'Show "Bookmarks" in Quick Access (Obsidian Core Plugin)',
                zh: '在快速访问中显示“书签” (Obsidian 核心插件)'
            }))
            .setDesc(this.plugin.getLocalizedString({
                en: "Requires 'Show Quick Access Section' to be enabled. This will use Obsidian's built-in bookmarks.",
                zh: "需要启用“显示‘快速访问’模块 (总开关)”。此功能将使用 Obsidian 的内置书签。"
            }))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showQuickAccessBookmarks)
                .onChange(async (value) => {
                    this.plugin.settings.showQuickAccessBookmarks = value;
                    await this.plugin.saveSettings();
                }));
        
        // --- SETTING: QUICK_ACCESS_BOOKMARKS_TITLE ---
        // #SETTING_ITEM_QUICK_ACCESS_BOOKMARKS_TITLE
        new Setting(containerEl)
            .setName(this.plugin.getLocalizedString({en: 'Bookmarks Title (Quick Access)', zh: '书签模块标题 (快速访问)'}))
            .addText(text => text.setValue(this.plugin.settings.quickAccessBookmarksTitle).onChange(async val => { this.plugin.settings.quickAccessBookmarksTitle = val || DEFAULT_SETTINGS.quickAccessBookmarksTitle; await this.plugin.saveSettings(); }));

        // --- FINAL NOTE IN SETTINGS ---
        // #SETTINGS_FINAL_NOTE
        containerEl.createEl('p', {
            text: this.plugin.getLocalizedString({
                en: 'Changes to settings will attempt to dynamically update the homepage if it is currently open. Some changes might require a manual refresh (e.g., switch tabs) or reopening the note.',
                zh: '设置的更改会尝试动态更新当前打开的主页。某些更改可能需要手动刷新（例如切换标签页）或重新打开笔记才能完全生效。'
            }),
            cls: 'setting-item-description' // Use existing Obsidian class for consistent styling
        }).style.marginTop = "20px"; // Add some spacing
    }
}

module.exports = CustomDynamicHomepagePlugin;