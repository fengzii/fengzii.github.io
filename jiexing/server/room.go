package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log"
	"math/big"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	seatTimeout    = 60 * time.Second
	roomIdleExpiry = 15 * time.Minute
)

// Client 一条 WebSocket 连接。同一连接同一时刻只属于一个房间。
type Client struct {
	conn    *websocket.Conn
	writeMu sync.Mutex
	room    *Room
	side    string
}

func (c *Client) send(v any) error {
	data, err := json.Marshal(v)
	if err != nil {
		return err
	}
	c.writeMu.Lock()
	defer c.writeMu.Unlock()
	c.conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
	return c.conn.WriteMessage(websocket.TextMessage, data)
}

func (c *Client) sendError(msg string) {
	_ = c.send(map[string]any{"t": "error", "msg": msg})
}

func (c *Client) sendInfo(msg string) {
	_ = c.send(map[string]any{"t": "info", "msg": msg})
}

type seat struct {
	c             *Client
	token         string
	reservedUntil time.Time
}

type Room struct {
	mu         sync.Mutex
	hub        *Hub
	code       string
	gid        int
	game       *Game
	seats      map[string]*seat
	rematch    map[string]bool
	lastActive time.Time
	dropTimer  *time.Timer
}

type Hub struct {
	mu    sync.Mutex
	rooms map[string]*Room
}

func newHub() *Hub {
	h := &Hub{rooms: map[string]*Room{}}
	go h.janitor()
	return h
}

func (h *Hub) janitor() {
	t := time.NewTicker(time.Minute)
	for range t.C {
		cutoff := time.Now().Add(-roomIdleExpiry)
		h.mu.Lock()
		for code, r := range h.rooms {
			r.mu.Lock()
			idle := r.lastActive.Before(cutoff) && r.seats[sideA] == nil && r.seats[sideB] == nil
			r.mu.Unlock()
			if idle {
				delete(h.rooms, code)
			}
		}
		h.mu.Unlock()
	}
}

var codeAlphabet = []byte("ABCDEFGHJKLMNPQRSTUVWXYZ23456789")

func randomCode() string {
	b := make([]byte, 4)
	for i := range b {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(codeAlphabet))))
		if err != nil {
			b[i] = codeAlphabet[0]
			continue
		}
		b[i] = codeAlphabet[n.Int64()]
	}
	return string(b)
}

func randomToken() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func (h *Hub) create(c *Client) error {
	var room *Room
	h.mu.Lock()
	for i := 0; i < 32; i++ {
		code := randomCode()
		if _, exists := h.rooms[code]; exists {
			continue
		}
		room = &Room{
			hub:        h,
			code:       code,
			gid:        1,
			game:       newGame(),
			seats:      map[string]*seat{},
			rematch:    map[string]bool{},
			lastActive: time.Now(),
		}
		h.rooms[code] = room
		break
	}
	h.mu.Unlock()
	if room == nil {
		return errors.New("房间号分配失败，请稍后再试。")
	}
	token, err := room.attach(c, sideA, "")
	if err != nil {
		h.remove(room.code)
		return err
	}
	if err := c.send(map[string]any{"t": "room", "code": room.code, "side": sideA, "token": token}); err != nil {
		return err
	}
	room.broadcast()
	return nil
}

func (h *Hub) get(code string) *Room {
	h.mu.Lock()
	defer h.mu.Unlock()
	return h.rooms[code]
}

func (h *Hub) remove(code string) {
	h.mu.Lock()
	delete(h.rooms, code)
	h.mu.Unlock()
}

// attach 占据一个席位。token 非空时只允许同 token 的旧玩家重连。
func (r *Room) attach(c *Client, side, token string) (string, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	s, ok := r.seats[side]
	if ok {
		if s.c != nil {
			return "", errors.New("这个席位已经有人在下了。")
		}
		if token == "" || s.token != token {
			if time.Now().Before(s.reservedUntil) {
				return "", errors.New("对局仍在进行，请等原玩家重连。")
			}
		}
		if token != "" && s.token == token {
			// 原玩家重连
			s.c = c
			s.reservedUntil = time.Time{}
			c.room = r
			c.side = side
			r.cancelDropTimerLocked()
			r.lastActive = time.Now()
			return s.token, nil
		}
	}
	if side == sideB {
		if _, taken := r.seats[sideA]; !taken {
			return "", errors.New("房间不存在。")
		}
	}
	tok := randomToken()
	r.seats[side] = &seat{c: c, token: tok}
	c.room = r
	c.side = side
	r.lastActive = time.Now()
	return tok, nil
}

