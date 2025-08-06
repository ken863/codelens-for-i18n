# 🌐 CodeLens for i18n Extension

Extension VS Code hỗ trợ quản lý và chỉnh sửa các chuỗi internationalization (i18n) trực tiếp trong code. Extension cung cấp CodeLens để hiển thị, chỉnh sửa và quản lý translations.

## ✨ Tính năng chính

### 🔍 **Tự động phát hiện và hiển thị i18n strings**
- **Hỗ trợ patterns đa dạng**: `t('key')`, `t("key")`, `t(\`key\`)`
- **Multiline support**: Hỗ trợ patterns trải dài nhiều dòng
  ```javascript
  t(
    'ACCOUNT.DISPLAY_NAME_UNKNOWN'
  )
  ```
- **Hiển thị với priority**: Ưu tiên hiển thị ngôn ngữ theo cấu hình với fallback
- **Tooltip chi tiết**: Hiển thị tất cả translations có sẵn, phân tách rõ ràng giữa có/chưa có bản dịch

### 🎯 **Ngôn ngữ hiển thị có priority**
- **Cấu hình ngôn ngữ ưu tiên**: Chọn ngôn ngữ hiển thị mặc định trong CodeLens (Japanese mặc định)
- **Hỗ trợ locale prefix**: Xử lý các locale có prefix (VD: `locales.ja` → `ja`)
- **Priority fallback**: Tự động fallback theo thứ tự: displayLanguage → ja → en → vi → ko → zh-cn → zh-tw

### 📁 **Quản lý thư mục**
- **Multi-folder support**: Hỗ trợ nhiều thư mục i18n cùng lúc
- **Recursive scanning**: Tìm kiếm file .json trong tất cả subfolder
- **Folder management**: Tự động tránh trùng lặp và xử lý hierarchy
- **Context menu integration**: Right-click folder để thêm vào danh sách i18n

### 🛠 **Chỉnh sửa**
- **Inline editing**: Click CodeLens để mở dialog chỉnh sửa trực tiếp
- **File opening**: Tự động mở file JSON và focus đến đúng vị trí key đã chỉnh sửa
- **Priority-based dialog**: Hiển thị translations có sẵn trước, chưa có sau (với separator)
- **Auto-save**: Lưu tự động với verification và path resolution

### 📁 **Cấu trúc thư mục linh hoạt**

#### Cấu trúc phẳng:
```
i18n/
├── en.json
├── vi.json
└── fr.json
```

#### Cấu trúc nested:
```
i18n/
├── locales/
│   ├── en/
│   │   ├── common.json
│   │   └── auth.json
│   └── vi/
│       ├── common.json
│       └── auth.json
└── modules/
    ├── auth/
    │   ├── en.json
    │   └── vi.json
    └── dashboard/
        ├── en.json
        └── vi.json
```

### 🎯 **Locale mapping**

| Cấu trúc file | Locale key | Ví dụ |
|---------------|------------|-------|
| `i18n/en.json` | `en` | Root level |
| `i18n/locales/en/common.json` | `locales.en.common` | Nested path |
| `i18n/modules/auth/en.json` | `modules.auth.en` | Module based |

### 🛠 **Chỉnh sửa trực tiếp**
- **Click CodeLens** để mở dialog chỉnh sửa
- **Xem tất cả translations** cho 1 key
- **Chỉnh sửa translation** hiện có
- **Thêm locale mới** 
- **Auto-save** với đường dẫn file chính xác

## 🚀 Cài đặt & Sử dụng

### 1. **Cài đặt Extension**
```bash
# Clone project
git clone https://github.com/ken863/codelens-for-i18n.git
cd codelens-for-i18n

# Cài đặt dependencies
npm install

# Build extension
npm run compile
```

### 2. **Development & Testing**
```bash
# Watch mode cho development
npm run watch

# Hoặc compile một lần
npm run compile

# Mở Extension Development Host
# Nhấn F5 trong VS Code hoặc
# Run → Start Debugging
```

### 3. **Packaging Extension**
```bash
# Cài đặt vsce nếu chưa có
npm install -g vsce

# Package extension
vsce package

# Install local
code --install-extension codelens-i18n-1.0.0.vsix
```

### 4. **Cấu hình ban đầu**

#### Thông qua Command Palette:
- `Cmd+Shift+P` (Mac) / `Ctrl+Shift+P` (Windows/Linux)
- Tìm: "CodeLens for i18n: Setting i18n folder"
- Chọn và cấu hình thư mục i18n

