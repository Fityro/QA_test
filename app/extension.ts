import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

class CourseTreeItem extends vscode.TreeItem {
  private originalLabel: string;
  
  constructor(
    label: string,
    public readonly fullPath?: string,
    public checked: boolean = false,
    public readonly isFolder: boolean = false,
    public readonly isCourse: boolean = false
  ) {
    super(label, isFolder ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
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
      (this as any).label = displayLabel;
      this.tooltip = this.checked ? `${this.originalLabel} (выбрано)` : `${this.originalLabel} (кликните для выбора)`;
    }
  }
  
  getOriginalLabel(): string {
    return this.originalLabel;
  }
}

class ExaminerViewProvider implements vscode.TreeDataProvider<CourseTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<CourseTreeItem | undefined | null> = new vscode.EventEmitter<CourseTreeItem | undefined | null>();
  readonly onDidChangeTreeData: vscode.Event<CourseTreeItem | undefined | null> = this._onDidChangeTreeData.event;
  
  private courses: CourseTreeItem[] = [];
  private allItems: Map<string, CourseTreeItem> = new Map(); // Хранить все элементы дерева
  private databasePath: string;

  constructor() {
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

  getTreeItem(element: CourseTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: CourseTreeItem): Thenable<CourseTreeItem[]> {
    if (!element) {
      // Корневые элементы - курсы
      return Promise.resolve(this.courses);
    }
    
    // Дочерние элементы - содержимое папок
    if (element.fullPath && fs.existsSync(element.fullPath)) {
      try {
        const items = fs.readdirSync(element.fullPath, { withFileTypes: true });
        const children = items.map(item => {
          const itemPath = path.join(element.fullPath!, item.name);
          
          // Проверяем, есть ли дочерние элементы для определения коллапса
          let hasChildren = false;
          if (item.isDirectory()) {
            try {
              const subItems = fs.readdirSync(itemPath);
              hasChildren = subItems.length > 0;
            } catch {
              hasChildren = false;
            }
          }
          
          const treeItem = new CourseTreeItem(
            item.name,
            itemPath,
            false,
            item.isDirectory() && hasChildren,  // только папки с содержимым могут раскрываться
            false  // подпапки не являются курсами
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
      } catch (error) {
        return Promise.resolve([]);
      }
    }
    
    return Promise.resolve([]);
  }

  toggleCourse(item: CourseTreeItem) {
    console.log('Toggle called for:', item.getOriginalLabel(), 'Current checked:', item.checked);
    
    // Переключаем состояние
    item.checked = !item.checked;
    
    // Обновляем отображение
    item.updateDisplay();
    
    // Уведомляем об изменении
    this._onDidChangeTreeData.fire(item);
    
    console.log('After toggle:', item.getOriginalLabel(), 'New checked:', item.checked);
  }

  getSelectedCourses(): string[] {
    // Возвращаем только выбранные корневые курсы
    return this.courses.filter(c => c.checked).map(c => c.getOriginalLabel());
  }
}

class FolderItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public checked: boolean = false
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'folderItem';
    this.checkboxState = checked ? 'checked' : 'unchecked';
  }
  checkboxState: 'checked' | 'unchecked';
}

class FolderProvider implements vscode.TreeDataProvider<FolderItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<FolderItem | null | undefined> = new vscode.EventEmitter<FolderItem | null | undefined>();
  readonly onDidChangeTreeData: vscode.Event<FolderItem | null | undefined> = this._onDidChangeTreeData.event;
  private folders: FolderItem[];
  constructor(folderNames: string[]) {
    this.folders = folderNames.map(name => new FolderItem(name));
  }
  getTreeItem(element: FolderItem): vscode.TreeItem {
    element.checkboxState = element.checked ? 'checked' : 'unchecked';
    return element;
  }
  getChildren(): Thenable<FolderItem[]> {
    return Promise.resolve(this.folders);
  }
  toggleCheck(label: string) {
    const item = this.folders.find(f => f.label === label);
    if (item) {
      item.checked = !item.checked;
      this._onDidChangeTreeData.fire();
    }
  }
  getChecked(): string[] {
    return this.folders.filter(f => f.checked).map(f => f.label);
  }
}

export function activate(context: vscode.ExtensionContext) {
  // Регистрируем провайдер для Activity Bar
  const examinerProvider = new ExaminerViewProvider();
  vscode.window.registerTreeDataProvider('trainingExaminerView', examinerProvider);

  // Команда для переключения выбора курса
  context.subscriptions.push(vscode.commands.registerCommand('trainingCatalogExaminer.toggleCourse', (item: CourseTreeItem) => {
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
            } catch {
              try {
                await vscode.commands.executeCommand('workbench.action.chat.submit');
              } catch {
                try {
                  await vscode.commands.executeCommand('github.copilot.chat.submit');
                } catch {
                  try {
                    await vscode.commands.executeCommand('type', { text: '\n' });
                  } catch {
                    // Если автоматическая отправка не сработала - пользователь нажмет Enter
                    console.log('Автоматическая отправка не удалась');
                  }
                }
              }
            }
          }, 800);
          
        } catch {
          vscode.window.showInformationMessage('📋 Чат открыт! Нажмите Ctrl+V и Enter');
        }
      }, 1000);
      
    } catch {
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

export function deactivate() {}
