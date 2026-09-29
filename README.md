# ClipNote 📎

个人常用的 **Agent 提示词（Prompt）记事本**。纯 Web 技术（HTML / CSS / JavaScript）实现，无需安装任何依赖，数据保存在你自己的浏览器里。

![技术栈](https://img.shields.io/badge/%E6%8A%80%E6%9C%AF%E6%A0%88-HTML%20%2B%20CSS%20%2B%20JS-blue)

## 快速开始

**方式一：直接打开（推荐）**

双击 `index.html`，用 Chrome / Edge 等现代浏览器打开即可使用。

**方式二：本地服务器（可选）**

```bash
# 在项目目录执行任意一种：
python -m http.server 8080
npx serve .
```

然后访问 `http://localhost:8080`。

> 提示：浏览器会按"域名 + 协议"隔离 localStorage。直接双击打开（file://）和通过 localhost 访问是两份独立的存储，建议固定用其中一种方式。

## 功能

| 功能 | 说明 |
| --- | --- |
| 新建 / 编辑 / 删除 | 弹窗表单，支持标题、标签、完整 Prompt 内容 |
| 一键复制 | 点击「复制」按钮复制全文，自动记录使用次数和最近使用时间 |
| 搜索 | 同时搜索标题、内容、标签（快捷键 `Ctrl+K`） |
| 标签筛选 | 侧边栏自动汇总所有标签及数量，点击即可筛选 |
| 收藏置顶 | 星标收藏，收藏的卡片始终排在最前 |
| 排序 | 最近编辑 / 最近创建 / 最近使用 / 使用次数 |
| 深色模式 | 🌙 按钮切换，自动跟随系统偏好并记忆选择 |
| 云端存档 | ☁️ 按钮打开面板：恢复（免配置）把 GitHub 仓库里的 `data/prompts.json` 合并到本机；备份（需 Token）把本机数据上传到仓库 |
| 导入 / 导出 | 导出 JSON 备份文件；导入时与现有数据按 id 合并（同 id 覆盖） |
| 快捷键 | `Ctrl+K` 搜索 · `Ctrl+N` 新建 · `Ctrl+Enter` 保存弹窗 · `Esc` 关闭弹窗 |
| 使用统计 | 底部显示条数、标签数、总字数；每张卡片显示复制次数 |

## 数据存储与备份

- 所有数据保存在浏览器的 `localStorage` 中（键名 `clipnote.prompts.v1`），**不会上传到任何服务器**。
- 清除浏览器缓存/网站数据会丢数据，重要内容请定期用「导出」按钮或「☁️ 云端」备份。

## 云端存档（多设备同步）

数据按浏览器隔离：换设备、换浏览器后数据是空的。用「☁️ 云端」面板解决：

1. **从云端恢复（免配置）**：点击后自动从多个源（jsDelivr CDN / GitHub Pages / raw）拉取仓库里的 `data/prompts.json`，按 id 合并到本机，不会删除本地已有条目。
2. **备份到云端（需 Token）**：把当前全部数据上传覆盖 `data/prompts.json`，Pages 约 1 分钟后自动生效。

**Token 申请步骤（一次即可）**：

1. 打开 GitHub → 右上角头像 → `Settings` → 最底部 `Developer settings`
2. `Fine-grained tokens` → `Generate new token`
3. Repository access 选 **Only select repositories** → 选 `ClipNote`
4. Permissions 里给 **Contents: Read and write**，其余保持 No access
5. 生成后复制，粘贴进「☁️ 云端」面板保存。Token 只存在本机浏览器，建议设有效期并定期轮换

> ⚠️ 仓库是公开的，`data/prompts.json` 里存的就是你的提示词内容，**任何人可见**。敏感提示词请只存本地，或转用私有方案。

## 项目结构

```
ClipNote/
├── index.html          # 页面结构
├── css/style.css       # 样式（含深色模式主题变量）
├── js/app.js           # 全部逻辑（无任何第三方依赖）
├── data/prompts.json   # 云端存档（由「备份到云端」自动更新）
└── README.md
```

## 自定义

- **修改数据保留条数/字段**：编辑 `js/app.js` 顶部的 `STORE_KEY` 逻辑。
- **换主题色**：修改 `css/style.css` 中 `:root` 的 `--primary` 变量（深色模式在 `html[data-theme="dark"]` 中单独设置）。
- **不想要示例数据**：删除 `js/app.js` 中的 `seed()` 函数调用即可。