#### Thông qua Context Menu:
- Right-click vào folder trong Explorer
- Chọn "Add to i18n folders"
- Extension sẽ tự động thêm folder vào cấu hình

#### Thông qua Settings:
```json
{
  "codelens-i18n.i18nFolder": [
    "i18n",
    "src/locales", 
    "assets/translations"
  ],
  "codelens-i18n.enableCodeLens": true,
  "codelens-i18n.displayLanguage": "ja"
}
```

### 5. **Sử dụng cơ bản**
1. **Mở file có chứa i18n patterns** (VD: `t('welcome.message')`)
2. **CodeLens sẽ hiển thị** ngay trên dòng code
3. **Click vào CodeLens** để mở dialog chỉnh sửa
4. **Chọn locale** để chỉnh sửa hoặc thêm mới
5. **Nhập bản dịch** và nhấn Enter
6. **File JSON sẽ tự động cập nhật** và focus đến vị trí đã chỉnh sửa

### 6. **Ví dụ cấu trúc file**

#### Cấu trúc đơn giản (flat):
```
i18n/
├── en.json
├── ja.json
├── vi.json
└── ko.json
```

#### Cấu trúc phức tạp (nested):
```
i18n/
├── locales/
│   ├── en/
│   │   ├── common.json
│   │   └── auth.json
│   ├── ja/
│   │   ├── common.json
│   │   └── auth.json
│   └── vi/
│       ├── common.json
│       └── auth.json
└── modules/
    ├── auth/
    │   ├── en.json
    │   ├── ja.json
    │   └── vi.json
    └── dashboard/
        ├── en.json
        ├── ja.json
        └── vi.json
```

### 🎯 **Locale mapping**

| Cấu trúc file | Locale key | Hiển thị trong CodeLens |
|---------------|------------|-------------------------|
| `i18n/en.json` | `en` | `en: "Hello World"` |
| `i18n/locales/ja/common.json` | `locales.ja.common` | `locales.ja.common: "こんにちは"` |
| `i18n/modules/auth/vi.json` | `modules.auth.vi` | `modules.auth.vi: "Xin chào"` |

## ⚙️ Commands & Settings

### Commands có sẵn:

| Command | Mô tả | Shortcut |
|---------|-------|----------|
| `codelens-i18n.enableCodeLens` | Bật hiển thị CodeLens | Command Palette |
| `codelens-i18n.disableCodeLens` | Tắt hiển thị CodeLens | Command Palette |
| `codelens-i18n.refreshCodeLens` | Refresh cache và reload CodeLens | Auto trigger |
| `codelens-i18n.openI18nFolderSetting` | Cấu hình thư mục i18n | Command Palette |
| `codelens-i18n.openDisplayLanguageSetting` | Cấu hình ngôn ngữ hiển thị | Command Palette |
| `codelens-i18n.addToI18nFolders` | Thêm folder vào danh sách i18n | Right-click menu |

### Settings chi tiết:

```json
{
  // Bật/tắt CodeLens
  "codelens-i18n.enableCodeLens": true,
  
  // Danh sách thư mục i18n (hỗ trợ nhiều thư mục)
  "codelens-i18n.i18nFolder": [
    "i18n",
    "src/locales",
    "assets/translations"
  ],
  
  // Ngôn ngữ ưu tiên hiển thị trong CodeLens title
  "codelens-i18n.displayLanguage": "ja"
}
```

### Ngôn ngữ hiển thị hỗ trợ:
- `ja` - Japanese (日本語) - **Mặc định**
- `en` - English
- `vi` - Tiếng Việt  
- `ko` - Korean (한국어)
- `zh-cn` - Chinese Simplified (简体中文)
- `zh-tw` - Chinese Traditional (繁體中文)

## 🎯 Code Examples & Patterns

### Patterns được hỗ trợ:
```javascript
// Single line patterns
const msg1 = t('welcome.message');
const msg2 = t("user.greeting");
const msg3 = t(`app.title`);

// Multiline patterns  
const msg4 = t(
    'ACCOUNT.DISPLAY_NAME_UNKNOWN'
);

const msg5 = t(
    "auth.form.username"
);

// Nested trong function calls
showMessage(t(
  'error.validation.required'
));

// Trong JSX/React
<Button>{t('common.button.save')}</Button>

// Trong template strings
const notification = `${t('notification.prefix')}: ${message}`;
```

