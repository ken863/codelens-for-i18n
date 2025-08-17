// Module 'vscode' chứa VS Code extensibility API
// Import module và reference với alias vscode trong code
import {
  ExtensionContext,
  languages,
  commands,
  Disposable,
  workspace,
  window,
  Uri,
  QuickPickItem,
  Position,
  Range,
  Selection,
  TextEditorRevealType,
  env,
} from "vscode";
import { CodelensProvider } from "./CodelensProvider";
import * as fs from "fs";
import * as path from "path";

// Interface cho QuickPick item của i18n
interface I18nQuickPickItem extends QuickPickItem {
  locale: string;
  currentValue?: string;
}

// Phương thức này được gọi khi extension được kích hoạt
// Extension sẽ được kích hoạt lần đầu tiên khi command được thực thi

let disposables: Disposable[] = [];

// Các hàm helper để quản lý dữ liệu i18n
/**
 * Tìm tất cả file JSON trong thư mục một cách đệ quy
 * @param dir Đường dẫn thư mục cần tìm
 * @returns Mảng các đường dẫn file JSON
 */
function findJsonFilesRecursive(dir: string): string[] {
  const jsonFiles: string[] = [];

  if (!fs.existsSync(dir)) return jsonFiles;

  try {
    const items = fs.readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(dir, item.name);

      if (item.isDirectory()) {
        // Duyệt đệ quy vào thư mục con
        jsonFiles.push(...findJsonFilesRecursive(fullPath));
      } else if (item.isFile() && item.name.endsWith(".json")) {
        // Thêm file .json vào danh sách
        jsonFiles.push(fullPath);
      }
    }
  } catch (error) {
    console.warn(`Không thể đọc thư mục ${dir}:`, error);
  }

  return jsonFiles;
}

/**
 * Load dữ liệu i18n từ các thư mục đã chỉ định
 * @param i18nFolders Mảng các đường dẫn thư mục i18n
 * @returns Map chứa dữ liệu i18n với key là locale và value là dữ liệu JSON
 */
async function loadI18nData(i18nFolders: string[]): Promise<Map<string, any>> {
  const i18nCache = new Map<string, any>();

  for (const folder of i18nFolders) {
    try {
      const workspaceFolders = workspace.workspaceFolders;
      if (!workspaceFolders) continue;

      const folderPath = path.join(workspaceFolders[0].uri.fsPath, folder);

      if (!fs.existsSync(folderPath)) continue;

      // Tìm tất cả file JSON đệ quy
      const jsonFiles = findJsonFilesRecursive(folderPath);

      for (const filePath of jsonFiles) {
        try {
          const content = fs.readFileSync(filePath, "utf8");
          const jsonData = JSON.parse(content);

          // Tạo locale key từ đường dẫn tương đối
          const relativePath = path.relative(folderPath, filePath);
          let locale = relativePath
            .replace(/\.json$/, "")
            .replace(/[\/\\]/g, ".");

          // Nếu file ở root thì dùng tên file, nếu ở subfolder thì dùng path
          if (!relativePath.includes(path.sep)) {
            locale = path.basename(filePath, ".json");
          }

          i18nCache.set(locale, jsonData);
        } catch (error) {
          console.warn(`Không thể load file i18n ${filePath}:`, error);
        }
      }
    } catch (error) {
      console.warn(`Không thể load thư mục i18n ${folder}:`, error);
    }
  }

  return i18nCache;
}

/**
 * Lấy giá trị i18n từ key (hỗ trợ nested key với dấu chấm)
 * @param data Dữ liệu JSON
 * @param key Key cần lấy giá trị (có thể nested như "common.button.save")
 * @returns Giá trị string hoặc null nếu không tìm thấy
 */
function getI18nValue(data: any, key: string): string | null {
  const keys = key.split(".");
  let value = data;

  for (const k of keys) {
    if (value && typeof value === "object" && k in value) {
      value = value[k];
    } else {
      return null;
    }
  }

  return typeof value === "string" ? value : null;
}

/**
 * Thiết lập giá trị i18n cho key (hỗ trợ nested key với dấu chấm)
 * @param data Dữ liệu JSON
 * @param key Key cần thiết lập (có thể nested như "common.button.save")
 * @param value Giá trị cần thiết lập
 */
