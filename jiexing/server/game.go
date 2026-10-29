package main

import "errors"

// 棋盘与服务端权威规则。
// 席位 a 执朱砂，自下方(12,6)出发，目标第 0 行，先行；
// 席位 b 执靛青，自上方(0,6)出发，目标第 12 行。
const (
	boardN    = 13
	wallLimit = 10
	goalA     = 0
	goalB     = boardN - 1
)

var (
	sideA = "a"
	sideB = "b"
)

func otherSide(side string) string {
	if side == sideA {
		return sideB
	}
	return sideA
}

func goalRow(side string) int {
	if side == sideA {
		return goalA
	}
	return goalB
}

func startPos(side string) Pos {
	if side == sideA {
		return Pos{R: boardN - 1, C: boardN / 2}
	}
	return Pos{R: 0, C: boardN / 2}
}

type Pos struct {
	R int `json:"r"`
	C int `json:"c"`
}

// Action 既表示走子，也表示落板。
type Action struct {
	Type string `json:"type"`           // move | jump | wall
	Kind string `json:"kind,omitempty"` // h | v，仅 wall 使用
	// R/C 不能 omitempty：挡板落在第 0 行/第 0 列时若被省略，客户端会拿到
	// undefined，翻转后算出 NaN，进而把挡板画到棋盘外。
	R  int  `json:"r"`
	C  int  `json:"c"`
	To *Pos `json:"to,omitempty"`
}

type Game struct {
	Pawns   map[string]Pos
	H       map[int]bool
	V       map[int]bool
	Inv     map[string]int
	Turn    string
	Started bool
	Over    bool
	Winner  string
	Turns   int
	Last    *Action
	LastBy  string
}

func newGame() *Game {
	return &Game{
		Pawns: map[string]Pos{sideA: startPos(sideA), sideB: startPos(sideB)},
		H:     map[int]bool{},
		V:     map[int]bool{},
		Inv:   map[string]int{sideA: wallLimit, sideB: wallLimit},
		Turn:  sideA,
	}
}

func wallKey(r, c int) int { return r*boardN + c }

func inBoard(r, c int) bool {
	return r >= 0 && r < boardN && c >= 0 && c < boardN
}

// edgeBlocked 判断相邻两格之间是否被挡板封住。
func (g *Game) edgeBlocked(a, b Pos) bool {
	if a.R == b.R {
		bc := a.C
		if b.C < bc {
			bc = b.C
		}
		return g.V[wallKey(a.R-1, bc)] || g.V[wallKey(a.R, bc)]
	}
	if a.C == b.C {
		br := a.R
		if b.R < br {
			br = b.R
		}
		return g.H[wallKey(br, a.C-1)] || g.H[wallKey(br, a.C)]
	}
	return true
}

// legalMoves 返回该席位的全部合法走法（含直跳与斜跳）。
func (g *Game) legalMoves(side string) []Action {
	pos := g.Pawns[side]
	opp := g.Pawns[otherSide(side)]
	out := []Action{}
	dirs := [][2]int{{-1, 0}, {1, 0}, {0, -1}, {0, 1}}
	for _, d := range dirs {
		adj := Pos{R: pos.R + d[0], C: pos.C + d[1]}
		if !inBoard(adj.R, adj.C) {
			continue
		}
		if g.edgeBlocked(pos, adj) {
			continue
		}
		if adj == opp {
			beyond := Pos{R: adj.R + d[0], C: adj.C + d[1]}
			if inBoard(beyond.R, beyond.C) && !g.edgeBlocked(adj, beyond) {
				out = append(out, Action{Type: "jump", To: &Pos{R: beyond.R, C: beyond.C}})
				continue
			}
			perps := [][2]int{{-1, 0}, {1, 0}}
			if d[0] != 0 {
				perps = [][2]int{{0, -1}, {0, 1}}
			}
			for _, p := range perps {
				diag := Pos{R: adj.R + p[0], C: adj.C + p[1]}
				if !inBoard(diag.R, diag.C) {
					continue
				}
				if diag == pos {
					continue
				}
				if g.edgeBlocked(adj, diag) {
					continue
				}
				out = append(out, Action{Type: "jump", To: &Pos{R: diag.R, C: diag.C}})
			}
		} else {
			out = append(out, Action{Type: "move", To: &Pos{R: adj.R, C: adj.C}})
		}
	}
	return out
}

// shortestDistance 只考虑挡板、忽略棋子占位，返回最短到达目标行的步数；-1 表示无法到达。
func shortestDistance(pawn Pos, goal int, h, v map[int]bool) int {
	if pawn.R == goal {
		return 0
	}
	dist := make([]int16, boardN*boardN)
	for i := range dist {
		dist[i] = -1
	}
	queue := make([]int16, 0, boardN*boardN)
	start := pawn.R*boardN + pawn.C
	dist[start] = 0
	queue = append(queue, int16(start))
	for head := 0; head < len(queue); head++ {
		cur := int(queue[head])
		r, c := cur/boardN, cur%boardN
		nd := dist[cur] + 1
		if r > 0 && !(h[wallKey(r-1, c-1)] || h[wallKey(r-1, c)]) {
			ni := (r-1)*boardN + c
			if dist[ni] == -1 {
				if r-1 == goal {
					return int(nd)
				}
				dist[ni] = nd
				queue = append(queue, int16(ni))
			}
		}
		if r < boardN-1 && !(h[wallKey(r, c-1)] || h[wallKey(r, c)]) {
			ni := (r+1)*boardN + c
			if dist[ni] == -1 {
				if r+1 == goal {
					return int(nd)
				}
				dist[ni] = nd
				queue = append(queue, int16(ni))
			}
		}
		if c > 0 && !(v[wallKey(r-1, c-1)] || v[wallKey(r, c-1)]) {
			ni := r*boardN + (c - 1)
			if dist[ni] == -1 {
				dist[ni] = nd
				queue = append(queue, int16(ni))
			}
		}
		if c < boardN-1 && !(v[wallKey(r-1, c)] || v[wallKey(r, c)]) {
			ni := r*boardN + (c + 1)
			if dist[ni] == -1 {
				dist[ni] = nd
				queue = append(queue, int16(ni))
			}
		}
	}
	return -1
}