func (r *Room) join(c *Client, code, token string) error {
	code = normalizeCode(code)
	if code == "" {
		return errors.New("请输入四位房间码。")
	}
	tok, err := r.attach(c, sideB, token)
	if err != nil {
		return err
	}
	r.mu.Lock()
	if !r.game.Started && r.seats[sideA] != nil && r.seats[sideB] != nil {
		r.game.Started = true
	}
	r.lastActive = time.Now()
	r.mu.Unlock()
	if err := c.send(map[string]any{"t": "room", "code": r.code, "side": sideB, "token": tok}); err != nil {
		return err
	}
	r.broadcast()
	return nil
}

func (r *Room) rejoin(c *Client, code, token string) error {
	code = normalizeCode(code)
	if code == "" || token == "" {
		return errors.New("缺少房间码或重连凭据。")
	}
	for _, side := range []string{sideA, sideB} {
		r.mu.Lock()
		s := r.seats[side]
		match := s != nil && s.token == token
		r.mu.Unlock()
		if !match {
			continue
		}
		if _, err := r.attach(c, side, token); err != nil {
			return err
		}
		if err := c.send(map[string]any{"t": "room", "code": r.code, "side": side, "token": token}); err != nil {
			return err
		}
		r.broadcast()
		return nil
	}
	return errors.New("找不到可重连的席位。")
}

// detach 连接断开：保留席位与 token 一段时间，供重连。
func (r *Room) detach(c *Client) {
	r.mu.Lock()
	side := c.side
	if side == "" {
		r.mu.Unlock()
		return
	}
	s := r.seats[side]
	if s == nil || s.c != c {
		r.mu.Unlock()
		return
	}
	s.c = nil
	s.reservedUntil = time.Now().Add(seatTimeout)
	c.room = nil
	c.side = ""
	started := r.game.Started
	over := r.game.Over
	r.lastActive = time.Now()
	if !started || over {
		delete(r.seats, side)
		if r.seats[sideA] == nil && r.seats[sideB] == nil {
			r.hub.remove(r.code)
		}
		r.mu.Unlock()
		r.broadcastInfo(otherSide(side), "对手离开了房间。")
		return
	}
	r.startDropTimerLocked()
	r.mu.Unlock()
	r.broadcast()
	r.broadcastInfo(otherSide(side), "对手暂时掉线，60 秒内可以重连。")
}

func (r *Room) startDropTimerLocked() {
	r.cancelDropTimerLocked()
	r.dropTimer = time.AfterFunc(seatTimeout+time.Second, func() {
		r.mu.Lock()
		if r.game.Over || !r.game.Started {
			r.mu.Unlock()
			return
		}
		missing := ""
		for _, side := range []string{sideA, sideB} {
			s := r.seats[side]
			if s == nil || s.c == nil {
				missing = side
				break
			}
		}
		if missing == "" {
			r.mu.Unlock()
			return
		}
		r.game.Over = true
		r.game.Winner = otherSide(missing)
		r.lastActive = time.Now()
		r.mu.Unlock()
		log.Printf("room %s: %s 掉线判负", r.code, missing)
		r.broadcast()
		r.broadcastInfo(otherSide(missing), "对手掉线超过 60 秒，本局判你获胜。")
	})
}

func (r *Room) cancelDropTimerLocked() {
	if r.dropTimer != nil {
		r.dropTimer.Stop()
		r.dropTimer = nil
	}
}

func (r *Room) presentLocked() map[string]bool {
	return map[string]bool{
		sideA: r.seats[sideA] != nil && r.seats[sideA].c != nil,
		sideB: r.seats[sideB] != nil && r.seats[sideB].c != nil,
	}
}

type wireState struct {
	Gid     int             `json:"gid"`
	Code    string          `json:"code"`
	You     string          `json:"you"`
	Pawns   map[string]Pos  `json:"pawns"`
	H       []int           `json:"h"`
	V       []int           `json:"v"`
	Inv     map[string]int  `json:"inv"`
	Turn    string          `json:"turn"`
	Started bool            `json:"started"`
	Over    bool            `json:"over"`
	Winner  string          `json:"winner,omitempty"`
	Turns   int             `json:"turns"`
	Last    *Action         `json:"last,omitempty"`
	LastBy  string          `json:"lastBy,omitempty"`
	Present map[string]bool `json:"present"`
	Rematch map[string]bool `json:"rematch"`
}

