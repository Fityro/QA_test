"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class CourseTreeItem extends vscode.TreeItem {
    constructor(label, fullPath, checked = false, isFolder = false, isCourse = false) {
        super(label, isFolder ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
        this.fullPath = fullPath;
        this.checked = checked;
        this.isFolder = isFolder;
        this.isCourse = isCourse;
        this.originalLabel = label;
        this.contextValue = isCourse ? 'courseItem' : (isFolder ? 'courseFolder' : 'folderItem');
        // Устанавливаем отображение
        this.updateDisplay();
        // Добавляем команду для чекбоксов
        if (isCourse || isFolder) {
            this.command = {
                command: 'trainingCatalogExaminer.toggleCourse',
                title: 'Переключить выбор',
                arguments: [this]
            };
        }
        this.iconPath = isFolder ? vscode.ThemeIcon.Folder : vscode.ThemeIcon.File;
    }
    updateDisplay() {
        if (this.isCourse || this.isFolder) {
            const displayLabel = this.checked ? `☑️ ${this.originalLabel}` : `☐ ${this.originalLabel}`;
            this.label = displayLabel;
            this.tooltip = this.checked ? `${this.originalLabel} (выбрано)` : `${this.originalLabel} (кликните для выбора)`;
        }
    }
    getOriginalLabel() {
        return this.originalLabel;
    }
}
class ExaminerViewProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.courses = [];
        this.allItems = new Map(); // Хранить все элементы дерева
        this.databasePath = path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', 'Database', 'Courses');
        const courseNames = [
            'Automation QA engineer',
            'Data analyst',
            'DevOps engineer',
            'Digital marketer',
            'Front-end developer',
            'Full-stack developer',
            'Java developer',
            'Personal career support',
            'PPC manager',
            'Project manager',
            'Python developer',
            'QA engineer',
            'Recruiter',
            'SMM manager',
            'UIUX designer'
        ];
        this.courses = courseNames.map(name => {
            const course = new CourseTreeItem(name, path.join(this.databasePath, name), false, true, true);
            this.allItems.set(course.fullPath || name, course);
            return course;
        });
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (!element) {
            // Корневые элементы - курсы
            return Promise.resolve(this.courses);
        }
        // Дочерние элементы - содержимое папок
        if (element.fullPath && fs.existsSync(element.fullPath)) {
            try {
                const items = fs.readdirSync(element.fullPath, { withFileTypes: true });
                const children = items.map(item => {
                    const itemPath = path.join(element.fullPath, item.name);
                    // Проверяем, есть ли дочерние элементы для определения коллапса
                    let hasChildren = false;
                    if (item.isDirectory()) {
                        try {
                            const subItems = fs.readdirSync(itemPath);
                            hasChildren = subItems.length > 0;
                        }
                        catch {
                            hasChildren = false;
                        }
                    }
                    const treeItem = new CourseTreeItem(item.name, itemPath, false, item.isDirectory() && hasChildren, // только папки с содержимым могут раскрываться
                    false // подпапки не являются курсами
                    );
                    // Сохраняем в карте для отслеживания состояния
                    this.allItems.set(itemPath, treeItem);
                    // Если это папка без детей, делаем её нераскрывающейся
                    if (item.isDirectory() && !hasChildren) {
                        treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
                    }
                    return treeItem;
                });
                return Promise.resolve(children);
            }
            catch (error) {
                return Promise.resolve([]);
            }
        }
        return Promise.resolve([]);
    }
    toggleCourse(item) {
        console.log('Toggle called for:', item.getOriginalLabel(), 'Current checked:', item.checked);
        // Переключаем состояние
        item.checked = !item.checked;
        // Обновляем отображение
        item.updateDisplay();
        // Уведомляем об изменении
        this._onDidChangeTreeData.fire(item);
        console.log('After toggle:', item.getOriginalLabel(), 'New checked:', item.checked);
    }
    getSelectedCourses() {
        // Возвращаем только выбранные корневые курсы
        return this.courses.filter(c => c.checked).map(c => c.getOriginalLabel());
    }
}
class FolderItem extends vscode.TreeItem {
    constructor(label, checked = false) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.label = label;
        this.checked = checked;
        this.contextValue = 'folderItem';
        this.checkboxState = checked ? 'checked' : 'unchecked';
    }
}
class FolderProvider {
    constructor(folderNames) {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.folders = folderNames.map(name => new FolderItem(name));
    }
    getTreeItem(element) {
        element.checkboxState = element.checked ? 'checked' : 'unchecked';
        return element;
    }
    getChildren() {
        return Promise.resolve(this.folders);
    }
    toggleCheck(label) {
        const item = this.folders.find(f => f.label === label);
        if (item) {
            item.checked = !item.checked;
            this._onDidChangeTreeData.fire();
        }
    }
    getChecked() {
        return this.folders.filter(f => f.checked).map(f => f.label);
    }
}
function activate(context) {
    // Регистрируем провайдер для Activity Bar
    const examinerProvider = new ExaminerViewProvider();
    vscode.window.registerTreeDataProvider('trainingExaminerView', examinerProvider);
    // Команда для переключения выбора курса
    context.subscriptions.push(vscode.commands.registerCommand('trainingCatalogExaminer.toggleCourse', (item) => {
        examinerProvider.toggleCourse(item);
    }));
    // Команда для запуска экзамена с выбранными курсами - ПРЯМАЯ АВТОМАТИЗАЦИЯ
    context.subscriptions.push(vscode.commands.registerCommand('trainingCatalogExaminer.startFromSelection', async () => {
        const selected = examinerProvider.getSelectedCourses();
        if (selected.length === 0) {
            vscode.window.showWarningMessage('Выберите хотя бы одно направление!');
            return;
        }
        // Создаем сообщение для чата
        const examMessage = `🎯 АВТОМАТИЧЕСКОЕ ОБНОВЛЕНИЕ ВЫБОРА КУРСОВ:

Выбор пользователя для экзамена:
${selected.join('\n')}

Время выбора: ${new Date().toLocaleString()}
Готов к началу экзамена!

Пожалуйста, проведи экзамен по выбранным курсам. Готов отвечать на вопросы!`;
        // Копируем в буфер обмена
        await vscode.env.clipboard.writeText(examMessage);
        try {
            // Открываем чат
            await vscode.commands.executeCommand('workbench.action.chat.open');
            // Вставляем текст через 1 секунду
            setTimeout(async () => {
                try {
                    await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
                    // Пробуем отправить автоматически
                    setTimeout(async () => {
                        try {
                            await vscode.commands.executeCommand('chat.action.submit');
                        }
                        catch {
                            try {
                                await vscode.commands.executeCommand('workbench.action.chat.submit');
                            }
                            catch {
                                try {
                                    await vscode.commands.executeCommand('github.copilot.chat.submit');
                                }
                                catch {
                                    try {
                                        await vscode.commands.executeCommand('type', { text: '\n' });
                                    }
                                    catch {
                                        // Если автоматическая отправка не сработала - пользователь нажмет Enter
                                        console.log('Автоматическая отправка не удалась');
                                    }
                                }
                            }
                        }
                    }, 800);
                }
                catch {
                    vscode.window.showInformationMessage('📋 Чат открыт! Нажмите Ctrl+V и Enter');
                }
            }, 1000);
        }
        catch {
            vscode.window.showInformationMessage('📋 Сообщение скопировано! Откройте чат Copilot и нажмите Ctrl+V + Enter');
        }
    }));
    // Простая команда для выбора папок (legacy, оставляем для совместимости с горячей клавишей)
    context.subscriptions.push(vscode.commands.registerCommand('trainingCatalogExaminer.start', async () => {
        // Просто показываем Tree View
        vscode.commands.executeCommand('workbench.view.extension.examinerContainer');
        vscode.window.showInformationMessage('Выберите курсы в панели Training Examiner');
    }));
}
function deactivate() { }
