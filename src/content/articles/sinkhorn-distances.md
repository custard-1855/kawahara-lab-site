---
title: "Sinkhorn Distances:双対性で最適輸送を速く解く"
date: 2026-07-10
category: column
tags: ["最適輸送", "双対性", "Sinkhorn"]
themes: []
author: takemoto
excerpt: "最適輸送は分布の形まで考慮して比べられる道具ですが、そのまま解くと計算が重いのが難点です。双対性とエントロピー正則化を使い、行列とベクトルの掛け算の繰り返しだけで近似的に解く方法を紹介します。"
---

## はじめに

機械学習では、予測した分布と正解の分布がどれだけ離れているかを測りたい場面がよくあります。最適輸送は、分布の「形」まで考慮して比べられる強力な道具ですが、そのまま解くと計算が重いのが難点でした。

この記事では、Cuturi(2013)の Sinkhorn Distances を題材に、**双対性**と**エントロピー正則化**を使うと、最適輸送が行列とベクトルの掛け算の繰り返しだけで近似的に解けることを紹介します。

## 小麦をパン屋に運ぶ

工場 $i$ には小麦が $a_i$ だけあり、パン屋 $j$ は小麦を $b_j$ だけ必要としています。工場 $i$ からパン屋 $j$ へ1単位運ぶコストは $C_{ij}$ です。小麦は途中で消えたり増えたりせず、総量は1に正規化しておきます。

このとき、運ぶ量 $P_{ij}$ をどう決めれば総コストが最小になるか、というのが最適輸送問題です。

$$
\begin{aligned}
\min_{P}\quad & \sum_{i,j} C_{ij} P_{ij} \\
\text{s.t.}\quad & P_{ij} \ge 0,\quad \sum_{j} P_{ij} = a_i,\quad \sum_{i} P_{ij} = b_j
\end{aligned}
$$

目的関数も制約も1次式なので、これは線形計画問題です。たとえば工場が2つ、パン屋が2つで、$a = (0.5, 0.5)$、$b = (0.3, 0.7)$、隣どうし(工場1とパン屋1、工場2とパン屋2)のコストが0、たすき掛けのコストが1とします。最適な計画は、工場1からパン屋1へ0.3、パン屋2へ0.2、工場2からパン屋2へ0.5を運ぶもので、総コストは0.2です。

## 見方を変える:双対問題

線形計画問題には、対になる**双対問題**があります。ここでは、輸送を請け負う業者の立場で考えてみます。業者は工場 $i$ から1単位あたり $f_i$ の集荷料、パン屋 $j$ から $g_j$ の配送料を受け取ります。

ただし料金の合計が自分で運ぶコスト $C_{ij}$ を超えると、工場とパン屋は業者に頼まなくなります。この条件のもとで、業者は売上を最大にしようとします。

$$
\begin{aligned}
\max_{f, g}\quad & \sum_{i} a_i f_i + \sum_{j} b_j g_j \\
\text{s.t.}\quad & f_i + g_j \le C_{ij}
\end{aligned}
$$

制約を満たす $P$ と $f, g$ なら、いつでも次の不等式が成り立ちます(弱双対定理)。

$$
\sum_{i,j} C_{ij} P_{ij} \;\ge\; \sum_{i,j} (f_i + g_j) P_{ij} \;=\; \sum_{i} a_i f_i + \sum_{j} b_j g_j
$$

主問題は上から、双対問題は下から最適値に近づき、最適解では両者が一致します(強双対定理)。双対問題の変数は $n + m$ 個で、主問題の $nm$ 個よりずっと少ないのがポイントです。

## エントロピーで滑らかにする

制約を満たす $P$ の集合は**輸送多面体**と呼ばれます。線形計画の最適解はその頂点に現れるため、$a$ や $C$ を少し変えただけで解が別の頂点へ飛ぶことがあり、微分を使った最適化と相性がよくありません。

そこで Sinkhorn Distances では、目的関数にエントロピー $h(P) = -\sum_{i,j} P_{ij} \log P_{ij}$ の項を加えます。

$$
\min_{P}\quad \sum_{i,j} C_{ij} P_{ij} + \varepsilon \sum_{i,j} P_{ij} \log P_{ij}
$$

エントロピーは輸送量が均等に散らばるほど大きくなるので、この項は解を多面体の内側へ引き込みます。目的関数は狭義凸で滑らかになり、解はただ一つに決まります。$\varepsilon$ を小さくするほど、元の問題の解に近づきます。

