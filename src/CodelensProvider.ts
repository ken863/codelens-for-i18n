import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * CodelensProvider
 * Lớp cung cấp CodeLens cho VS Code extension
 */
export class CodelensProvider implements vscode.CodeLensProvider {

	// Mảng chứa các CodeLens được tạo ra
	private codeLenses: vscode.CodeLens[] = [];
	// Biểu thức chính quy để tìm kiếm các vị trí hiển thị CodeLens
	private regex: RegExp;
	// EventEmitter để thông báo khi có thay đổi CodeLens
	private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
	// Event công khai để các component khác có thể lắng nghe thay đổi
	public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;
	// Đường dẫn thư mục i18n lấy từ setting
	private i18nFolders: string[] = [];
	// Cache để lưu trữ dữ liệu i18n đã load
	private i18nCache: Map<string, any> = new Map();
	// Cache để lưu trữ đường dẫn file của mỗi locale
	private localeFilePathCache: Map<string, string> = new Map();

	// Method để clear cache từ bên ngoài
	public clearCache(): void {
		this.i18nCache.clear();
		this.localeFilePathCache.clear();
		this._onDidChangeCodeLenses.fire();
	}

	constructor() {
		// Khởi tạo regex để tìm các chuỗi i18n dạng t('key') hoặc t("key") hoặc t(`key`)
		// Hỗ trợ multiline: t(\n    'key'\n)
		this.regex = /t\(\s*(['"`])((?:\\\1|[^\\])*?)\1\s*\)/gs;
		// Đọc setting thư mục i18n
		this.i18nFolders = vscode.workspace.getConfiguration("codelens-i18n").get<string[]>("i18nFolder", ["i18n"]);

		// Lắng nghe sự kiện thay đổi cấu hình của workspace
		// Khi cấu hình thay đổi, sẽ kích hoạt cập nhật CodeLens
		vscode.workspace.onDidChangeConfiguration((e: any) => {
			// Nếu setting i18nFolder thay đổi thì cập nhật lại giá trị
			if (e.affectsConfiguration("codelens-i18n.i18nFolder")) {
				this.i18nFolders = vscode.workspace.getConfiguration("codelens-i18n").get<string[]>("i18nFolder", ["i18n"]);
				// Clear cache khi thay đổi folder
				this.i18nCache.clear();
				this.localeFilePathCache.clear();
			}
			this._onDidChangeCodeLenses.fire();
		});

		// Lắng nghe thay đổi file để refresh cache
		vscode.workspace.onDidSaveTextDocument((document) => {
			// Nếu file JSON được lưu trong thư mục i18n thì clear cache
			if (document.fileName.endsWith('.json')) {
				for (const folder of this.i18nFolders) {
					const workspaceFolders = vscode.workspace.workspaceFolders;
					if (workspaceFolders) {
						const folderPath = path.join(workspaceFolders[0].uri.fsPath, folder);
						if (document.fileName.startsWith(folderPath)) {
							this.i18nCache.clear();
							this._onDidChangeCodeLenses.fire();
							break;
						}
					}
				}
			}
		});
	}

	/**
	 * Duyệt recursive để tìm tất cả file .json trong thư mục
	 */
	private findJsonFilesRecursive(dir: string): string[] {
		const jsonFiles: string[] = [];
		
		if (!fs.existsSync(dir)) return jsonFiles;
		
		try {
			const items = fs.readdirSync(dir, { withFileTypes: true });
			
			for (const item of items) {
				const fullPath = path.join(dir, item.name);
				
				if (item.isDirectory()) {
					// Duyệt recursive vào thư mục con
					jsonFiles.push(...this.findJsonFilesRecursive(fullPath));
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

	/**
	 * Load dữ liệu i18n từ các file JSON trong các thư mục đã chỉ định
	 */
	private async loadI18nData(): Promise<void> {
		this.i18nCache.clear();
		this.localeFilePathCache.clear();
		
		for (const folder of this.i18nFolders) {
			try {
				const workspaceFolders = vscode.workspace.workspaceFolders;
				if (!workspaceFolders) continue;
				
				const folderPath = path.join(workspaceFolders[0].uri.fsPath, folder);
				
				// Kiểm tra nếu thư mục tồn tại
				if (!fs.existsSync(folderPath)) continue;
				
				// Tìm tất cả file JSON recursive
				const jsonFiles = this.findJsonFilesRecursive(folderPath);
				
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
						this.i18nCache.set(locale, jsonData);
						// Lưu đường dẫn file cho locale này
						this.localeFilePathCache.set(locale, filePath);
					} catch (error) {
						console.warn(`Failed to load i18n file ${filePath}:`, error);
					}
				}
			} catch (error) {
				console.warn(`Failed to load i18n folder ${folder}:`, error);
			}
		}
	}

	/**
	 * Lấy giá trị i18n từ key (hỗ trợ nested key với dấu chấm)
	 */
	private getI18nValue(key: string, locale: string = 'en'): string | null {
		const data = this.i18nCache.get(locale);
		if (!data) return null;
		
		// Hỗ trợ nested key như "common.button.save"
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

	/**
	 * Phương thức chính cung cấp các CodeLens cho document
	 * @param document - Tài liệu văn bản hiện tại
	 * @param _token - Token để hủy bỏ thao tác (không sử dụng trong ví dụ này)
	 * @returns Mảng các CodeLens hoặc Promise chứa mảng CodeLens
	 */
	public async provideCodeLenses(document: vscode.TextDocument, _token: vscode.CancellationToken): Promise<vscode.CodeLens[]> {

		// Kiểm tra xem CodeLens có được bật trong cấu hình hay không
		if (vscode.workspace.getConfiguration("codelens-i18n").get("enableCodeLens", true)) {
			// Load dữ liệu i18n nếu cache trống
			if (this.i18nCache.size === 0) {
				await this.loadI18nData();
			}
			
			// Reset mảng codeLenses
			this.codeLenses = [];
			// Tạo regex mới từ pattern đã định nghĩa
			const regex = new RegExp(this.regex);
			// Lấy toàn bộ nội dung văn bản của document
			const text = document.getText();
			let matches;
			
			// Duyệt qua tất cả các match trong văn bản
			while ((matches = regex.exec(text)) !== null) {
				// Tạo range cho toàn bộ match (không chỉ một từ)
				const startPos = document.positionAt(matches.index);
				const endPos = document.positionAt(matches.index + matches[0].length);
				const range = new vscode.Range(startPos, endPos);
				
				if (range) {
					// Lấy i18n key từ match (group thứ 2 trong regex)
					const i18nKey = matches[2];

					if (!i18nKey) continue; // Bỏ qua nếu không có key

					// Tạo CodeLens với metadata về key
					const codeLens = new vscode.CodeLens(range);
					(codeLens as any).i18nKey = i18nKey; // Lưu key để sử dụng trong resolve
					this.codeLenses.push(codeLens);
				}
			}
			return this.codeLenses;
		}
		// Trả về mảng rỗng nếu CodeLens bị tắt
		return [];
	}

	/**
	 * Phương thức resolve để cung cấp command cho CodeLens
	 * @param codeLens - CodeLens cần được resolve
	 * @param _token - Token để hủy bỏ thao tác (không sử dụng trong ví dụ này)
	 * @returns CodeLens đã được gắn command hoặc null
	 */
	public resolveCodeLens(codeLens: vscode.CodeLens, _token: vscode.CancellationToken) {
		// Kiểm tra xem CodeLens có được bật trong cấu hình hay không
		if (vscode.workspace.getConfiguration("codelens-i18n").get("enableCodeLens", true)) {
			// Lấy i18n key từ metadata
			const i18nKey = (codeLens as any).i18nKey;
			
			// Tìm giá trị i18n từ các locale
			const translations: string[] = [];
			const localeFilePaths: { [locale: string]: string } = {};
			for (const [locale, _] of this.i18nCache) {
				const value = this.getI18nValue(i18nKey, locale);
				if (value) {
					translations.push(`${locale}: "${value}"`);
				}
				// Lưu đường dẫn file cho locale này
				const filePath = this.localeFilePathCache.get(locale);
				if (filePath) {
					localeFilePaths[locale] = filePath;
				}
			}
			
			// Tạo title hiển thị
			let title = `${i18nKey}`;
			if (translations.length > 0) {
				title = `${translations.join(' | ')}`;
			} else {
				title = `${i18nKey} (Not found)`;
			}
			
			// Gắn command cho CodeLens
			codeLens.command = {
				title: title,
				tooltip: `i18n key: ${i18nKey}`, // Tooltip khi hover
				command: "codelens-i18n.codelensAction", // ID của command được thực thi
				arguments: [i18nKey, translations, localeFilePaths] // Truyền key, translations và file paths
			};
			return codeLens;
		}
		// Trả về null nếu CodeLens bị tắt
		return null;
	}
}

