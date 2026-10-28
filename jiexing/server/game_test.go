package main

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

/* ---------- 规则引擎 ---------- */

func TestStartPositionAndMoves(t *testing.T) {
	g := newGame()
	g.Started = true
	if g.Turn != sideA {
		t.Fatalf("先手应为 a，实际 %s", g.Turn)
	}
	moves := g.legalMoves(sideA)
	// 起点 (12,6) 周围三格都可走
	if len(moves) != 3 {
		t.Fatalf("开局应有三步可走，实际 %d: %+v", len(moves), moves)
	}
	if g.Inv[sideA] != wallLimit || g.Inv[sideB] != wallLimit {
		t.Fatalf("开局挡板数不对")
	}
}

func TestJumpAndDiagonalJump(t *testing.T) {
	g := newGame()
	g.Started = true
	g.Pawns[sideA] = Pos{R: 10, C: 6}
	g.Pawns[sideB] = Pos{R: 9, C: 6}
	found := false
	for _, m := range g.legalMoves(sideA) {
		if m.Type == "jump" && m.To != nil && *m.To == (Pos{R: 8, C: 6}) {
			found = true
		}
	}
	if !found {
		t.Fatalf("应能直跳到 (8,6)")
	}
	// 正后方被挡板封住时，改为斜跳
	g.H[wallKey(8, 5)] = true
	diag := 0
	for _, m := range g.legalMoves(sideA) {
		if m.Type == "jump" {
			if !(*m.To == Pos{R: 9, C: 5} || *m.To == Pos{R: 9, C: 7}) {
				t.Fatalf("斜跳落点不对: %+v", m.To)
			}
			diag++
		}
	}
	if diag != 2 {
		t.Fatalf("应有两个斜跳点，实际 %d", diag)
	}
}

func TestWallValidation(t *testing.T) {
	g := newGame()
	g.Started = true
	if err := g.checkWall("h", 5, 3, sideA); err != nil {
		t.Fatalf("正常横板应可放: %v", err)
	}
	g.H[wallKey(5, 3)] = true
	if err := g.checkWall("h", 5, 3, sideA); err == nil {
		t.Fatalf("重叠横板应被拒绝")
	}
	if err := g.checkWall("h", 12, 3, sideA); err == nil {
		t.Fatalf("越界挡板应被拒绝")
	}
	if err := g.checkWall("h", 5, 12, sideA); err == nil {
		t.Fatalf("越界挡板应被拒绝")
	}
	g.Inv[sideA] = 0
	if err := g.checkWall("v", 5, 5, sideA); err == nil {
		t.Fatalf("挡板用尽应被拒绝")
	}
}

func TestCrossJoinRejected(t *testing.T) {
	g := newGame()
	g.Started = true
	g.H[wallKey(5, 3)] = true
	// 竖板 (5,3) 的 gx=4 落在横板中段，且纵向跨过横板 → 十字交叉
	if err := g.checkWall("v", 5, 3, sideA); err == nil {
		t.Fatalf("十字交叉应被拒绝")
	}
	// 端头撞在中段的 T 形合法
	g2 := newGame()
	g2.Started = true
	g2.H[wallKey(5, 3)] = true
	if err := g2.checkWall("v", 4, 3, sideA); err != nil {
		t.Fatalf("T 形应合法: %v", err)
	}
}

func TestWallCannotTrapPawn(t *testing.T) {
	g := newGame()
	g.Started = true
	g.Pawns[sideA] = Pos{R: 11, C: 6}
	// 三面围住 a，只留右侧一格
	g.H[wallKey(10, 5)] = true
	g.H[wallKey(11, 5)] = true
	g.V[wallKey(11, 5)] = true
	if err := g.checkWall("v", 11, 6, sideA); err == nil {
		t.Fatalf("会把自己困死的挡板应被拒绝")
	}
	// 对手的通路也必须保留
	g2 := newGame()
	g2.Started = true
	g2.Pawns[sideB] = Pos{R: 1, C: 6}
	g2.H[wallKey(0, 5)] = true
	g2.H[wallKey(1, 5)] = true
	g2.V[wallKey(1, 5)] = true
	if err := g2.checkWall("v", 1, 6, sideA); err == nil {
		t.Fatalf("会把对手困死的挡板应被拒绝")
	}
}

