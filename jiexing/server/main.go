package main

import (
	"encoding/json"
	"flag"
	"log"
	"net/http"
	"path/filepath"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  2048,
	WriteBufferSize: 2048,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

type inMsg struct {
	T      string  `json:"t"`
	Code   string  `json:"code"`
	Token  string  `json:"token"`
	Action *Action `json:"action"`
}

func main() {
	addr := flag.String("addr", ":8080", "HTTP 监听地址")
	web := flag.String("web", "..", "静态页面目录（默认上级目录，即 jiexing/）")
	flag.Parse()

	hub := newHub()
	mux := newMux(hub)
	webAbs, err := filepath.Abs(*web)
	if err != nil {
		webAbs = *web
	}
	mux.Handle("/", http.FileServer(http.Dir(webAbs)))

	log.Printf("界行服务端启动：http://localhost%s/  （WebSocket: /ws）", *addr)
	log.Printf("静态目录：%s", webAbs)
	if err := http.ListenAndServe(*addr, mux); err != nil {
		log.Fatal(err)
	}
}

func newMux(hub *Hub) *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		serveWS(hub, w, r)
	})
	return mux
}

func serveWS(hub *Hub, w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("升级 WebSocket 失败: %v", err)
		return
	}
	c := &Client{conn: conn}
	closed := make(chan struct{})
	defer func() {
		close(closed)
		_ = conn.Close()
		if c.room != nil {
			c.room.detach(c)
		}
	}()

	conn.SetReadLimit(4096)
	_ = conn.SetReadDeadline(time.Now().Add(90 * time.Second))
	conn.SetPongHandler(func(string) error {
		return conn.SetReadDeadline(time.Now().Add(90 * time.Second))
	})
	go func() {
		t := time.NewTicker(25 * time.Second)
		defer t.Stop()
		for {
			select {
			case <-closed:
				return
			case <-t.C:
				c.writeMu.Lock()
				_ = conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
				err := conn.WriteMessage(websocket.PingMessage, nil)
				c.writeMu.Unlock()
				if err != nil {
					return
				}
			}
		}
	}()

	for {
		_, data, err := conn.ReadMessage()
		if err != nil {
			return
		}
		var msg inMsg
		if err := json.Unmarshal(data, &msg); err != nil {
			c.sendError("消息格式不正确。")
			continue
		}
		if err := dispatch(hub, c, msg); err != nil {
			c.sendError(err.Error())
		}
	}
}

func dispatch(hub *Hub, c *Client, msg inMsg) error {
	switch msg.T {
	case "create":
		if c.room != nil {
			return errAlreadyInRoom
		}
		return hub.create(c)
	case "join":
		if c.room != nil {
			return errAlreadyInRoom
		}
		if msg.Token != "" {
			if room := hub.get(normalizeCode(msg.Code)); room != nil {
				return room.rejoin(c, msg.Code, msg.Token)
			}
		}
		room := hub.get(normalizeCode(msg.Code))
		if room == nil {
			return errNoRoom
		}
		return room.join(c, msg.Code, msg.Token)
	case "rejoin":
		room := hub.get(normalizeCode(msg.Code))
		if room == nil {
			return errNoRoom
		}
		return room.rejoin(c, msg.Code, msg.Token)
	case "action":
		if c.room == nil {
			return errNotInRoom
		}
		return c.room.action(c, msg.Action)
	case "rematch":
		if c.room == nil {
			return errNotInRoom
		}
		return c.room.requestRematch(c)
	case "sync":
		if c.room == nil {
			return errNotInRoom
		}
		c.room.sendStateTo(c)
		return nil
	case "leave":
		if c.room != nil {
			c.room.leave(c)
		}
		return nil
	default:
		return errUnknownMessage
	}
}

var (
	errAlreadyInRoom  = errText("你已经在一个房间里了。")
	errNoRoom         = errText("房间不存在，检查一下房间码。")
	errNotInRoom      = errText("你还没有加入房间。")
	errUnknownMessage = errText("无法识别的消息类型。")
)

type errText string

func (e errText) Error() string { return string(e) }