function setI18nValue(data: any, key: string, value: string): void {
  const keys = key.split(".");
  let current = data;

  // Điều hướng đến object cha
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (
      !(k in current) ||
      typeof current[k] !== "object" ||
      current[k] === null
    ) {
      current[k] = {};
    }
    current = current[k];
  }

  // Thiết lập giá trị cuối cùng
  const finalKey = keys[keys.length - 1];
  current[finalKey] = value;
}

/**
 * Tìm và focus đến vị trí của key trong file JSON
 * @param filePath Đường dẫn file JSON
 * @param key Key cần tìm trong JSON
 */
async function findAndFocusKey(filePath: string, key: string): Promise<void> {
  try {
    const fileUri = Uri.file(filePath);
    const doc = await workspace.openTextDocument(fileUri);
    const text = doc.getText();

    // Parse JSON để hiểu cấu trúc
    let jsonData: any;
    try {
      jsonData = JSON.parse(text);
    } catch (error) {
      // Nếu không parse được JSON, focus đến đầu file
      const editor = await window.showTextDocument(doc, { preview: false });
      const position = new Position(0, 0);
      editor.selection = new Selection(position, position);
      return;
    }

    // Tìm vị trí của key trong JSON
    const lines = text.split("\n");
    let targetLine = -1;
    let targetColumn = -1;

    // Tách key thành các phần để tìm nested key
    const keyParts = key.split(".");

    // Thuật toán tìm kiếm dựa trên cấu trúc JSON
    // Bắt đầu từ root và đi sâu vào từng level
    let currentDepth = 0;
    let currentObject = jsonData;
    let searchStartLine = 0;

    // Duyệt qua từng phần của key
    for (let partIndex = 0; partIndex < keyParts.length; partIndex++) {
      const keyPart = keyParts[partIndex];
      const isLastPart = partIndex === keyParts.length - 1;

      // Tìm key part này trong phạm vi hiện tại
      let found = false;
      for (let i = searchStartLine; i < lines.length; i++) {
        const line = lines[i];

        // Tính độ sâu thụt lề hiện tại
        const indentLevel = line.length - line.trimStart().length;

        // Kiểm tra xem có phải là key đang tìm không
        const keyRegex = new RegExp(`^\\s*"${escapeRegExp(keyPart)}"\\s*:`);
        if (keyRegex.test(line)) {
          // Kiểm tra độ sâu thụt lề có phù hợp không
          if (partIndex === 0 || indentLevel > currentDepth) {
            targetLine = i;
            targetColumn = line.indexOf(`"${keyPart}"`);
            currentDepth = indentLevel;
            searchStartLine = i + 1;
            found = true;

            // Nếu đây là phần cuối cùng của key thì dừng
            if (isLastPart) {
              break;
            }

            // Cập nhật currentObject để kiểm tra nested
            if (currentObject && typeof currentObject === "object") {
              currentObject = currentObject[keyPart];
            }
            break;
          }
        }
      }

      // Nếu không tìm thấy key part này, dừng tìm kiếm
      if (!found) {
        break;
      }
    }

    // Nếu vẫn không tìm thấy, thử tìm kiếm đơn giản với key cuối cùng
    if (targetLine === -1) {
      const finalKey = keyParts[keyParts.length - 1];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const regex = new RegExp(`"${escapeRegExp(finalKey)}"\\s*:`);
        if (regex.test(line)) {
          targetLine = i;
          targetColumn = line.indexOf(`"${finalKey}"`);
          break;
        }
      }
    }

    // Mở file và focus đến vị trí
    const editor = await window.showTextDocument(doc, { preview: false });

    if (targetLine !== -1) {
      const position = new Position(targetLine, Math.max(0, targetColumn));
      const range = new Range(position, position);

      // Di chuyển cursor và highlight dòng
      editor.selection = new Selection(position, position);
      editor.revealRange(range, TextEditorRevealType.InCenter);
    } else {
      // Nếu không tìm thấy, focus đến đầu file
      const position = new Position(0, 0);
      editor.selection = new Selection(position, position);
    }
  } catch (error) {
    console.error("Lỗi khi focus đến vị trí key:", error);
  }
}