### Ví dụ file JSON:

#### Simple structure:
```json
// i18n/en.json
{
  "welcome": {
    "message": "Welcome to our application!"
  },
  "user": {
    "greeting": "Hello, {{name}}!"
  },
  "common": {
    "button": {
      "save": "Save",
      "cancel": "Cancel",
      "delete": "Delete"
    }
  }
}
```

#### Module-based structure:
```json
// i18n/modules/auth/en.json
{
  "auth": {
    "form": {
      "username": "Username",
      "password": "Password",
      "login": "Login"
    },
    "error": {
      "invalid_credentials": "Invalid username or password",
      "session_expired": "Your session has expired"
    }
  }
}
```

### Nested key examples:
```javascript
// Sẽ tìm trong JSON structure
t('welcome.message')          // → welcome.message
t('user.greeting')           // → user.greeting  
t('common.button.save')      // → common.button.save
t('auth.form.username')      // → auth.form.username
t('error.validation.required') // → error.validation.required
```

## 🔧 Advanced Configuration

### Multi-workspace setup:
```json
// .vscode/settings.json trong workspace
{
  "codelens-i18n.i18nFolder": [
    "frontend/src/i18n",
    "backend/locales",
    "shared/translations"
  ],
  "codelens-i18n.displayLanguage": "en"
}
```

### Project-specific patterns:
```json
// Cho React projects
{
  "codelens-i18n.i18nFolder": [
    "src/locales",
    "public/locales"
  ]
}

// Cho Vue.js projects  
{
  "codelens-i18n.i18nFolder": [
    "src/i18n/locales",
    "locales"
  ]
}

// Cho Angular projects
{
  "codelens-i18n.i18nFolder": [
    "src/assets/i18n",
    "src/app/shared/i18n"
  ]
}
```

## 🐛 Troubleshooting & FAQ

### ❓ **CodeLens không hiển thị**
**Nguyên nhân & Giải pháp:**
- ✅ **Kiểm tra setting**: `"codelens-i18n.enableCodeLens": true`
- ✅ **Đảm bảo có file .json** trong thư mục i18n đã cấu hình  
- ✅ **Kiểm tra pattern**: Đảm bảo sử dụng `t('key')`, `t("key")` hoặc `t(\`key\`)`
- ✅ **Restart Extension**: Nhấn `Ctrl+Shift+P` → "Developer: Reload Window"

### ❓ **File save không thành công**
**Nguyên nhân & Giải pháp:**
- ✅ **Kiểm tra quyền write** vào thư mục
- ✅ **Đảm bảo JSON syntax hợp lệ** trong file hiện có
- ✅ **Kiểm tra disk space** còn trống
- ✅ **File không bị lock** bởi ứng dụng khác

### ❓ **Performance chậm với nhiều file**
**Tối ưu hóa:**
- ✅ **Extension tự động cache** dữ liệu
- ✅ **Chỉ reload khi file .json thay đổi**
- ✅ **Giới hạn số lượng thư mục i18n** nếu không cần thiết
- ✅ **Sử dụng .gitignore** để loại trừ thư mục không cần thiết

### ❓ **CodeLens hiển thị sai ngôn ngữ**
**Cấu hình:**
- ✅ **Kiểm tra setting displayLanguage**: `"codelens-i18n.displayLanguage": "ja"`
- ✅ **Thứ tự fallback**: displayLanguage → ja → en → vi → ko → zh-cn → zh-tw
- ✅ **Prefix handling**: Extension tự động xử lý `locales.ja` → `ja`

### ❓ **Thư mục i18n không được phát hiện**
**Cấu hình:**
- ✅ **Sử dụng đường dẫn tương đối** từ workspace root
- ✅ **Kiểm tra cấu trúc**: `"codelens-i18n.i18nFolder": ["i18n", "src/locales"]`
- ✅ **Right-click folder** → "Add to i18n folders" để thêm tự động

### ❓ **Extension không hoạt động sau update**
**Reset & Reload:**
```bash
# Xóa cache
rm -rf ~/.vscode/extensions/cache

# Rebuild extension
npm run compile

# Restart VS Code
```

## 📈 Performance Tips

