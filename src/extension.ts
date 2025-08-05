// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { ExtensionContext, languages, commands, Disposable, workspace, window, Uri, QuickPickItem } from 'vscode';
import { CodelensProvider } from './CodelensProvider';
import * as fs from 'fs';
import * as path from 'path';

interface I18nQuickPickItem extends QuickPickItem {
	locale: string;
	currentValue?: string;
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

let disposables: Disposable[] = [];

// Helper functions for i18n data management
function findJsonFilesRecursive(dir: string): string[] {
	const jsonFiles: string[] = [];
	
	if (!fs.existsSync(dir)) return jsonFiles;
	
	try {
		const items = fs.readdirSync(dir, { withFileTypes: true });
		
		for (const item of items) {
			const fullPath = path.join(dir, item.name);
			
			if (item.isDirectory()) {
				// Duyệt recursive vào thư mục con
				jsonFiles.push(...findJsonFilesRecursive(fullPath));
			} else if (item.isFile() && item.name.endsWith('.json')) {
				// Thêm file .json vào danh sách
				jsonFiles.push(fullPath);
			}
		}
	} catch (error) {
		console.warn(`Failed to read directory ${dir}:`, error);
	}
	
	return jsonFiles;
}

async function loadI18nData(i18nFolders: string[]): Promise<Map<string, any>> {
	const i18nCache = new Map<string, any>();
	
	for (const folder of i18nFolders) {
		try {
			const workspaceFolders = workspace.workspaceFolders;
			if (!workspaceFolders) continue;
			
			const folderPath = path.join(workspaceFolders[0].uri.fsPath, folder);
			
			if (!fs.existsSync(folderPath)) continue;
			
			// Tìm tất cả file JSON recursive
			const jsonFiles = findJsonFilesRecursive(folderPath);
			
			for (const filePath of jsonFiles) {
				try {
					const content = fs.readFileSync(filePath, 'utf8');
					const jsonData = JSON.parse(content);
					
					// Tạo locale key từ đường dẫn tương đối
					const relativePath = path.relative(folderPath, filePath);
					let locale = relativePath.replace(/\.json$/, '').replace(/[\/\\]/g, '.');
					
					// Nếu file ở root thì dùng tên file, nếu ở subfolder thì dùng path
					if (!relativePath.includes(path.sep)) {
						locale = path.basename(filePath, '.json');
					}
					
					console.log(`Loading i18n file: ${filePath} as locale: ${locale}`);
					i18nCache.set(locale, jsonData);
				} catch (error) {
					console.warn(`Failed to load i18n file ${filePath}:`, error);
				}
			}
		} catch (error) {
			console.warn(`Failed to load i18n folder ${folder}:`, error);
		}
	}
	
	return i18nCache;
}

function getI18nValue(data: any, key: string): string | null {
	const keys = key.split('.');
	let value = data;
	
	for (const k of keys) {
		if (value && typeof value === 'object' && k in value) {
			value = value[k];
		} else {
			return null;
		}
	}
	
	return typeof value === 'string' ? value : null;
}

function setI18nValue(data: any, key: string, value: string): void {
	const keys = key.split('.');
	let current = data;
	
	console.log(`Setting i18n value - Key: ${key}, Value: ${value}`);
	console.log(`Keys array:`, keys);
	
	// Navigate to the parent object
	for (let i = 0; i < keys.length - 1; i++) {
		const k = keys[i];
		console.log(`Processing key part: ${k}`);
		if (!(k in current) || typeof current[k] !== 'object' || current[k] === null) {
			console.log(`Creating new object for key: ${k}`);
			current[k] = {};
		}
		current = current[k];
		console.log(`Current object after processing ${k}:`, current);
	}
	
	// Set the final value
	const finalKey = keys[keys.length - 1];
	console.log(`Setting final key: ${finalKey} = ${value}`);
	current[finalKey] = value;
	console.log(`Final object:`, JSON.stringify(data, null, 2));
}

async function saveI18nValue(i18nFolders: string[], locale: string, key: string, value: string, targetFilePath?: string): Promise<string> {
	try {
		const workspaceFolders = workspace.workspaceFolders;
		if (!workspaceFolders) {
			throw new Error('Không có workspace folder nào được mở');
		}
		
		let finalTargetPath = '';
		
		// Nếu có targetFilePath thì sử dụng luôn
		if (targetFilePath && fs.existsSync(targetFilePath)) {
			finalTargetPath = targetFilePath;
			console.log(`Using provided target file path: ${finalTargetPath}`);
		} else {
			// Tìm thư mục chứa file locale hiện có hoặc sử dụng thư mục đầu tiên
			let targetFolder = i18nFolders[0] || 'i18n';
			
			// Kiểm tra từng thư mục để tìm file locale hiện có
			for (const folder of i18nFolders) {
				const folderPath = path.join(workspaceFolders[0].uri.fsPath, folder);
				const testFilePath = path.join(folderPath, `${locale}.json`);
				
				if (fs.existsSync(testFilePath)) {
					targetFolder = folder;
					finalTargetPath = testFilePath;
					console.log(`Found existing file in folder: ${folder}`);
					break;
				}
			}
			
			// Nếu không tìm thấy file hiện có, sử dụng thư mục đầu tiên
			if (!finalTargetPath) {
				const folderPath = path.join(workspaceFolders[0].uri.fsPath, targetFolder);
				finalTargetPath = path.join(folderPath, `${locale}.json`);
				console.log(`Using default folder: ${targetFolder}`);
			}
		}
		
		console.log(`Saving i18n value to: ${finalTargetPath}`);
		console.log(`Key: ${key}, Value: ${value}`);
		
		// Ensure directory exists
		const folderPath = path.dirname(finalTargetPath);
		if (!fs.existsSync(folderPath)) {
			console.log(`Creating directory: ${folderPath}`);
			fs.mkdirSync(folderPath, { recursive: true });
		}
		
		// Load existing data or create new object
		let data = {};
		if (fs.existsSync(finalTargetPath)) {
			try {
				const content = fs.readFileSync(finalTargetPath, 'utf8');
				console.log(`Existing file content: ${content}`);
				data = JSON.parse(content);
			} catch (error) {
				console.warn(`Failed to parse existing file ${finalTargetPath}:`, error);
				data = {}; // Reset to empty object if parse fails
			}
		} else {
			console.log(`File does not exist, creating new: ${finalTargetPath}`);
		}
		
		// Set the new value
		setI18nValue(data, key, value);
		console.log(`Data after setting value:`, JSON.stringify(data, null, 2));
		
		// Save back to file
		const jsonContent = JSON.stringify(data, null, 2);
		fs.writeFileSync(finalTargetPath, jsonContent, 'utf8');
		console.log(`Successfully saved to: ${finalTargetPath}`);
		
		// Verify file was written
		if (fs.existsSync(finalTargetPath)) {
			const verifyContent = fs.readFileSync(finalTargetPath, 'utf8');
			console.log(`Verified file content: ${verifyContent}`);
		}
		
		return finalTargetPath; // Return the actual file path used
	} catch (error) {
		console.error(`Failed to save i18n value:`, error);
		const errorMessage = error instanceof Error ? error.message : String(error);
		window.showErrorMessage(`Lỗi khi lưu file i18n: ${errorMessage}`);
		throw error;
	}
}

interface I18nQuickPickItem extends QuickPickItem {
	locale: string;
	currentValue?: string;
}

export function activate(_context: ExtensionContext) {
	const codelensProvider = new CodelensProvider();

	languages.registerCodeLensProvider("*", codelensProvider);

	// Đăng ký command để force refresh CodeLens
	commands.registerCommand("codelens-i18n.refreshCodeLens", () => {
		// Clear cache trong provider
		codelensProvider.clearCache();
	});

	commands.registerCommand("codelens-i18n.enableCodeLens", () => {
		workspace.getConfiguration("codelens-i18n").update("enableCodeLens", true, true);
	});

	commands.registerCommand("codelens-i18n.disableCodeLens", () => {
		workspace.getConfiguration("codelens-i18n").update("enableCodeLens", false, true);
	});

	commands.registerCommand("codelens-i18n.codelensAction", async (i18nKey: string, translations: string[], localeFilePaths: { [locale: string]: string } = {}) => {
		if (!i18nKey) {
			window.showErrorMessage('Không có i18n key được cung cấp');
			return;
		}

		console.log(`CodeLens action called - Key: ${i18nKey}`);
		console.log(`Locale file paths:`, localeFilePaths);

		// Lấy danh sách thư mục i18n từ cấu hình
		const config = workspace.getConfiguration("codelens-i18n");
		const i18nFolders: string[] = config.get<string[]>("i18nFolder", ["i18n"]);
		
		// Tạo QuickPick để hiển thị các bản dịch hiện có và cho phép chỉnh sửa
		const quickPick = window.createQuickPick();
		quickPick.title = `Chỉnh sửa i18n: ${i18nKey}`;
		quickPick.placeholder = 'Chọn locale để chỉnh sửa hoặc thêm mới';
		
		// Load dữ liệu i18n hiện có
		const i18nData = await loadI18nData(i18nFolders);
		const items: I18nQuickPickItem[] = [];
		
		// Thêm các locale hiện có
		for (const [locale, data] of i18nData) {
			const currentValue = getI18nValue(data, i18nKey);
			items.push({
				label: `📝 ${locale}`,
				description: currentValue || '(chưa có giá trị)',
				detail: `Chỉnh sửa bản dịch ${locale}`,
				locale: locale,
				currentValue: currentValue || undefined
			});
		}
		
		// Thêm option để tạo locale mới
		items.push({
			label: '➕ Thêm locale mới',
			description: 'Tạo bản dịch cho ngôn ngữ mới',
			detail: 'Nhập mã ngôn ngữ (ví dụ: en, vi, fr)',
			locale: 'new'
		});
		
		quickPick.items = items;
		
		quickPick.onDidAccept(async () => {
			const selected = quickPick.selectedItems[0] as I18nQuickPickItem;
			if (!selected) return;
			
			if (selected.locale === 'new') {
				// Tạo locale mới
				const newLocale = await window.showInputBox({
					prompt: 'Nhập mã ngôn ngữ (ví dụ: en, vi, fr)',
					validateInput: (value) => {
						if (!value || !/^[a-z]{2,3}(-[A-Z]{2})?$/.test(value)) {
							return 'Mã ngôn ngữ không hợp lệ. Sử dụng định dạng: en, vi, en-US';
						}
						return null;
					}
				});
				
				if (!newLocale) {
					quickPick.dispose();
					return;
				}
				
				// Nhập giá trị cho locale mới
				const newValue = await window.showInputBox({
					prompt: `Nhập bản dịch cho "${i18nKey}" (${newLocale})`,
					value: ''
				});
				
				if (newValue !== undefined) {
					// Sử dụng đường dẫn file từ localeFilePaths nếu có
					const targetFilePath = localeFilePaths[newLocale];
					const savedFilePath = await saveI18nValue(i18nFolders, newLocale, i18nKey, newValue, targetFilePath);
					
					// Force VS Code to refresh the file in editor
					const fileUri = Uri.file(savedFilePath);
					
					// Mở file để VS Code nhận ra thay đổi
					try {
						const doc = await workspace.openTextDocument(fileUri);
						await window.showTextDocument(doc, { preview: false, preserveFocus: true });
					} catch (error) {
						console.warn('Could not open file:', error);
					}
					
					window.showInformationMessage(`Đã thêm bản dịch ${newLocale}: "${newValue}"`);
					// Trigger refresh CodeLens - thêm delay nhỏ
					setTimeout(async () => {
						await commands.executeCommand('codelens-i18n.refreshCodeLens');
					}, 200);
				}
			} else {
				// Chỉnh sửa locale hiện có
				const newValue = await window.showInputBox({
					prompt: `Nhập bản dịch cho "${i18nKey}" (${selected.locale})`,
					value: selected.currentValue || ''
				});
				
				if (newValue !== undefined) {
					// Sử dụng đường dẫn file từ localeFilePaths nếu có
					const targetFilePath = localeFilePaths[selected.locale];
					const savedFilePath = await saveI18nValue(i18nFolders, selected.locale, i18nKey, newValue, targetFilePath);
					
					// Force VS Code to refresh the file in editor
					const fileUri = Uri.file(savedFilePath);
					
					// Mở file để VS Code nhận ra thay đổi
					try {
						const doc = await workspace.openTextDocument(fileUri);
						await window.showTextDocument(doc, { preview: false, preserveFocus: true });
					} catch (error) {
						console.warn('Could not open file:', error);
					}
					
					window.showInformationMessage(`Đã cập nhật ${selected.locale}: "${newValue}"`);
					// Trigger refresh CodeLens - thêm delay nhỏ
					setTimeout(async () => {
						await commands.executeCommand('codelens-i18n.refreshCodeLens');
					}, 200);
				}
			}
			
			quickPick.dispose();
		});
		
		quickPick.show();
	});

	// Đăng ký command mở UI setting cho i18nFolder (nhiều thư mục)
	commands.registerCommand("codelens-i18n.openI18nFolderSetting", async () => {
		const config = workspace.getConfiguration("codelens-i18n");
		let folders: string[] = config.get<string[]>("i18nFolder", []);
		if (!Array.isArray(folders)) {
			// Nếu là string cũ thì chuyển sang array
			folders = folders ? [folders as unknown as string] : [];
		}
		while (true) {
			const pick = await window.showQuickPick([
				...folders.map(f => `🗂 ${f}`),
				'➕ Thêm thư mục mới',
				'💾 Lưu và đóng',
				'❌ Hủy'
			], { placeHolder: 'Chọn thao tác với danh sách thư mục i18n' });
			if (!pick || pick === '❌ Hủy' || pick === '💾 Lưu và đóng') {
				if (pick === '💾 Lưu và đóng') {
					await config.update("i18nFolder", folders, true);
					window.showInformationMessage('Đã lưu danh sách thư mục i18n!');
				}
				break;
			}
			if (pick === '➕ Thêm thư mục mới') {
				const newFolder = await window.showInputBox({ prompt: 'Nhập đường dẫn thư mục i18n (tương đối workspace)' });
				if (newFolder && !folders.includes(newFolder)) {
					folders.push(newFolder);
				}
			} else if (pick.startsWith('🗂 ')) {
				// Xóa thư mục
				const folderToRemove = pick.replace('🗂 ', '');
				const confirm = await window.showQuickPick(['Có', 'Không'], { placeHolder: `Xóa thư mục '${folderToRemove}' khỏi danh sách?` });
				if (confirm === 'Có') {
					folders = folders.filter(f => f !== folderToRemove);
				}
			}
		}
	});

	// Đăng ký command thêm thư mục từ context menu của explorer
	commands.registerCommand("codelens-i18n.addToI18nFolders", async (uri: Uri) => {
		if (!uri || !uri.fsPath) {
			window.showErrorMessage('Không thể xác định thư mục được chọn');
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
			window.showErrorMessage('Thư mục không nằm trong workspace');
			return;
		}

		const relativePath = workspace.asRelativePath(uri);
		
		if (folders.includes(relativePath)) {
			window.showInformationMessage(`Thư mục '${relativePath}' đã có trong danh sách i18n`);
			return;
		}

		folders.push(relativePath);
		await config.update("i18nFolder", folders, true);
		window.showInformationMessage(`Đã thêm thư mục '${relativePath}' vào danh sách i18n!`);
	});
}

// this method is called when your extension is deactivated
export function deactivate() {
	if (disposables) {
		disposables.forEach(item => item.dispose());
	}
	disposables = [];
}