func sortedKeys(m map[int]bool) []int {
	out := make([]int, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	for i := 1; i < len(out); i++ {
		for j := i; j > 0 && out[j] < out[j-1]; j-- {
			out[j], out[j-1] = out[j-1], out[j]
		}
	}
	return out
}

func (r *Room) stateForLocked(side string) wireState {
	return wireState{
		Gid:     r.gid,
		Code:    r.code,
		You:     side,
		Pawns:   map[string]Pos{sideA: r.game.Pawns[sideA], sideB: r.game.Pawns[sideB]},
		H:       sortedKeys(r.game.H),
		V:       sortedKeys(r.game.V),
		Inv:     map[string]int{sideA: r.game.Inv[sideA], sideB: r.game.Inv[sideB]},
		Turn:    r.game.Turn,
		Started: r.game.Started,
		Over:    r.game.Over,
		Winner:  r.game.Winner,
		Turns:   r.game.Turns,
		Last:    r.game.Last,
		LastBy:  r.game.LastBy,
		Present: r.presentLocked(),
		Rematch: map[string]bool{sideA: r.rematch[sideA], sideB: r.rematch[sideB]},
	}
}

// broadcast 向两个座位推送各自的权威状态。
func (r *Room) broadcast() {
	r.mu.Lock()
	type out struct {
		c *Client
		m map[string]any
	}
	list := make([]out, 0, 2)
	for side, s := range r.seats {
		if s == nil || s.c == nil {
			continue
		}
		list = append(list, out{c: s.c, m: map[string]any{"t": "state", "state": r.stateForLocked(side)}})
	}
	r.mu.Unlock()
	for _, o := range list {
		if err := o.c.send(o.m); err != nil {
			log.Printf("room %s: 推送失败: %v", r.code, err)
		}
	}
}

func (r *Room) broadcastInfo(side, msg string) {
	r.mu.Lock()
	s := r.seats[side]
	var c *Client
	if s != nil {
		c = s.c
	}
	r.mu.Unlock()
	if c != nil {
		c.sendInfo(msg)
	}
}

func (r *Room) action(c *Client, a *Action) error {
	if a == nil {
		return errors.New("缺少动作。")
	}
	r.mu.Lock()
	var err error
	if c.side == "" || r.seats[c.side] == nil || r.seats[c.side].c != c {
		r.mu.Unlock()
		return errors.New("你不在这个房间里。")
	}
	err = r.game.Apply(c.side, *a)
	r.lastActive = time.Now()
	r.mu.Unlock()
	if err != nil {
		return err
	}
	r.broadcast()
	return nil
}

func (r *Room) requestRematch(c *Client) error {
	r.mu.Lock()
	if !r.game.Started {
		r.mu.Unlock()
		return errors.New("对局还没开始。")
	}
	if !r.game.Over {
		r.mu.Unlock()
		return errors.New("对局结束之后才能再来一局。")
	}
	r.rematch[c.side] = true
	both := r.rematch[sideA] && r.rematch[sideB]
	if both {
		r.gid++
		r.game = newGame()
		r.game.Started = true
		r.rematch = map[string]bool{}
		r.lastActive = time.Now()
	}
	r.mu.Unlock()
	r.broadcast()
	if both {
		r.broadcastInfo(sideA, "新的一局开始了。")
		r.broadcastInfo(sideB, "新的一局开始了。")
	}
	return nil
}

func (r *Room) sendStateTo(c *Client) {
	r.mu.Lock()
	if c.side == "" {
		r.mu.Unlock()
		return
	}
	st := r.stateForLocked(c.side)
	r.mu.Unlock()
	_ = c.send(map[string]any{"t": "state", "state": st})
}

func normalizeCode(code string) string {
	out := make([]byte, 0, 4)
	for i := 0; i < len(code); i++ {
		ch := code[i]
		if ch >= 'a' && ch <= 'z' {
			ch -= 'a' - 'A'
		}
		if ch == ' ' {
			continue
		}
		out = append(out, ch)
	}
	return string(out)
}

// leave 主动退出房间：本局作废，房间销毁。
func (r *Room) leave(c *Client) {
	r.mu.Lock()
	side := c.side
	if side == "" {
		r.mu.Unlock()
		return
	}
	delete(r.seats, side)
	other := r.seats[otherSide(side)]
	var otherClient *Client
	if other != nil {
		otherClient = other.c
	}
	c.room = nil
	c.side = ""
	r.hub.remove(r.code)
	r.cancelDropTimerLocked()
	r.mu.Unlock()
	_ = c.send(map[string]any{"t": "left"})
	if otherClient != nil {
		_ = otherClient.send(map[string]any{"t": "closed", "msg": "对手离开了房间。"})
	}
}