func TestTurnEnforcement(t *testing.T) {
	g := newGame()
	g.Started = true
	to := &Pos{R: 11, C: 6}
	if err := g.Apply(sideB, Action{Type: "move", To: to}); err == nil {
		t.Fatalf("不该轮到 b")
	}
	if err := g.Apply(sideA, Action{Type: "move", To: to}); err != nil {
		t.Fatalf("a 走一步应成功: %v", err)
	}
	if g.Turn != sideB {
		t.Fatalf("应轮到 b")
	}
	if err := g.Apply(sideA, Action{Type: "move", To: &Pos{R: 10, C: 6}}); err == nil {
		t.Fatalf("连续走两步应被拒绝")
	}
}

func TestWinDetection(t *testing.T) {
	g := newGame()
	g.Started = true
	g.Pawns[sideA] = Pos{R: 1, C: 6}
	g.Pawns[sideB] = Pos{R: 10, C: 6}
	if err := g.Apply(sideA, Action{Type: "move", To: &Pos{R: 0, C: 6}}); err != nil {
		t.Fatalf("最后一步应成功: %v", err)
	}
	if !g.Over || g.Winner != sideA {
		t.Fatalf("应判定 a 获胜: over=%v winner=%s", g.Over, g.Winner)
	}
	if err := g.Apply(sideB, Action{Type: "move", To: &Pos{R: 11, C: 6}}); err == nil {
		t.Fatalf("结束后不应再接受动作")
	}
}

/* ---------- WebSocket 协议 ---------- */

type wsMsg struct {
	T     string     `json:"t"`
	Msg   string     `json:"msg"`
	Code  string     `json:"code"`
	Side  string     `json:"side"`
	Token string     `json:"token"`
	State *wireState `json:"state"`
}

func dial(t *testing.T, srv *httptest.Server) *websocket.Conn {
	t.Helper()
	url := "ws" + strings.TrimPrefix(srv.URL, "http") + "/ws"
	conn, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatalf("连接失败: %v", err)
	}
	return conn
}

func sendMsg(t *testing.T, conn *websocket.Conn, m map[string]any) {
	t.Helper()
	data, _ := json.Marshal(m)
	if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
		t.Fatalf("发送失败: %v", err)
	}
}

func readMsg(t *testing.T, conn *websocket.Conn) wsMsg {
	t.Helper()
	_ = conn.SetReadDeadline(time.Now().Add(3 * time.Second))
	_, data, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("读取失败: %v", err)
	}
	var m wsMsg
	if err := json.Unmarshal(data, &m); err != nil {
		t.Fatalf("解析失败: %v (%s)", err, data)
	}
	return m
}

// readUntil 跳过 info 之类的通知，直到读到指定类型。
func readUntil(t *testing.T, conn *websocket.Conn, kind string) wsMsg {
	t.Helper()
	for i := 0; i < 8; i++ {
		m := readMsg(t, conn)
		if m.T == kind {
			return m
		}
	}
	t.Fatalf("没有等到 %s 消息", kind)
	return wsMsg{}
}

func newTestServer(t *testing.T) *httptest.Server {
	t.Helper()
	hub := newHub()
	srv := httptest.NewServer(newMux(hub))
	t.Cleanup(srv.Close)
	return srv
}