// isCrossJoin 判断横板 (hRow,hCol) 与竖板 (vRow,vCol) 是否在中段交叉成十字。
func isCrossJoin(hRow, hCol, vRow, vCol int) bool {
	gx := vCol + 1
	gy := hRow + 1
	hEndpoint := gx == hCol || gx == hCol+2
	vEndpoint := gy == vRow || gy == vRow+2
	return !hEndpoint && !vEndpoint
}

func copyWalls(m map[int]bool) map[int]bool {
	out := make(map[int]bool, len(m)+1)
	for k, v := range m {
		out[k] = v
	}
	return out
}

// checkWall 校验挡板是否可以放置，返回不合法原因。
func (g *Game) checkWall(kind string, r, c int, side string) error {
	if g.Inv[side] <= 0 {
		return errWallExhausted
	}
	if r < 0 || r >= boardN-1 || c < 0 || c >= boardN-1 {
		return errors.New("挡板必须落在棋盘内部两条格线之间。")
	}
	if kind != "h" && kind != "v" {
		return errors.New("挡板类型不正确。")
	}
	if kind == "h" {
		for cc := c - 1; cc <= c+1; cc++ {
			if cc < 0 || cc >= boardN-1 {
				continue
			}
			if g.H[wallKey(r, cc)] {
				return errors.New("这里已经有一块横板了。")
			}
		}
		for rr := r - 1; rr <= r+1; rr++ {
			if rr < 0 || rr >= boardN-1 {
				continue
			}
			for cc := c - 1; cc <= c+1; cc++ {
				if cc < 0 || cc >= boardN-1 {
					continue
				}
				if g.V[wallKey(rr, cc)] && isCrossJoin(r, c, rr, cc) {
					return errors.New("横竖挡板不能在中段交叉成十字形。")
				}
			}
		}
	} else {
		for rr := r - 1; rr <= r+1; rr++ {
			if rr < 0 || rr >= boardN-1 {
				continue
			}
			if g.V[wallKey(rr, c)] {
				return errors.New("这里已经有一块竖板了。")
			}
		}
		for rr := r - 1; rr <= r+1; rr++ {
			if rr < 0 || rr >= boardN-1 {
				continue
			}
			for cc := c - 1; cc <= c+1; cc++ {
				if cc < 0 || cc >= boardN-1 {
					continue
				}
				if g.H[wallKey(rr, cc)] && isCrossJoin(rr, cc, r, c) {
					return errors.New("横竖挡板不能在中段交叉成十字形。")
				}
			}
		}
	}
	h2, v2 := g.H, g.V
	if kind == "h" {
		h2 = copyWalls(g.H)
		h2[wallKey(r, c)] = true
	} else {
		v2 = copyWalls(g.V)
		v2[wallKey(r, c)] = true
	}
	if shortestDistance(g.Pawns[side], goalRow(side), h2, v2) < 0 {
		return errSelfTrapped
	}
	if shortestDistance(g.Pawns[otherSide(side)], goalRow(otherSide(side)), h2, v2) < 0 {
		return errors.New("这块挡板会把对手困死，规则不允许封死通路。")
	}
	return nil
}

var (
	errWallExhausted = errors.New("挡板已用尽，只能移动。")
	errSelfTrapped   = errors.New("这块挡板会把你困死。")
)

// Apply 校验并执行一步动作。调用方需持有房间锁。
func (g *Game) Apply(side string, a Action) error {
	if !g.Started {
		return errors.New("对局尚未开始。")
	}
	if g.Over {
		return errors.New("对局已经结束。")
	}
	if g.Turn != side {
		return errors.New("还没轮到你落子。")
	}
	switch a.Type {
	case "move", "jump":
		if a.To == nil {
			return errors.New("缺少落点。")
		}
		var matched *Action
		for _, mv := range g.legalMoves(side) {
			if mv.To.R == a.To.R && mv.To.C == a.To.C {
				m := mv
				matched = &m
				break
			}
		}
		if matched == nil {
			return errors.New("这一步走不了。")
		}
		g.Pawns[side] = Pos{R: matched.To.R, C: matched.To.C}
		g.setLast(Action{Type: matched.Type, To: &Pos{R: matched.To.R, C: matched.To.C}}, side)
	case "wall":
		if err := g.checkWall(a.Kind, a.R, a.C, side); err != nil {
			return err
		}
		if a.Kind == "h" {
			g.H[wallKey(a.R, a.C)] = true
		} else {
			g.V[wallKey(a.R, a.C)] = true
		}
		g.Inv[side]--
		g.setLast(Action{Type: "wall", Kind: a.Kind, R: a.R, C: a.C}, side)
	default:
		return errors.New("未知的动作类型。")
	}
	g.Turns++
	if g.Pawns[side].R == goalRow(side) {
		g.Over = true
		g.Winner = side
	} else {
		g.Turn = otherSide(side)
	}
	return nil
}

func (g *Game) setLast(a Action, side string) {
	g.Last = &a
	g.LastBy = side
}
