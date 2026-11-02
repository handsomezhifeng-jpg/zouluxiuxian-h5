# 暖绢墨金 UI 组件

主要来源为用户选定的 `source/B-silk-ink-clean-v3.png`，人物保留原图。用户于 2026-10-18 进一步允许适当生成组件，本次仅新增无人物延展背景与透明卷轴图标。

## 目录

- `source/`：获选设计原图。
- `assets/`：场景、头像、面板、按钮、进度条、卷轴和七个导航图标。
- `assets/manifest.json`：原图像素坐标、切片尺寸、去除固定文字的方法。
- `components/`：玩家信息、主线、人物场景、修炼操作和底部导航组件。
- `silk-ui.js`：组合入口，保留原法门弹层和突破操作。
- `silk-ui.css`：浅色主题、组件排版和响应式尺寸。
- `exact-layout.css`：按原图 941×1672 坐标对齐人物、完整面板及控件。
- `natural-scene.css`：连续云雾背景、原人物柔边融合、无外框的修炼操作区。
- `extract-components.py`：用 Pillow 从原图确定性拆图，可重复执行。
- `extract-exact-panels.py`：在基础切片后导出完整头栏、任务栏、修炼面板、导航字图切片；使用确定性的邻域像素修补移除动态示例文字，不调用图像生成服务。
- `extraction-sheet.png`：素材检查总览，不参与游戏渲染。

## 素材处理

人物场景、头像、卷轴、装饰和导航图标直接裁切自原图。当前主界面使用完整面板，避免缩小或重组四角造成比例失真；九宫格基础素材保留作备用。动态姓名、实力、寿元、境界、任务、修炼信息和按钮的示例字形通过确定性的局部像素修补移除，原有背景纹理与边缘保持原位，再叠加真实文字控件。导航图标与静态标题使用未改动的原图切片。

固定示例文字不会覆盖到运行界面。姓名、实力、寿元、境界、任务、修炼耗时、层数、进度及按钮状态均来自现有游戏快照。

## 接入约定

`index.html` 在原 `moon-ui.js` 和 `portrait.js` 后加载组件，组合器通过 `MobileMoonUI.render` 接入既有渲染入口。所有 `data-action`、`data-route`、法门选择、突破、进度及实力滚动标记继续沿用，组件不计算奖励或改写存档。

加载画面仍使用已确认的独立资源。底部导航及取名弹框随浅色主题适配；原有存档和玩法保持连接。

## 验证

`../../qa/silk-ui/integration.json` 记录实际游戏的修炼/暂停、法门弹层、360/375/430/750 宽度排版和资源加载检查。

`../../qa/silk-ui/exact-integration.json` 为完整面板校准后的验证；`reference-vs-game.png` 为原图与实际游戏的并排检查图。真实数值与原图中的示例数值不同。

## 自然填充修订

`cultivation-landscape-plate.png` 是不含人物的背景底图，以 cover 覆盖场景及修炼区下方；原人物插画以原始宽高比呈现，并在图片实际边缘淡出，不再暴露矩形拼接边。修炼区取消整块边框背景，改用轻薄的渐变承托文字。透明卷轴保留图标主体，不带截图底板。两项生成资产记录在 `assets/generated-assets.json`，原拆图脚本仍可独立重跑，不会删除这些资产。

## Shared light theme
Silk-system.css extends the approved ivory, sage and gold styling to secondary pages, realm, combat, settings, item details, naming and confirmation overlays. It reuses the existing gold button, avatar, progress fill and landscape assets. All changes are scoped to body[data-ui-theme=silk]; gameplay actions and save data are unchanged. Live route screenshots and isolated combat fixtures are in qa/silk-ui/system-*.png.


## Realm equipment atlas
A single 1254x1254 RGBA PNG holds 64 icons on an 8x8 grid. Sprite coordinates use percentages to support fractional cell dimensions without splitting images. equipment-atlas.js embeds the catalog to avoid an extra runtime JSON request; assets/equipment/catalog.json is the authoring manifest. Browser inspection of all 64 icons confirmed one atlas request. realmFor selects the current major realm; canCarry permits current and lower tiers. Names and visuals represent carryable appearances, not granted inventory or added combat stats. Full name table: design/equipment-icons/REALM-EQUIPMENT.md. Preview: /ui/previews/equipment-icons/realms.html.


## Owned equipment and drops
Equipment-inventory.js now owns slot-scoped equipment records in runtime.storage under mobile-equipment-v1:<slot>. Each native monster-combat session rolls once at its start: 15% normally, 35% for adventure bosses. 80% current major realm / 20% previous realm; four equipment types are equally likely. Repeated items stack by catalogue ID. No item is auto-equipped. The character slots open equipment-bag.js for filtering, equipping, replacing or removing items. Realm gates are checked again in the mutation handler. UI and native battle/thunder loops share additive equipment bonuses, and health is projected using the existing health ratio. Storage writes finish before equipment is published. Full restart flushes outstanding equipment writes before clearing storage. Equipment survives ordinary reloads and is isolated per native save slot.
Validation: analysis/equipment-inventory-tests.cjs, analysis/turn-combat-tests.cjs, qa/silk-ui/check-equipment-live.cjs. Live isolated test confirms equip attack 60→68 and persistence after reload.

