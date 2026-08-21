# 甜橙谷塔防

原生 HTML5 Canvas 塔防游戏，无第三方运行依赖。

## 隔离环境与启动

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 -m http.server 4174
```

浏览器访问 `http://127.0.0.1:4174`。

## 操作

- 拖动炮塔改变位置。
- 将两个同等级炮塔拖到一起即可合成升级。
- 炮塔会自动近距离攻击敌人和宝箱；击破宝箱后获得新的 1 级炮塔。
- 炮塔每达到 5 的倍数等级，可从荆棘、冰霜、黄金三条路线中选择进化。