<figure class="figure">
<div class="figure-body">
<svg viewBox="0 0 560 150" width="100%" role="img" aria-label="先の例の輸送多面体は線分になる。左端が P11=0、右端が P11=0.3。元の問題の最適解は右端の頂点、ε=0.5 の解は P11=0.288 で少し内側にある">
<line x1="60" y1="70" x2="500" y2="70" style="stroke: var(--color-navy)" stroke-width="1.5" />
<circle cx="60" cy="70" r="5" style="fill: var(--color-navy)" />
<circle cx="500" cy="70" r="5" style="fill: var(--color-navy)" />
<circle cx="500" cy="70" r="11" fill="none" style="stroke: var(--color-navy)" stroke-width="1.2" />
<circle cx="482" cy="70" r="5" style="fill: var(--color-link)" />
<text x="60" y="106" text-anchor="middle" font-size="12" style="font-family: var(--font-mono); fill: var(--color-text-sub)">P11 = 0</text>
<text x="500" y="106" text-anchor="middle" font-size="12" style="font-family: var(--font-mono); fill: var(--color-text-sub)">P11 = 0.3</text>
<text x="500" y="40" text-anchor="middle" font-size="13" style="font-family: var(--font-sans); fill: var(--color-text)">元の問題の解(頂点)</text>
<text x="420" y="134" text-anchor="middle" font-size="13" style="font-family: var(--font-sans); fill: var(--color-link)">ε = 0.5 の解(P11 = 0.288)</text>
<line x1="482" y1="78" x2="460" y2="118" style="stroke: var(--color-link)" stroke-width="1" />
</svg>
</div>
<figcaption>図1 先の例では、輸送多面体は1本の線分になる(P<sub>11</sub> を決めると残りが決まるため)。正則化した解は頂点から少し内側に入る。</figcaption>
</figure>

## 解の形を求める

供給と需要の制約に、ラグランジュ乗数として先ほどの $f, g$ を割り当てます。

$$
L = \sum_{i,j} C_{ij} P_{ij} + \varepsilon \sum_{i,j} P_{ij} \log P_{ij}
+ \sum_{i} f_i \Big(a_i - \sum_{j} P_{ij}\Big) + \sum_{j} g_j \Big(b_j - \sum_{i} P_{ij}\Big)
$$

$P_{ij}$ で偏微分して0とおくと、$C_{ij} + \varepsilon(\log P_{ij} + 1) - f_i - g_j = 0$ より、

$$
P_{ij} = \exp\!\Big(\frac{f_i + g_j - C_{ij}}{\varepsilon} - 1\Big) = u_i K_{ij} v_j,
\qquad
u_i = e^{f_i/\varepsilon - 1/2},\;
v_j = e^{g_j/\varepsilon - 1/2},\;
K_{ij} = e^{-C_{ij}/\varepsilon}
$$

行列で書くと $P = \mathrm{diag}(u)\, K\, \mathrm{diag}(v)$ です。$K$ はコストだけで決まる固定の行列なので、$nm$ 個の変数を持つ $P$ を探す問題が、2本のベクトル $u, v$ を探す問題に変わりました。

## Sinkhornアルゴリズム

$P$ の行和が $a$、列和が $b$ になるように、$u$ と $v$ を交互に更新します。片方を固定すればもう片方は割り算一発で決まるので、双対変数を交互に最適化していることになります。

```python
import numpy as np

def sinkhorn(a, b, C, eps, n_iter=1000):
    K = np.exp(-C / eps)
    u, v = np.ones_like(a), np.ones_like(b)
    for _ in range(n_iter):
        u = a / (K @ v)      # 行和を a に合わせる
        v = b / (K.T @ u)    # 列和を b に合わせる
    return u[:, None] * K * v[None, :]

a = np.array([0.5, 0.5])
b = np.array([0.3, 0.7])
C = np.array([[0.0, 1.0], [1.0, 0.0]])
P = sinkhorn(a, b, C, eps=0.5)
# [[0.288 0.212]
#  [0.012 0.488]]  総コスト 0.224
```

1回の更新は行列とベクトルの積だけなので、GPUで並列に計算しやすいのも利点です。$\varepsilon = 0.1$ まで小さくすると、解は元の問題の解(総コスト0.2)とほぼ一致します。

## おわりに

双対性で変数をベクトル2本に減らし、エントロピー正則化で問題を滑らかにすることで、最適輸送は単純な反復計算で解けるようになりました。一方で、正則化した値は同じ分布どうしでも0にならないなど、厳密には距離の公理を満たしません。この点を補正した Sinkhorn divergence や、Wasserstein距離との関係は次回の記事で扱う予定です。

## 参考文献

1. M. Cuturi, “Sinkhorn Distances: Lightspeed Computation of Optimal Transport,” NeurIPS, 2013.
2. 佐藤竜馬『最適輸送の理論とアルゴリズム』講談社, 2023.
3. 佐藤竜馬「最適輸送の解き方」Speaker Deck.
