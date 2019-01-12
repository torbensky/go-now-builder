package main

import (
	"net/http"

	now "github.com/torbensky/now-go-bridge/bridge"
)

func main() {
	now.Start(http.HandlerFunc(__NOW_HANDLER_FUNC_NAME))
}
