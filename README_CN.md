# 代码库索引器

一个强大的 TypeScript 库，用于使用向量嵌入对代码仓库进行索引和搜索。基于 Qdrant 向量数据库和 OpenAI 嵌入构建。

## 特性

- 🔍 **语义代码搜索**：使用自然语言查询查找代码
- 📁 **目录索引**：递归索引整个代码库
- 👀 **文件监控**：文件更改时实时更新
- 🌐 **REST API**：用于远程访问的 HTTP 服务器
- 🎯 **多语言支持**：JavaScript、TypeScript、Python 等
- ⚡ **高性能**：并发处理和批量操作
- 🔧 **可配置**：灵活的配置选项

## 安装

```bash
npm install codebase-indexer
```

## 快速开始

### 1. 前置条件

- **Qdrant 向量数据库**：安装并运行 Qdrant
  ```bash
  docker run -p 6333:6333 qdrant/qdrant
  ```

- **OpenAI API 密钥**：从 [OpenAI](https://platform.openai.com/) 获取您的 API 密钥
  ```bash
  export OPENAI_API_KEY="your-api-key-here"
  ```

### 2. 基本用法

```typescript
import { CodebaseIndexer } from 'codebase-indexer';

const indexer = new CodebaseIndexer({
  vectorStore: {
    type: 'qdrant',
    url: 'http://localhost:6333',
    collectionName: 'my_codebase'
  },
  embedder: {
    type: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    model: 'text-embedding-ada-002',
    baseURL: process.env.OPENAI_BASE_URL // 可选：自定义 API 网址
  }
});

// 索引目录
await indexer.indexDirectory('./src');

// 搜索代码
const results = await indexer.search('身份验证函数');
console.log(results);
```

### 3. 命令行用法

```bash
# 索引目录
npx codebase-indexer index ./src --collection my_codebase

# 搜索索引
npx codebase-indexer search "tree-sitter" --max-results 5 --collection my_codebase

# 监控文件更改
npx codebase-indexer watch ./src --collection my_codebase

# 清空索引
npx codebase-indexer clear --collection my_codebase
```

### 4. API 服务器

启动 REST API 服务器：

```bash
npx codebase-indexer-server --port 3000 --collection my_codebase
```

使用 API：

```bash
# 索引目录
curl -X POST http://localhost:3000/index \
  -H "Content-Type: application/json" \
  -d '{"directoryPath": "./src"}'

# 搜索
curl -X POST http://localhost:3000/search \
  -H "Content-Type: application/json" \
  -d '{"query": "身份验证函数", "options": {"maxResults": 5}}'
```

## 配置

创建 `config.js` 文件：

```javascript
module.exports = {
  vectorStore: {
    type: 'qdrant',
    url: process.env.QDRANT_URL || 'http://localhost:6333',
    collectionName: process.env.COLLECTION_NAME || 'codebase'
  },
  embedder: {
    type: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    model: 'text-embedding-ada-002',
    batchSize: 100,
    baseURL: process.env.OPENAI_BASE_URL // 可选：自定义 OpenAI API 网址
  },
  parser: {
    excludePatterns: [
      'node_modules/**',
      '.git/**',
      'dist/**',
      '*.log'
    ],
    maxBlockChars: 1000,
    minBlockChars: 50
  },
  search: {
    maxResults: 20,
    minScore: 0.7
  },
  watcher: {
    excludePatterns: [
      'node_modules/**',
      '.git/**'
    ],
    debounceMs: 1000
  }
};
```

## 工作原理

了解每个命令的内部工作机制有助于您更有效地使用代码库索引器。

### 索引命令 (`index`)

索引过程将您的代码库转换为可搜索的向量嵌入：

1. **目录扫描**：递归扫描目标目录，根据以下条件过滤文件：
   - 文件扩展名（支持 20+ 种编程语言）
   - 排除模式（node_modules、.git 等）
   - 文件大小限制

2. **代码解析**：对每个文件：
   - 使用 Tree-sitter 解析器创建抽象语法树（AST）
   - 提取有意义的代码块（函数、类、方法）
   - 按大小过滤代码块（最小/最大字符限制）
   - 保留上下文和元数据

3. **嵌入生成**：
   - 批量将代码块发送到 OpenAI 嵌入 API
   - 为每个代码块生成 1536 维向量
   - 自动处理速率限制和重试

4. **向量存储**：
   - 将嵌入存储在 Qdrant 向量数据库中
   - 为每个代码块创建唯一 ID
   - 维护元数据（文件路径、行号、块类型）

**流程图**：
```
目录 → 文件过滤 → AST 解析 → 代码块 → 嵌入 → Qdrant
```

### 搜索命令 (`search`)

搜索过程使用向量相似性查找语义相似的代码：

1. **查询处理**：
   - 将自然语言查询转换为嵌入
   - 使用与索引相同的 OpenAI 模型以确保一致性

2. **向量搜索**：
   - 在 Qdrant 中执行余弦相似性搜索
   - 应用分数阈值过滤
   - 根据 maxResults 参数限制结果

3. **结果增强**：
   - 从元数据中检索原始代码块
   - 生成带上下文的代码片段
   - 按相似性分数排序结果

4. **响应格式化**：
   - 返回包含文件路径、分数和代码的结构化结果
   - 包含行号和块类型

**流程图**：
```
查询 → 嵌入 → 向量搜索 → 分数过滤 → 代码检索 → 结果
```

### 监控命令 (`watch`)

文件监控系统提供实时索引更新：

1. **文件系统监控**：
   - 使用 Node.js `fs.watch` 进行高效的文件系统事件监控
   - 监控文件创建、修改和删除
   - 应用与索引相同的排除模式

2. **事件防抖**：
   - 对快速文件更改进行防抖处理（默认 1000ms）
   - 防止批量操作期间的过度重新索引
   - 批处理多个更改以提高效率

3. **增量更新**：
   - **文件修改**：重新解析并重新索引文件
   - **文件创建**：将新文件添加到索引
   - **文件删除**：从 Qdrant 中删除所有相关向量

4. **错误处理**：
   - 优雅地处理文件访问错误
   - 即使个别文件失败也继续监控
   - 记录错误以便调试

**流程图**：
```
文件更改 → 防抖 → 事件类型 → 解析/索引/删除 → 更新 Qdrant
```

### 清空命令 (`clear`)

清空过程删除所有索引数据：

1. **集合识别**：
   - 使用配置的 URL 连接到 Qdrant
   - 按名称识别目标集合

2. **数据删除**：
   - 删除整个 Qdrant 集合
   - 删除所有向量和相关元数据
   - 释放存储空间

3. **清理**：
   - 如果索引器正在运行，重置内部状态
   - 停止任何活动的文件监控
   - 为新的索引做准备

**流程图**：
```
清空命令 → 连接 Qdrant → 删除集合 → 重置状态
```

### 性能考虑

- **批处理**：嵌入以可配置的批次生成（默认 100）
- **并发操作**：可以同时处理多个文件
- **内存管理**：大文件分块处理以防止内存问题
- **速率限制**：自动处理 OpenAI API 速率限制
- **缓存**：缓存嵌入以避免重新处理未更改的代码

## API 参考

### CodebaseIndexer

#### 构造函数

```typescript
new CodebaseIndexer(config?: Partial<CodeIndexConfig>)
```

#### 方法

- `indexDirectory(directoryPath: string, onProgress?: ProgressCallback): Promise<void>`
- `search(query: string, options?: SearchOptions): Promise<VectorStoreSearchResult[]>`
- `startWatching(directoryPath: string): void`
- `stopWatching(): void`
- `clearIndex(): Promise<void>`
- `getState(): IndexerState`

### 搜索选项

```typescript
interface SearchOptions {
  maxResults?: number;        // 最大结果数
  minScore?: number;          // 最小分数阈值
  includeSnippet?: boolean;   // 是否包含代码片段
}
```

### 搜索结果

```typescript
interface VectorStoreSearchResult {
  id: string;           // 唯一标识符
  score: number;        // 相似度分数
  filePath: string;     // 文件路径
  codeBlock: CodeBlock; // 代码块
  snippet?: string;     // 代码片段
}
```

## REST API 端点

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/status` | 获取索引器状态 |
| POST | `/index` | 索引目录 |
| POST | `/search` | 搜索索引 |
| POST | `/watch` | 开始监控目录 |
| DELETE | `/watch` | 停止监控 |
| DELETE | `/clear` | 清空索引 |

## 支持的编程语言

- JavaScript (.js, .jsx)
- TypeScript (.ts, .tsx)
- Python (.py)
- Java (.java)
- C/C++ (.c, .cpp, .h, .hpp)
- C# (.cs)
- Go (.go)
- Rust (.rs)
- PHP (.php)
- Ruby (.rb)
- 以及更多...

## 示例

查看 `examples/` 目录获取完整的使用示例：

- `basic-usage.js` - 基本库用法
- `api-usage.js` - REST API 用法

## 开发

```bash
# 安装依赖
npm install

# 构建项目
npm run build

# 运行测试
npm test

# 启动开发服务器
npm run start:server

# 运行 CLI
npm run start:cli -- --help
```

## 贡献

1. Fork 仓库
2. 创建功能分支
3. 进行更改
4. 添加测试
5. 提交 Pull Request

## 系统要求

- Node.js 18+
- Qdrant 向量数据库（本地或远程）
- OpenAI API 密钥（用于嵌入）

## 许可证

MIT

## 常见问题

### Q: 如何选择合适的嵌入模型？
A: 推荐使用 `text-embedding-ada-002`，它在代码理解方面表现良好，成本也相对较低。

### Q: 如何使用自定义 OpenAI API 网址？
A: 您可以通过配置 `baseURL` 参数来使用自定义的 OpenAI API 网址，这对于使用代理服务器或第三方兼容服务很有用：

```javascript
const indexer = new CodebaseIndexer({
  embedder: {
    type: 'openai',
    apiKey: 'your-api-key',
    model: 'text-embedding-ada-002',
    baseURL: 'https://your-custom-api-endpoint.com/v1' // 自定义 API 网址
  }
});
```

或者通过环境变量设置：
```bash
export OPENAI_BASE_URL="https://your-custom-api-endpoint.com/v1"
```

### Q: 索引大型代码库需要多长时间？
A: 这取决于代码库的大小和复杂性。通常每 1000 个文件需要几分钟时间。

### Q: 可以同时索引多个代码库吗？
A: 可以，通过使用不同的 `collectionName` 来区分不同的代码库。

### Q: 如何提高搜索准确性？
A: 可以调整 `minScore` 参数，或者使用更具体的搜索查询。

## 故障排除

### 连接 Qdrant 失败
确保 Qdrant 服务正在运行，并且 URL 配置正确：
```bash
docker ps | grep qdrant
```

### OpenAI API 错误
检查 API 密钥是否正确设置：
```bash
echo $OPENAI_API_KEY
```

### 内存使用过高
对于大型代码库，可以调整 `batchSize` 参数来减少内存使用：
```javascript
embedder: {
  batchSize: 50  // 减少批处理大小
}
```