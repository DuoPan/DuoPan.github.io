# Powerball History Dashboard

一个用于展示澳洲 Powerball 历史数据与结构分析的前端小站。当前版本包含表格视图、热号/遗漏/趋势视图，以及图表仪表盘，支持中英双语切换。

## Features
- 历史数据：按期展示完整号码与 PB
- 七球区间：按小/中/大区间着色
- 分布热力：按频次高亮极热/极冷号码
- 热号：主球与 PB 频次排行（支持排序）
- 遗漏：号码距离上次出现的期数（支持排序）
- 趋势：近 10/20/50 期频次变化
- 图表：奇偶比例、大小比例、PB 奇偶与和值趋势
- 统计：单期统计指标
- PB 对比：PB 与主号重号提示

## Data
- 数据在 `db.js` 中维护，按最新在前
- 日期格式：`DD/MM/YYYY`
- 行结构：`[日期, 主球1..7, PB]`

## Run
这是一个纯静态站点，直接用浏览器打开 `index.html` 即可。

如果你使用 VS Code：
- 安装 Live Server 插件
- 右键 `index.html` → “Open with Live Server”

## Project Structure
- `index.html` 页面入口
- `css/style.css` 样式
- `db.js` 历史数据
- `*.js` 各功能视图模块

## Notes
- 站点不做任何预测，仅提供可视化参考
- 过滤功能已隐藏（可在代码中恢复）

## Roadmap
- 号码组合共现矩阵
- 可配置的冷热阈值
- 统计区间自定义