/**
 * Escape các ký tự đặc biệt trong regex
 * @param string Chuỗi cần escape
 * @returns Chuỗi đã được escape
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Lưu giá trị i18n vào file JSON
 * @param i18nFolders Danh sách thư mục i18n
 * @param locale Locale cần lưu
 * @param key Key cần lưu
 * @param value Giá trị cần lưu
 * @param targetFilePath Đường dẫn file đích (optional)
 * @returns Đường dẫn file đã lưu
 */
async function saveI18nValue(
  i18nFolders: string[],
  locale: string,
  key: string,
  value: string,
  targetFilePath?: string,
): Promise<string> {
  try {
    const workspaceFolders = workspace.workspaceFolders;
    if (!workspaceFolders) {
      throw new Error("Không có workspace folder nào được mở");
    }

    let finalTargetPath = "";

    // Nếu có targetFilePath thì sử dụng luôn
    if (targetFilePath && fs.existsSync(targetFilePath)) {
      finalTargetPath = targetFilePath;
    } else {
      // Tìm thư mục chứa file locale hiện có hoặc sử dụng thư mục đầu tiên
      let targetFolder = i18nFolders[0] || "i18n";

      // Kiểm tra từng thư mục để tìm file locale hiện có
      for (const folder of i18nFolders) {
        const folderPath = path.join(workspaceFolders[0].uri.fsPath, folder);
        const testFilePath = path.join(folderPath, `${locale}.json`);

        if (fs.existsSync(testFilePath)) {
          targetFolder = folder;
          finalTargetPath = testFilePath;
          break;
        }
      }

      // Nếu không tìm thấy file hiện có, sử dụng thư mục đầu tiên
      if (!finalTargetPath) {
        const folderPath = path.join(
          workspaceFolders[0].uri.fsPath,
          targetFolder,
        );
        finalTargetPath = path.join(folderPath, `${locale}.json`);
      }
    }

    // Đảm bảo thư mục tồn tại
    const folderPath = path.dirname(finalTargetPath);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    // Load dữ liệu hiện có hoặc tạo object mới
    let data = {};
    if (fs.existsSync(finalTargetPath)) {
      try {
        const content = fs.readFileSync(finalTargetPath, "utf8");
        data = JSON.parse(content);
      } catch (error) {
        console.warn(`Không thể parse file hiện có ${finalTargetPath}:`, error);
        data = {}; // Reset về object rỗng nếu parse thất bại
      }
    }

    // Thiết lập giá trị mới
    setI18nValue(data, key, value);

    // Lưu về file
    const jsonContent = JSON.stringify(data, null, 2);
    fs.writeFileSync(finalTargetPath, jsonContent, "utf8");

    return finalTargetPath; // Trả về đường dẫn file đã sử dụng
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    window.showErrorMessage(`Lỗi khi lưu file i18n: ${errorMessage}`);
    throw error;
  }
}

// Interface cho QuickPick item của i18n
interface I18nQuickPickItem extends QuickPickItem {
  locale: string;
  currentValue?: string;
}

/**
 * Tìm tất cả các i18n resource không được sử dụng trong workspace
 */