### 🚀 **Tối ưu cho dự án lớn**
1. **Giới hạn thư mục**: Chỉ add những thư mục thực sự chứa i18n files
2. **Sử dụng nested structure**: Tổ chức file theo module để dễ quản lý
3. **Regular cleanup**: Định kỳ xóa các locale/key không sử dụng
4. **Cache management**: Extension tự động quản lý cache, không cần can thiệp

### 📊 **Monitoring**
- **Console logs**: Mở Developer Tools để xem logs chi tiết
- **Performance**: Extension track số lượng file và thời gian load
- **Memory usage**: Cache được optimize để không tốn nhiều memory

## 🛠 Development Guide

### **Setup Development Environment**
```bash
# Clone và setup
git clone https://github.com/ken863/codelens-for-i18n.git
cd codelens-for-i18n
npm install

# Development workflow
npm run watch    # Auto compile khi có thay đổi
npm run compile  # Manual compile
npm run lint     # Check code quality

# Testing
# Nhấn F5 để mở Extension Development Host
# Tạo test files để verify functionality
```

### **Code Structure**
```
src/
├── extension.ts       # Main extension logic, commands registration
├── CodelensProvider.ts # CodeLens provider implementation
package.json          # Extension manifest, configurations
README.md            # Documentation
tsconfig.json        # TypeScript configuration
eslint.config.mjs    # ESLint configuration
```

### **Key Files Explained**

#### **`extension.ts`**
- **Main entry point** cho extension
- **Command registration** cho tất cả commands
- **Helper functions** cho i18n data management
- **Settings & configuration handling**

#### **`CodelensProvider.ts`**  
- **Core CodeLens logic**
- **Pattern detection** và regex processing
- **i18n data loading** và caching
- **Display logic** cho tooltip và title

#### **`package.json`**
- **Extension manifest** với metadata
- **Commands definition** và keyboard shortcuts
- **Configuration schema** cho settings
- **Dependencies** và build scripts

### **Adding New Features**

#### **1. Thêm command mới**
```typescript
// Trong extension.ts
commands.registerCommand("codelens-i18n.yourNewCommand", async () => {
    // Implementation here
});
```

#### **2. Thêm configuration mới**
```json
// Trong package.json
"configuration": {
    "properties": {
        "codelens-i18n.yourNewSetting": {
            "type": "boolean",
            "default": true,
            "description": "Your setting description"
        }
    }
}
```

#### **3. Modify CodeLens behavior**
```typescript
// Trong CodelensProvider.ts - provideCodeLenses method
// Thêm logic detection mới

// Trong CodelensProvider.ts - resolveCodeLens method  
// Thêm logic display mới
```

### **Testing Checklist**
- ✅ **Basic patterns**: `t('key')`, `t("key")`, `t(\`key\`)`
- ✅ **Multiline patterns**: Code trải dài nhiều dòng
- ✅ **Multiple folders**: Test với nhiều thư mục i18n
- ✅ **Nested structures**: Test với cấu trúc file phức tạp
- ✅ **File operations**: Create, edit, save translations
- ✅ **Settings**: Test tất cả configuration options
- ✅ **Performance**: Test với project lớn

### **Release Process**
```bash
# 1. Update version
npm version patch|minor|major

# 2. Build
npm run compile

# 3. Package  
vsce package

# 4. Test package
code --install-extension codelens-i18n-*.vsix

# 5. Publish (if applicable)
vsce publish
```

---

## 🎉 Demo & Examples

### **Live Demo Steps**
1. **Clone và setup project**
2. **Mở Extension Development Host** (F5)
3. **Tạo test file** với i18n patterns
4. **Xem CodeLens hiển thị** translations
5. **Click để edit** và xem file tự động update
6. **Test multiple folders** và nested structures

### **Test Files Examples**

#### **test-basic.js**
```javascript
// Basic patterns testing
const welcome = t('welcome.message');
const greeting = t("user.greeting");
const title = t(`app.title`);

// Nested keys
const saveButton = t('common.button.save');
const errorMsg = t('error.validation.required');
```

#### **test-multiline.js**  
```javascript
// Multiline patterns testing
const longKey = t(
    'ACCOUNT.DISPLAY_NAME_UNKNOWN'
);

const formError = t(
    "form.validation.email.invalid"
);

function showError() {
    alert(t(
        'error.network.connection_failed'
    ));
}
```

#### **test-react.jsx**
```jsx
// React component testing
function MyComponent() {
    return (
        <div>
            <h1>{t('page.home.title')}</h1>
            <Button onClick={handleSave}>
                {t('common.button.save')}
            </Button>
            <p>{t('page.home.description')}</p>
        </div>
    );
}
```