func TestRoomFlow(t *testing.T) {
	srv := newTestServer(t)
	a := dial(t, srv)
	defer a.Close()
	b := dial(t, srv)
	defer b.Close()

	sendMsg(t, a, map[string]any{"t": "create"})
	room := readUntil(t, a, "room")
	if len(room.Code) != 4 || room.Side != sideA || room.Token == "" {
		t.Fatalf("建房返回不对: %+v", room)
	}
	st := readUntil(t, a, "state").State
	if st.Started {
		t.Fatalf("单人时不应开始")
	}
	if st.You != sideA || st.Turn != sideA {
		t.Fatalf("建房者应是 a 且先手: %+v", st)
	}

	sendMsg(t, b, map[string]any{"t": "join", "code": strings.ToLower(room.Code)})
	rb := readUntil(t, b, "room")
	if rb.Side != sideB {
		t.Fatalf("加入者应是 b: %+v", rb)
	}
	// 两边都应收到已开始的状态
	stA := readUntil(t, a, "state").State
	stB := readUntil(t, b, "state").State
	if !stA.Started || !stB.Started {
		t.Fatalf("两人到齐后应开始")
	}
	if !stA.Present[sideA] || !stA.Present[sideB] {
		t.Fatalf("在线状态不对: %+v", stA.Present)
	}

	// b 抢跑应被拒绝
	sendMsg(t, b, map[string]any{"t": "action", "action": map[string]any{"type": "move", "to": map[string]any{"r": 1, "c": 6}}})
	if m := readUntil(t, b, "error"); !strings.Contains(m.Msg, "轮到你") {
		t.Fatalf("应提示未轮到，实际: %s", m.Msg)
	}

	// a 走一步，双方状态一致
	sendMsg(t, a, map[string]any{"t": "action", "action": map[string]any{"type": "move", "to": map[string]any{"r": 11, "c": 6}}})
	stA = readUntil(t, a, "state").State
	stB = readUntil(t, b, "state").State
	if stA.Pawns[sideA] != (Pos{R: 11, C: 6}) || stB.Pawns[sideA] != (Pos{R: 11, C: 6}) {
		t.Fatalf("走子后状态不一致: %+v / %+v", stA.Pawns, stB.Pawns)
	}
	if stA.Turn != sideB || stB.Turn != sideB {
		t.Fatalf("走子后应轮到 b")
	}
	if stA.Turns != 1 {
		t.Fatalf("手数应为 1，实际 %d", stA.Turns)
	}

	// 非法动作应被拒绝且不改变状态
	sendMsg(t, b, map[string]any{"t": "action", "action": map[string]any{"type": "move", "to": map[string]any{"r": 9, "c": 6}}})
	if m := readUntil(t, b, "error"); m.Msg == "" {
		t.Fatalf("应返回错误")
	}
	sendMsg(t, b, map[string]any{"t": "sync"})
	if st := readUntil(t, b, "state").State; st.Pawns[sideB] != (Pos{R: 0, C: 6}) {
		t.Fatalf("非法动作不应改变棋局")
	}

	// 重复加入应被拒绝
	c := dial(t, srv)
	defer c.Close()
	sendMsg(t, c, map[string]any{"t": "join", "code": room.Code})
	if m := readUntil(t, c, "error"); m.Msg == "" {
		t.Fatalf("房间已满应报错")
	}
}

func TestPlayToWinAndRematch(t *testing.T) {
	srv := newTestServer(t)
	a := dial(t, srv)
	defer a.Close()
	b := dial(t, srv)
	defer b.Close()

	sendMsg(t, a, map[string]any{"t": "create"})
	room := readUntil(t, a, "room")
	readUntil(t, a, "state")
	sendMsg(t, b, map[string]any{"t": "join", "code": room.Code})
	readUntil(t, b, "room")
	readUntil(t, a, "state")
	readUntil(t, b, "state")

	var last *wireState
	bCol := 5
	for i := 12; i > 0; i-- {
		sendMsg(t, a, map[string]any{"t": "action", "action": map[string]any{"type": "move", "to": map[string]any{"r": i - 1, "c": 6}}})
		last = readUntil(t, a, "state").State
		readUntil(t, b, "state")
		if last.Over {
			break
		}
		// b 在第 0 行左右挪动，避免和上行中的 a 撞在一起
		sendMsg(t, b, map[string]any{"t": "action", "action": map[string]any{"type": "move", "to": map[string]any{"r": 0, "c": bCol}}})
		readUntil(t, a, "state")
		readUntil(t, b, "state")
		if bCol == 5 {
			bCol = 4
		} else {
			bCol = 5
		}
	}
	if last == nil || !last.Over || last.Winner != sideA {
		t.Fatalf("应判定 a 获胜: %+v", last)
	}

	// 双方都请求再来一局
	sendMsg(t, a, map[string]any{"t": "rematch"})
	readUntil(t, a, "state")
	readUntil(t, b, "state")
	sendMsg(t, b, map[string]any{"t": "rematch"})
	stA := readUntil(t, a, "state").State
	stB := readUntil(t, b, "state").State
	if stA.Turns != 0 || stA.Over || !stA.Started || stA.Gid != 2 {
		t.Fatalf("再来一局状态不对: %+v", stA)
	}
	if stB.Gid != 2 || stB.Pawns[sideA] != (Pos{R: 12, C: 6}) {
		t.Fatalf("再来一局应重置棋盘: %+v", stB)
	}
}