async function findUnusedI18nResources(): Promise<void> {
  try {
    window.showInformationMessage(
      "Đang tìm kiếm các i18n resource không được sử dụng...",
    );

    // Lấy cấu hình
    const config = workspace.getConfiguration("codelens-i18n");
    const i18nFolders: string[] = config.get<string[]>("i18nFolder", ["i18n"]);
    const workspaceFolders = workspace.workspaceFolders;

    if (!workspaceFolders) {
      window.showErrorMessage("Không có workspace folder nào được mở");
      return;
    }

    // Load tất cả i18n keys từ các file JSON
    const allI18nKeys = new Set<string>();
    const i18nData = await loadI18nData(i18nFolders);

    for (const [, data] of i18nData) {
      const keys = extractAllKeysFromObject(data, "");
      keys.forEach((key) => allI18nKeys.add(key));
    }

    if (allI18nKeys.size === 0) {
      window.showInformationMessage("Không tìm thấy i18n resource nào");
      return;
    }

    // Tìm tất cả file code trong workspace (trừ node_modules, .git, etc.)
    const codeFiles = await workspace.findFiles(
      "**/*.{ts,js,tsx,jsx,vue,html,php,py,java,cs,cpp,c}",
      "**/node_modules/**",
    );

    // Tạo regex để tìm các key được sử dụng (XXXX.YYYY...)
    const usedKeys = new Set<string>();
    const keyRegex =
      /(['"`])([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)+)\1/gs;

    // Scan từng file để tìm key được sử dụng
    for (const fileUri of codeFiles) {
      try {
        const document = await workspace.openTextDocument(fileUri);
        const text = document.getText();
        let matches;

        while ((matches = keyRegex.exec(text)) !== null) {
          const key = matches[2];
          if (allI18nKeys.has(key)) {
            usedKeys.add(key);
          }
        }
      } catch (error) {
        console.warn(`Không thể đọc file ${fileUri.fsPath}:`, error);
      }
    }

    // Tìm các key không được sử dụng
    const unusedKeys = Array.from(allI18nKeys).filter(
      (key) => !usedKeys.has(key),
    );

    // Hiển thị kết quả
    if (unusedKeys.length === 0) {
      window.showInformationMessage(
        "Tuyệt vời! Tất cả i18n resource đều được sử dụng.",
      );
    } else {
      await showUnusedResourcesReport(unusedKeys, i18nData);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    window.showErrorMessage(
      `Lỗi khi tìm kiếm resource không sử dụng: ${errorMessage}`,
    );
  }
}

/**
 * Trích xuất tất cả các key từ object JSON (hỗ trợ nested)
 */
function extractAllKeysFromObject(obj: any, prefix: string = ""): string[] {
  const keys: string[] = [];

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (
        typeof obj[key] === "object" &&
        obj[key] !== null &&
        !Array.isArray(obj[key])
      ) {
        // Nếu là object thì đệ quy
        keys.push(...extractAllKeysFromObject(obj[key], fullKey));
      } else {
        // Nếu là string value thì thêm key
        keys.push(fullKey);
      }
    }
  }

  return keys;
}

/**
 * Hiển thị báo cáo các resource không được sử dụng
 */
async function showUnusedResourcesReport(
  unusedKeys: string[],
  i18nData: Map<string, any>,
): Promise<void> {
  // Tạo nội dung báo cáo
  let reportContent = `# I18n Unused Resources Report\n\n`;
  reportContent += `Found ${unusedKeys.length} unused i18n resources:\n\n`;

  // Nhóm theo locale
  const keysByLocale = new Map<string, string[]>();

  for (const key of unusedKeys) {
    for (const [locale, data] of i18nData) {
      const value = getI18nValue(data, key);
      if (value) {
        if (!keysByLocale.has(locale)) {
          keysByLocale.set(locale, []);
        }
        keysByLocale.get(locale)!.push(`- \`${key}\`: "${value}"`);
      }
    }
  }

  // Thêm vào báo cáo theo locale
  for (const [locale, keys] of keysByLocale) {
    reportContent += `## ${locale}\n`;
    reportContent += keys.join("\n") + "\n\n";
  }

  // Tạo document tạm thời để hiển thị
  const document = await workspace.openTextDocument({
    content: reportContent,
    language: "markdown",
  });

  await window.showTextDocument(document, { preview: false });

  // Tạo file kết quả trong workspace
  const workspaceFolders = workspace.workspaceFolders;
  if (workspaceFolders) {
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .split("T")[0];
    const reportFileName = `i18n-unused-resources-${timestamp}.md`;
    const reportFilePath = path.join(
      workspaceFolders[0].uri.fsPath,
      reportFileName,
    );

    try {
      fs.writeFileSync(reportFilePath, reportContent, "utf8");

      // Mở file đã lưu
      const savedDocument = await workspace.openTextDocument(
        Uri.file(reportFilePath),
      );
      await window.showTextDocument(savedDocument, { preview: false });

      window.showInformationMessage(`Đã lưu báo cáo tại: ${reportFileName}`);
    } catch (error) {
      console.warn("Không thể lưu file báo cáo:", error);
      // Fallback về document tạm thời nếu không lưu được
    }
  }

  // Hiển thị quick pick với các tùy chọn
  const action = await window.showQuickPick(
    [
      "🗑️ Xóa tất cả resource không sử dụng",
      "📋 Copy danh sách key không sử dụng",
      "❌ Đóng",
    ],
    {
      placeHolder: `Tìm thấy ${unusedKeys.length} resource không được sử dụng. Bạn muốn làm gì?`,
    },
  );

  if (action === "🗑️ Xóa tất cả resource không sử dụng") {
    const confirm = await window.showWarningMessage(
      `Bạn có chắc muốn xóa ${unusedKeys.length} resource không sử dụng? Hành động này không thể hoàn tác.`,
      "Xóa",
      "Hủy",
    );

    if (confirm === "Xóa") {
      await deleteUnusedResources(unusedKeys, i18nData);
    }
  } else if (action === "📋 Copy danh sách key không sử dụng") {
    const keyList = unusedKeys.join("\n");
    await env.clipboard.writeText(keyList);
    window.showInformationMessage("Đã copy danh sách key vào clipboard");
  }
}

/**
 * Xóa các resource không sử dụng khỏi các file JSON
 */
async function deleteUnusedResources(
  unusedKeys: string[],
  i18nData: Map<string, any>,
): Promise<void> {
  try {
    const config = workspace.getConfiguration("codelens-i18n");
    const i18nFolders: string[] = config.get<string[]>("i18nFolder", ["i18n"]);

    let deletedCount = 0;

    for (const [locale, data] of i18nData) {
      let modified = false;

      // Xóa từng key
      for (const key of unusedKeys) {
        if (deleteI18nKey(data, key)) {
          modified = true;
          deletedCount++;
        }
      }

      // Lưu file nếu có thay đổi
      if (modified) {
        const workspaceFolders = workspace.workspaceFolders;
        if (!workspaceFolders) continue;

        // Tìm file tương ứng với locale
        let targetFilePath = "";
        for (const folder of i18nFolders) {
          const folderPath = path.join(workspaceFolders[0].uri.fsPath, folder);
          const testFilePath = path.join(folderPath, `${locale}.json`);

          if (fs.existsSync(testFilePath)) {
            targetFilePath = testFilePath;
            break;
          }
        }

        if (targetFilePath) {
          const jsonContent = JSON.stringify(data, null, 2);
          fs.writeFileSync(targetFilePath, jsonContent, "utf8");
        }
      }
    }

    window.showInformationMessage(
      `Đã xóa ${deletedCount} resource không sử dụng từ ${i18nData.size} file locale`,
    );

    // Refresh CodeLens
    await commands.executeCommand("codelens-i18n.refreshCodeLens");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    window.showErrorMessage(`Lỗi khi xóa resource: ${errorMessage}`);
  }
}

/**
 * Xóa một key khỏi object JSON (hỗ trợ nested)
 */
function deleteI18nKey(data: any, key: string): boolean {
  const keys = key.split(".");
  let current = data;

  // Điều hướng đến object cha
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (current && typeof current === "object" && k in current) {
      current = current[k];
    } else {
      return false; // Key không tồn tại
    }
  }

  // Xóa key cuối cùng
  const finalKey = keys[keys.length - 1];
  if (current && typeof current === "object" && finalKey in current) {
    delete current[finalKey];
    return true;
  }

  return false;
}

