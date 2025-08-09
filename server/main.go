package main

import (
	"py-compiler-backend/handlers"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	// r = router
	r := gin.Default()

	// CORS middleware
	r.Use(cors.Default())

	r.POST("/execute", handlers.ExecuteCode)

	r.Run(":8080")
}
