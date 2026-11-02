# 统一修士头身比 · 2026-10-17

以当前 fighter-attack-v2.webp 的略偏 Q、约六头身视觉比例为参考。盘腿姿态自然比站姿矮，统一的是头部、肩宽、上身的解剖比例，而非直接拉伸两张图片到相同宽高。

- 打坐场景：`cultivation-moon-v2.png`，使用内置 imagegen 编辑原场景，参考现有战斗帧图，统一人物身份、服装与比例。
- 战斗静态备用图：`combat/fighter-idle-v2.webp`，由现有八帧序列的首帧打包导出，与播放中的待机帧完全相同。
- 修炼场景改为等比 cover 显示，超出屏幕的环境边缘允许裁切，取消原先 100% 100% 的非等比拉伸和重复背景。
- 原始素材保留；野猪素材及战斗结算没有调整。

已验证修炼与战斗的 375×667、390×844、750×1334 布局、资源解码、帧动画和减少动态效果。

## 内置 imagegen 最终提示词

Edit IMAGE 1 (moonlit meditation scene). IMAGE 2 is the exact canonical character proportion and costume reference, a standing/attacking sprite sheet. Unify the seated swordsman's anatomical head-to-body ratio to the slightly stylized youthful approximately SIX HEADS TALL standing proportions seen in image2. This is not a chibi child. Compared with image1, modestly enlarge the actual skull/face about 15-20%, slightly shorten the upper torso about 8-10%, give the same youthful face and white-blue costume as sprite reference. Preserve plausible cross-legged seated anatomy; sitting height is naturally shorter than standing, do not make a standing figure. Keep the same meditating closed eyes, black tied hair, hands on knees, full crossed legs, center position, rock platform, lake, large moon, mountains, mist, exact dark blue palette and painterly rendering. Change only the person's proportions and reference-matching costume details. Retain entire environment and composition as closely as possible. No UI, no words, no additional characters or weapons, no decorative effects. Portrait 3:4 composition matching input scene. The result must visibly be the same young cultivator as image2 in a meditation pose, not a long-bodied adult of a different style.