/**
 * Hàm kích hoạt extension
 * @param _context Context của extension
 */
export function activate(_context: ExtensionContext) {
  const codelensProvider = new CodelensProvider();

  languages.registerCodeLensProvider("*", codelensProvider);

  // Đăng ký command để force refresh CodeLens
  commands.registerCommand("codelens-i18n.refreshCodeLens", () => {
    // Xóa cache trong provider
    codelensProvider.clearCache();
  });

  // Đăng ký command để bật CodeLens
  commands.registerCommand("codelens-i18n.enableCodeLens", () => {
    workspace
      .getConfiguration("codelens-i18n")
      .update("enableCodeLens", true, true);
  });

  // Đăng ký command để tắt CodeLens
  commands.registerCommand("codelens-i18n.disableCodeLens", () => {
    workspace
      .getConfiguration("codelens-i18n")
      .update("enableCodeLens", false, true);
  });

  // Đăng ký command chính để xử lý action của CodeLens
  commands.registerCommand(
    "codelens-i18n.codelensAction",
    async (
      i18nKey: string,
      translations: string[],
      localeFilePaths: { [locale: string]: string } = {},
    ) => {
      if (!i18nKey) {
        window.showErrorMessage("Không có i18n key được cung cấp");
        return;
      }

      // Lấy danh sách thư mục i18n từ cấu hình
      const config = workspace.getConfiguration("codelens-i18n");
      const i18nFolders: string[] = config.get<string[]>("i18nFolder", [
        "i18n",
      ]);

      // Tạo QuickPick để hiển thị các bản dịch hiện có và cho phép chỉnh sửa
      const quickPick = window.createQuickPick();
      quickPick.title = `Chỉnh sửa i18n: ${i18nKey}`;
      quickPick.placeholder = "Chọn locale để chỉnh sửa hoặc thêm mới";

      // Load dữ liệu i18n hiện có
      const i18nData = await loadI18nData(i18nFolders);
      const itemsWithValues: I18nQuickPickItem[] = [];
      const itemsWithoutValues: I18nQuickPickItem[] = [];

      // Phân tách các locale thành 2 nhóm: có giá trị và không có giá trị
      for (const [locale, data] of i18nData) {
        const currentValue = getI18nValue(data, i18nKey);
        const item: I18nQuickPickItem = {
          label: currentValue ? `${locale}` : `${locale}`,
          description: currentValue || "(Chưa có giá trị)",
          locale: locale,
          currentValue: currentValue || undefined,
        };

        if (currentValue) {
          itemsWithValues.push(item);
        } else {
          itemsWithoutValues.push(item);
        }
      }

      // Tạo danh sách items theo thứ tự ưu tiên: có giá trị trước, không có giá trị sau
      const items: I18nQuickPickItem[] = [];

      // Thêm phần có giá trị
      if (itemsWithValues.length > 0) {
        items.push(...itemsWithValues);
      }

      // Thêm separator và phần không có giá trị
      if (itemsWithoutValues.length > 0) {
        if (itemsWithValues.length > 0) {
          // Thêm separator
          items.push({
            label: "──────────────────────────────",
            description: "",
            locale: "",
            kind: 14, // QuickPickItemKind.Separator
          } as any);
        }
        items.push(...itemsWithoutValues);
      }

      quickPick.items = items;

      // Xử lý khi user chọn một item
      quickPick.onDidAccept(async () => {
        const selected = quickPick.selectedItems[0] as I18nQuickPickItem;
        if (!selected || !selected.locale) return; // Bỏ qua separator

        if (!selected.currentValue) {
          // Tạo bản dịch mới cho locale
          const newValue = await window.showInputBox({
            prompt: `Nhập bản dịch cho locale: (${selected.locale})`,
            value: "",
          });

          if (newValue !== undefined) {
            // Sử dụng đường dẫn file từ localeFilePaths nếu có
            const targetFilePath = localeFilePaths[selected.locale];
            const savedFilePath = await saveI18nValue(
              i18nFolders,
              selected.locale,
              i18nKey,
              newValue,
              targetFilePath,
            );

            // Mở file và focus đến vị trí key đã tạo
            await findAndFocusKey(savedFilePath, i18nKey);

            window.showInformationMessage(
              `Đã thêm bản dịch ${selected.locale}: "${newValue}"`,
            );
            // Trigger refresh CodeLens với delay nhỏ
            setTimeout(async () => {
              await commands.executeCommand("codelens-i18n.refreshCodeLens");
            }, 200);
          }
        } else {
          // Chỉnh sửa locale hiện có
          const newValue = await window.showInputBox({
            prompt: `Nhập bản dịch cho locale (${selected.locale})`,
            value: selected.currentValue || "",
          });

          if (newValue !== undefined) {
            // Sử dụng đường dẫn file từ localeFilePaths nếu có
            const targetFilePath = localeFilePaths[selected.locale];
            const savedFilePath = await saveI18nValue(
              i18nFolders,
              selected.locale,
              i18nKey,
              newValue,
              targetFilePath,
            );

            // Mở file và focus đến vị trí key đã chỉnh sửa
            await findAndFocusKey(savedFilePath, i18nKey);

            window.showInformationMessage(
              `Đã cập nhật ${selected.locale}: "${newValue}"`,
            );
            // Trigger refresh CodeLens với delay nhỏ
            setTimeout(async () => {
              await commands.executeCommand("codelens-i18n.refreshCodeLens");
            }, 200);
          }
        }

        quickPick.dispose();
      });

      quickPick.show();
    },
  );

  // Đăng ký command mở UI setting cho thư mục i18n (hỗ trợ nhiều thư mục)
  commands.registerCommand("codelens-i18n.openI18nFolderSetting", async () => {
    const config = workspace.getConfiguration("codelens-i18n");
    let folders: string[] = config.get<string[]>("i18nFolder", []);
    if (!Array.isArray(folders)) {
      // Nếu là string cũ thì chuyển sang array
      folders = folders ? [folders as unknown as string] : [];
    }
    while (true) {
      const pick = await window.showQuickPick(
        [
          ...folders.map((f) => `🗂 ${f}`),
          "➕ Thêm thư mục mới",
          "💾 Lưu và đóng",
          "❌ Hủy",
        ],
        { placeHolder: "Chọn thao tác với danh sách thư mục i18n" },
      );
      if (!pick || pick === "❌ Hủy" || pick === "💾 Lưu và đóng") {
        if (pick === "💾 Lưu và đóng") {
          await config.update("i18nFolder", folders, true);
          window.showInformationMessage("Đã lưu danh sách thư mục i18n!");
        }
        break;
      }
      if (pick === "➕ Thêm thư mục mới") {
        const newFolder = await window.showInputBox({
          prompt: "Nhập đường dẫn thư mục i18n (tương đối workspace)",
        });
        if (newFolder && !folders.includes(newFolder)) {
          folders.push(newFolder);
        }
      } else if (pick.startsWith("🗂 ")) {
        // Xóa thư mục
        const folderToRemove = pick.replace("🗂 ", "");
        const confirm = await window.showQuickPick(["Có", "Không"], {
          placeHolder: `Xóa thư mục '${folderToRemove}' khỏi danh sách?`,
        });
        if (confirm === "Có") {
          folders = folders.filter((f) => f !== folderToRemove);
        }
      }
    }
  });

  // Đăng ký command mở UI setting cho ngôn ngữ hiển thị
  commands.registerCommand(
    "codelens-i18n.openDisplayLanguageSetting",
    async () => {
      const config = workspace.getConfiguration("codelens-i18n");
      let currentDisplayLanguage: string = config.get<string>(
        "displayLanguage",
        "ja",
      );

      // Danh sách tất cả ngôn ngữ có sẵn
      const availableLanguages = [
        { code: "ja", name: "Japanese (日本語)" },
        { code: "en", name: "English" },
        { code: "vi", name: "Tiếng Việt" },
        { code: "ko", name: "Korean (한국어)" },
        { code: "zh-cn", name: "Chinese Simplified (简体中文)" },
        { code: "zh-tw", name: "Chinese Traditional (繁體中文)" },
      ];

      const availableOptions = availableLanguages.map((lang) => ({
        label:
          lang.code === currentDisplayLanguage
            ? `${lang.code} - ${lang.name}`
            : `${lang.code} - ${lang.name}`,
        detail:
          lang.code === currentDisplayLanguage
            ? "Ngôn ngữ hiển thị hiện tại"
            : "Chọn làm ngôn ngữ hiển thị",
        code: lang.code,
      }));

      const pick = await window.showQuickPick(availableOptions, {
        placeHolder: `Chọn ngôn ngữ hiển thị trong CodeLens title (hiện tại: ${currentDisplayLanguage})`,
      });

      if (pick && pick.code !== currentDisplayLanguage) {
        await config.update("displayLanguage", pick.code, true);
        window.showInformationMessage(`Đã đặt ngôn ngữ hiển thị: ${pick.code}`);
      }
    },
  );

  // Đăng ký command thêm thư mục từ context menu của explorer
  commands.registerCommand(
    "codelens-i18n.addToI18nFolders",
    async (uri: Uri) => {
      if (!uri || !uri.fsPath) {
        window.showErrorMessage("Không thể xác định thư mục được chọn");
        return;
      }

      const config = workspace.getConfiguration("codelens-i18n");
      let folders: string[] = config.get<string[]>("i18nFolder", []);
      if (!Array.isArray(folders)) {
        folders = folders ? [folders as unknown as string] : [];
      }

      // Tính đường dẫn tương đối từ workspace root
      const workspaceFolder = workspace.getWorkspaceFolder(uri);
      if (!workspaceFolder) {
        window.showErrorMessage("Thư mục không nằm trong workspace");
        return;
      }

      const relativePath = workspace.asRelativePath(uri);

      // Kiểm tra xem thư mục đã có trong danh sách chưa
      if (folders.includes(relativePath)) {
        window.showInformationMessage(
          `Thư mục '${relativePath}' đã có trong danh sách i18n`,
        );
        return;
      }

      // Kiểm tra xem thư mục này có phải là con của thư mục đã có trong danh sách không
      const isSubfolder = folders.some((existingFolder) => {
        // Chuẩn hóa đường dẫn với dấu / ở cuối
        const normalizedExisting = existingFolder
          .replace(/\\/g, "/")
          .replace(/\/$/, "");
        const normalizedNew = relativePath
          .replace(/\\/g, "/")
          .replace(/\/$/, "");

        // Kiểm tra nếu thư mục mới bắt đầu với thư mục đã có + dấu /
        return normalizedNew.startsWith(normalizedExisting + "/");
      });

      if (isSubfolder) {
        const parentFolder = folders.find((existingFolder) => {
          const normalizedExisting = existingFolder
            .replace(/\\/g, "/")
            .replace(/\/$/, "");
          const normalizedNew = relativePath
            .replace(/\\/g, "/")
            .replace(/\/$/, "");
          return normalizedNew.startsWith(normalizedExisting + "/");
        });
        window.showInformationMessage(
          `Thư mục '${relativePath}' là con của thư mục '${parentFolder}' đã có trong danh sách i18n`,
        );
        return;
      }

      // Kiểm tra xem có thư mục nào là con của thư mục mới không, nếu có thì xóa chúng
      const childFolders = folders.filter((existingFolder) => {
        const normalizedExisting = existingFolder
          .replace(/\\/g, "/")
          .replace(/\/$/, "");
        const normalizedNew = relativePath
          .replace(/\\/g, "/")
          .replace(/\/$/, "");
        return normalizedExisting.startsWith(normalizedNew + "/");
      });

      if (childFolders.length > 0) {
        const confirm = await window.showQuickPick(["Có", "Không"], {
          placeHolder: `Thư mục '${relativePath}' chứa ${childFolders.length} thư mục con đã có trong danh sách. Bạn có muốn thay thế chúng không?`,
        });

        if (confirm !== "Có") {
          return;
        }

        // Xóa các thư mục con
        folders = folders.filter((folder) => !childFolders.includes(folder));
      }

      folders.push(relativePath);
      await config.update("i18nFolder", folders, true);

      if (childFolders.length > 0) {
        window.showInformationMessage(
          `Đã thêm thư mục '${relativePath}' và xóa ${childFolders.length} thư mục con khỏi danh sách i18n!`,
        );
      } else {
        window.showInformationMessage(
          `Đã thêm thư mục '${relativePath}' vào danh sách i18n!`,
        );
      }
    },
  );

  // Đăng ký command để tìm các i18n resource không được sử dụng
  commands.registerCommand("codelens-i18n.findUnusedResources", async () => {
    await findUnusedI18nResources();
  });
}

/**
 * Phương thức này được gọi khi extension bị deactivated
 */
export function deactivate() {
  if (disposables) {
    disposables.forEach((item) => item.dispose());
  }
  disposables = [];
}
