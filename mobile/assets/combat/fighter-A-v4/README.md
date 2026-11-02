# A 版高清动作与命中同步

使用内置 imagegen，参考用户选定的 A-anime.png，逐帧生成透明 PNG。保留脸型、长发、白蓝衣袍、护腕和剑。

运行素材：../fighter-attack-v4.webp，五个独立绘制姿态，单帧 1024×1024，无损 WebP；../fighter-idle-v4.webp 为相同待机帧。本目录保留五张高清生成原图。播放为待机、蓄势、接触、随挥、收势、回到待机，单轮 430ms。

命中帧在 42%（180.6ms），剑尖注册点为 (0.974, 0.373)。按目标受击点计算突进位移；帧图、位移、受击、特效与数字共用动画时钟。命中前血条保留上一值，命中时同步揭示已结算值，不改游戏结算与收益。最后一击保留原目标到接触完成，随后展示下一目标。

验证：三种屏幕尺寸、命中前隐藏数字与特效、命中时揭示血量、剑尖坐标误差小于2 CSS像素、致命一击切怪、返回待机与减少动态效果。

## 最终逐帧提示词

### 00-idle.png

Create exactly ONE isolated full-body GAME SPRITE of the exact character in reference A, not a sheet and not multiple characters. TRANSPARENT ALPHA BACKGROUND, absolutely no gray backdrop, no fog, no ground, no shadow. HIGH DEFINITION crisp clean anime wuxia illustration. Preserve A's exact youthful face, six-head-tall proportions, flowing white and blue layered robe, ornate black bracers, dark decorated sash, boots, long tied black hair and silver straight jian sword. Do not simplify design and do not make realistic 3D. Fixed right-facing three-quarter side camera. Character full height about 70% of square image, ample empty transparent margin on all sides; all hair, feet and entire sword remain well inside frame. Never crop sword tip. No magical light, no particles, no text, no UI. Pose: IDLE GUARD. Upright ready stance facing right, sword held down diagonally toward right, calm youthful face. Full feet planted.

### 01-windup.png

Create exactly ONE isolated full-body GAME SPRITE of the exact character in reference A, not a sheet and not multiple characters. TRANSPARENT ALPHA BACKGROUND, absolutely no gray backdrop, no fog, no ground, no shadow. HIGH DEFINITION crisp clean anime wuxia illustration. Preserve A's exact youthful face, six-head-tall proportions, flowing white and blue layered robe, ornate black bracers, dark decorated sash, boots, long tied black hair and silver straight jian sword. Do not simplify design and do not make realistic 3D. Fixed right-facing three-quarter side camera. Character full height about 70% of square image, ample empty transparent margin on all sides; all hair, feet and entire sword remain well inside frame. Never crop sword tip. No magical light, no particles, no text, no UI. Pose: WINDUP. Knees slightly bent, torso coils, sword raised above and behind head preparing to strike right. Full feet planted.

### 02-contact.png

Create exactly ONE isolated full-body GAME SPRITE of the exact character in reference A, not a sheet and not multiple characters. TRANSPARENT ALPHA BACKGROUND, absolutely no gray backdrop, no fog, no ground, no shadow. HIGH DEFINITION crisp clean anime wuxia illustration. Preserve A's exact youthful face, six-head-tall proportions, flowing white and blue layered robe, ornate black bracers, dark decorated sash, boots, long tied black hair and silver straight jian sword. Do not simplify design and do not make realistic 3D. Fixed right-facing three-quarter side camera. Character full height about 70% of square image, ample empty transparent margin on all sides; all hair, feet and entire sword remain well inside frame. Never crop sword tip. No magical light, no particles, no text, no UI. Pose: CONTACT. Deep forward lunge toward RIGHT, sword held straight HORIZONTALLY to the right, tip at 88% of image width, height 47% of image. This is the decisive sword strike touching the enemy. Keep full body AND full blade inside canvas.

### 03-follow.png

Create exactly ONE isolated full-body GAME SPRITE of the exact character in reference A, not a sheet and not multiple characters. TRANSPARENT ALPHA BACKGROUND, absolutely no gray backdrop, no fog, no ground, no shadow. HIGH DEFINITION crisp clean anime wuxia illustration. Preserve A's exact youthful face, six-head-tall proportions, flowing white and blue layered robe, ornate black bracers, dark decorated sash, boots, long tied black hair and silver straight jian sword. Do not simplify design and do not make realistic 3D. Fixed right-facing three-quarter side camera. Character full height about 70% of square image, ample empty transparent margin on all sides; all hair, feet and entire sword remain well inside frame. Never crop sword tip. No magical light, no particles, no text, no UI. Pose: FOLLOW THROUGH. Recovering from a rightward horizontal sword strike, torso rotates slightly, sword sweeps diagonally down-right; robe follows motion.

### 04-recover.png

Create exactly ONE isolated full-body GAME SPRITE of the exact character in reference A, not a sheet and not multiple characters. TRANSPARENT ALPHA BACKGROUND, absolutely no gray backdrop, no fog, no ground, no shadow. HIGH DEFINITION crisp clean anime wuxia illustration. Preserve A's exact youthful face, six-head-tall proportions, flowing white and blue layered robe, ornate black bracers, dark decorated sash, boots, long tied black hair and silver straight jian sword. Do not simplify design and do not make realistic 3D. Fixed right-facing three-quarter side camera. Character full height about 70% of square image, ample empty transparent margin on all sides; all hair, feet and entire sword remain well inside frame. Never crop sword tip. No magical light, no particles, no text, no UI. Pose: RECOVERY. Straightening torso and legs, sword returns toward down-right ready guard, silhouette close to idle.
