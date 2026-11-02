# 攻击序列帧

使用内置 imagegen 工具生成，透明底；以现有 fighter.webp / boar.webp 为造型参考。未使用 CLI 或外部图像 API。

运行素材：
- `fighter-attack-v2.webp`：8 帧，单帧 320×320，横向排列。
- `boar-attack-v1.webp`：8 帧，单帧 320×320，横向排列。
- `attack-sprites.json`：尺寸、帧数、播放时长与文件大小。

每次攻击播放 430 毫秒，完整姿态从待机、蓄势、出击到收势；最后回到第 0 帧。序列帧和角色位移同步播放，命中特效约在 190 毫秒触发。减少动态效果时固定待机姿态。加载失败保留原始角色图与位移动作。当前只为修士和野猪提供绘制序列帧，其余妖兽沿用已有动作。

`tools/pack-combat-sprites.cjs` 将原始 4×2 图集打包为 WebP 横条。修士第二排第一帧向右保留额外空间容纳剑尖，相邻帧切片避开该剑尖。原始图、第一版素材均保留，运行使用 v2 修士素材。

## 最终生成提示词：修士

Production transparent sprite sheet. EXACT FOUR COLUMNS AND TWO ROWS, eight equal square cells. Same white/blue robed Chinese swordsman reference identity facing RIGHT. CRITICAL: every figure must be SMALL, only 60% of cell height, with AT LEAST 20% TRANSPARENT PADDING inside EACH cell. Every sword tip must stay inside its own cell. Use a SHORT one-handed Chinese sword, not long reach; absolutely no overlap between neighboring frames. Two whole rows separated by wide transparent empty gutter. Draw 8 actual poses of one attack: neutral guard, crouch windup, sword raised, begin short downward slash, full short slash, follow-through, recover, neutral guard. The torso, arms, legs, robe must change pose. Keep exactly same character scale and same FOOT BASELINE within every cell, all eight full bodies and swords fully visible. No text, no labels, no background, no gridlines, no cast shadows, no effects. Fine illustrated semi-realistic wuxia look matching reference, black hair, white and blue robe, black bracers, black boots. Avoid filling cells. Small well separated sprites for reliable automatic grid slicing. Canvas2:1 landscape.

## 最终生成提示词：野猪

Production game animation sprite sheet, exact 4 columns x 2 rows, 8 equal square cells, transparent background. Same dark gray muscular tusked wild boar as reference, facing LEFT throughout, semi realistic detailed painted game style. One full boar per cell with generous transparent margin at least 10% all sides. Entire animal including tusks and tail fits INSIDE its cell; NO overlapping neighbors, no labels, no grid lines, no ground, no shadows, no effects. Constant size, constant camera and baseline. 8 successive poses for a boar charge attack: 1 standing ready; 2 crouch head lowers legs bend; 3 push off hindlegs; 4 short leap forward, forelegs tucked; 5 head lowered tusk thrust impact; 6 forelegs landing body compressed; 7 raising head and recovering legs; 8 standing ready matching first frame. Each pose really changes leg articulation, back arch, neck and head pitch. Keep same identity and all four legs, two tusks, dark fur silver mane and anatomy in all frames. Uniform registration, centered within each of 8 equal cells. Sheet is 2:1 landscape.

验证：turn-ui-check.cjs 检查三种尺寸、两张图集解码、攻击中帧位置改变、播放结束回待机、特效清理与减少动态效果。combat-presentation-tests.cjs 检查事件去重、致命攻击与换怪保护。


## 2026-10-17 简约武器版 v3（当前使用）

使用内置 imagegen 编辑现有八帧图集。运行素材为 `fighter-attack-v3.webp`、`fighter-idle-v3.webp`，原始生成图为 `fighter-attack-source-v3.png`。保留此前头身比与白蓝配色，减少发丝、衣褶、飘带和腰部饰物；剑身加宽，银蓝剑刃与深色剑柄形成清楚对比。打坐图没有调整。旧版保留。

最终提示词：

Edit this exact eight-frame game sprite sheet. Keep exactly FOUR COLUMNS by TWO ROWS of EQUAL SQUARE cells, all eight original attack poses, facing RIGHT, original youthful approximately six-head-tall proportions and white/blue Chinese cultivator identity. Make the CHARACTER MUCH SIMPLER for legibility at 150 pixels: plain white short outer robe with TWO large blue panels, clean dark belt without ornaments, plain black boots and bracers, only 3 to 5 broad cloth folds per pose, compact black ponytail in two or three solid locks, no wispy hairs, no long flowing ribbons, no embroidery, no metallic costume ornament. Reduce robe width so arms and legs read clearly. Clean restrained semi-stylized painted shading with large light/shadow shapes, not photo detail, not a tiny chibi. Make the SWORD the most readable feature: straight silver-blue Chinese jian with a distinctly WIDER blade about twice original thickness, a strong sharp bright edge, clear dark navy hilt and simple T-shaped guard, blade length about 45% of standing character height. Keep exact same sword geometry in every pose. No glowing aura or baked slash effects. Hold the sword separated from robe silhouette in idle and follow-through. Each character AND ENTIRE sword must fit inside its own cell with at least 10% TRANSPARENT MARGIN on every side; never cross a cell border. Small centered full-body sprites occupying about 65% of cell height, uniform scale and foot baseline, eight sequential poses: guard, crouch windup, raised sword, slash beginning, extended slash, follow-through, recovery, guard. Transparent background, no ground, no shadows, no text or gridlines, no additional weapons. Aim for simple confident warrior silhouette and clearly visible broad sword at mobile game scale.
