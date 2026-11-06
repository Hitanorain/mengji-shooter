# 萌鸡突围 Chick Commando

俯视角 3D 射击撤离小游戏（three.js）。小鸡潜入黄鼠狼占领的林间营地，依次占领 3 个撤离点，守住每一波围攻，最后坐蛋壳飞艇离开。

在线玩：https://hitanorain.github.io/mengji-shooter/

## 本地运行

- Windows：双击 `start.bat`，会打开 http://localhost:8767/
- 其他系统：在仓库根目录起一个静态服务器（比如 `python3 -m http.server 8767`），再打开 http://localhost:8767/
- three.js 从 jsDelivr 加载，第一次打开需要联网。

## 文件

- `index.html`：入口和界面样式
- `shooter/`：游戏代码（引擎、地图、模型、升级、界面、音效）
- `DESIGN.md`：玩法设计文档

GitHub Pages 直接发布 `main` 分支的根目录，推送到 `main` 就会更新线上版本。

最早是从《逃离萌鸡岛》（私有仓库 `mengji-island`，`design/shooter-mode` 分支）拆出来的，提交历史保留了下来。
