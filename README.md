# KvK 情报台

面向《万国觉醒》的 ROKSTATS KvK 表现采集界面。支持输入多个王国编号、单国切换、汇总和 JSON 导出。

## 启动

需要 Node.js 20 或更新版本。在此目录运行：

```sh
node server.js
```

浏览器打开 `http://localhost:3000`。

## 数据来源与限制

服务端调用 ROKSTATS 的 `/api/kingdoms/seed-ranking/kvk-performance` JSON 接口，并按王国编号请求数据。每个王国从 `recentKvks` 中选取 `lkCode` 最大的记录作为最新 KvK，单国详情和多国汇总均使用该记录中的实际统计值。没有 `recentKvks` 时，采集记录会显示接口返回的原因。