### **Sample i18n Files**

#### **i18n/en.json**
```json
{
  "welcome": {
    "message": "Welcome to our application!"
  },
  "user": {
    "greeting": "Hello, {{name}}!"
  },
  "common": {
    "button": {
      "save": "Save",
      "cancel": "Cancel",
      "delete": "Delete"
    }
  },
  "error": {
    "validation": {
      "required": "This field is required",
      "email": {
        "invalid": "Please enter a valid email address"
      }
    },
    "network": {
      "connection_failed": "Network connection failed. Please try again."
    }
  }
}
```

#### **i18n/ja.json**
```json
{
  "welcome": {
    "message": "私たちのアプリケーションへようこそ！"
  },
  "user": {
    "greeting": "こんにちは、{{name}}さん！"
  },
  "common": {
    "button": {
      "save": "保存",
      "cancel": "キャンセル", 
      "delete": "削除"
    }
  },
  "error": {
    "validation": {
      "required": "この項目は必須です",
      "email": {
        "invalid": "有効なメールアドレスを入力してください"
      }
    },
    "network": {
      "connection_failed": "ネットワーク接続に失敗しました。もう一度お試しください。"
    }
  }
}
```

### 🏆 Features Showcase

### ✨ **Display Priority**
```
CodeLens: ja: "保存"  # Japanese prioritized
Tooltip: 
├── ja: "保存"
├── en: "Save"  
├── vi: "Lưu"
├──────────────────
├── ko: (chưa có bản dịch)
└── zh-cn: (chưa có bản dịch)
```

### 🎯 **File Focus**
- Click CodeLens → Edit translation → **File auto-opens**
- **Cursor jumps to exact line** of the edited key
- **Nested key detection** in JSON structure

### 📁 **Multi-Folder Support**  
- **Avoid duplicate folders**: Parent/child relationship detection
- **Path resolution**: Auto-detect existing files vs create new
- **Context menu integration**: Right-click any folder to add

### 🔄 **Live Updates**
- **Real-time cache refresh** when JSON files change
- **Auto-reload CodeLens** after edits
- **Preserve workspace state** across VS Code sessions

## 🎯 Best Practices

### **Project Organization**
```
✅ Tốt:
project/
├── src/
│   └── components/
└── i18n/
    ├── en.json
    ├── ja.json  
    └── vi.json

✅ Rất tốt (Module-based):
project/
├── src/
└── i18n/
    ├── common/
    │   ├── en.json
    │   └── ja.json
    └── features/
        ├── auth/
        │   ├── en.json
        │   └── ja.json
        └── dashboard/
            ├── en.json
            └── ja.json
```

### **Key Naming Conventions**
```javascript
✅ Tốt:
t('user.profile.edit')
t('common.button.save')
t('error.validation.required')

❌ Tránh:
t('userprofileedit')         // Quá dài, khó đọc
t('btn_save')                // Viết tắt không rõ nghĩa
t('error_1')                 // Không mô tả
```

### **Performance Optimization**
```json
✅ Tốt: Chia nhỏ files theo feature
{
  "auth": { "login": "...", "logout": "..." },
  "profile": { "edit": "...", "save": "..." }
}

❌ Tránh: Một file JSON khổng lồ
{
  "key1": "...", "key2": "...", /* 1000+ keys */
}
```

---

## 📞 Support & Contributing

### **Issues & Bug Reports**
- 🐛 **GitHub Issues**: [Report bugs](https://github.com/ken863/codelens-for-i18n/issues)
- 💡 **Feature Requests**: Use GitHub Issues với label `enhancement`
- 📖 **Documentation**: Đóng góp cải thiện README

### **Contributing**
1. **Fork repository**
2. **Create feature branch**: `git checkout -b feature/amazing-feature`
3. **Make changes** và test thoroughly
4. **Commit**: `git commit -m 'Add amazing feature'`
5. **Push**: `git push origin feature/amazing-feature`
6. **Create Pull Request**

### **Development Community**
- 💬 **Discussions**: GitHub Discussions cho questions & ideas
- 📢 **Updates**: Watch repository để nhận notifications
- ⭐ **Star**: Nếu extension hữu ích, đừng quên star repo!

---

**Made with ❤️ for the developer community**  
*Happy coding with i18n! 🌐✨*