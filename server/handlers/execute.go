package handlers

import (
	"encoding/base64"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// Varsayılan limitler (ENV ile override edilebilir)
const (
	TOTAL_UPLOAD_LIMIT_DEFAULT = 50 * 1024 * 1024 // 50 MB
	SINGLE_FILE_LIMIT_DEFAULT  = 5 * 1024 * 1024  // 5 MB
)

// FileUpload, frontend'den gelen dosya yüklemelerini temsil eder
type FileUpload struct {
	Name string `json:"name"`
	Data string `json:"data"` // data URI: "data:...;base64,AAAA..."
}

// ExecuteRequest: code + files (+ runtime + resources)
type ExecuteRequest struct {
	Code    string       `json:"code"`
	Files   []FileUpload `json:"files,omitempty"`
	Runtime string       `json:"runtime,omitempty"` // "python", "base", "ml"
	Mem     string       `json:"mem,omitempty"`     // "256m","512m","1g","2g"
	CPU     string       `json:"cpu,omitempty"`     // "0.25","0.5","1.0","2.0"
}

type ExecuteResponse struct {
	Output string   `json:"output"`
	Error  string   `json:"error,omitempty"`
	Images []string `json:"images,omitempty"` // data:image/png;base64,...
}

func readIntEnv(key string, def int) int {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil || n < 0 {
		return def
	}
	return n
}

func getEnv(key, def string) string {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	return v
}

// base64 gövdesinin (padding dahil) gerçek decoded byte uzunluğunu hesapla
func decodedLenFromBase64Body(body string) int {
	l := len(body)
	if l == 0 {
		return 0
	}
	padding := 0
	if body[l-1] == '=' {
		padding++
	}
	if l > 1 && body[l-2] == '=' {
		padding++
	}
	return l*3/4 - padding
}

func isDockerRunning() bool {
	cmd := exec.Command("docker", "info")
	return cmd.Run() == nil
}

func collectPlotsAsDataURIs(baseDir string) []string {
	plotsDir := filepath.Join(baseDir, "_plots")
	entries, err := os.ReadDir(plotsDir)
	if err != nil {
		return nil
	}
	var imgs []string
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		name := strings.ToLower(e.Name())
		if !strings.HasSuffix(name, ".png") {
			continue
		}
		b, err := os.ReadFile(filepath.Join(plotsDir, e.Name()))
		if err != nil {
			continue
		}
		imgs = append(imgs, "data:image/png;base64,"+base64.StdEncoding.EncodeToString(b))
	}
	return imgs
}

func ExecuteCode(c *gin.Context) {
	if !isDockerRunning() {
		c.JSON(500, ExecuteResponse{
			Output: "",
			Error:  "Docker is not running. Please start Docker Desktop.",
		})
		return
	}

	var req ExecuteRequest
	if err := c.BindJSON(&req); err != nil {
		c.JSON(400, ExecuteResponse{Error: "Invalid request"})
		return
	}

	start := time.Now()

	// Limitleri ENV'den yükle
	totalLimit := readIntEnv("TOTAL_UPLOAD_LIMIT", TOTAL_UPLOAD_LIMIT_DEFAULT)
	singleLimit := readIntEnv("SINGLE_FILE_LIMIT", SINGLE_FILE_LIMIT_DEFAULT)

	// === 0) Yükleme limit kontrolü (dosyaları diske yazmadan önce)
	var totalBytes int
	for _, f := range req.Files {
		parts := strings.SplitN(f.Data, ",", 2)
		if len(parts) != 2 {
			continue // bozuk data URI'leri atla
		}
		body := parts[1]
		size := decodedLenFromBase64Body(body)

		// Tekil dosya limiti (0 ise devre dışı)
		if singleLimit > 0 && size > singleLimit {
			c.JSON(400, ExecuteResponse{
				Error: fmt.Sprintf("Single file size limit exceeded (%s). Maximum allowed: %.2f MB",
					f.Name, float64(singleLimit)/1024.0/1024.0),
			})
			return
		}

		totalBytes += size
		if totalLimit > 0 && totalBytes > totalLimit {
			c.JSON(400, ExecuteResponse{
				Error: fmt.Sprintf("Total upload quota exceeded. Total: %.2f MB / Allowed: %.2f MB",
					float64(totalBytes)/1024.0/1024.0, float64(totalLimit)/1024.0/1024.0),
			})
			return
		}
	}

	// Geçici klasör oluştur ve sonunda sil
	tempDir, err := os.MkdirTemp("", "code-")
	if err != nil {
		c.JSON(500, ExecuteResponse{Error: "Cannot create temp dir"})
		return
	}
	defer os.RemoveAll(tempDir)

	// Frontend'den gelen dosyaları tempDir altına yaz (decode ederek)
	for _, f := range req.Files {
		parts := strings.SplitN(f.Data, ",", 2)
		if len(parts) != 2 {
			continue
		}
		decoded, err := base64.StdEncoding.DecodeString(parts[1])
		if err != nil {
			continue
		}
		targetPath := filepath.Join(tempDir, f.Name)

		// Alt klasörleri varsa oluştur
		if err := os.MkdirAll(filepath.Dir(targetPath), 0o755); err != nil {
			continue
		}
		if err := os.WriteFile(targetPath, decoded, 0o644); err != nil {
			continue
		}
	}

	// Kullanıcının kodunu code_user.py olarak yaz
	userFile := filepath.Join(tempDir, "code_user.py")
	if err := os.WriteFile(userFile, []byte(req.Code), 0o644); err != nil {
		c.JSON(500, ExecuteResponse{Error: "Cannot write user code file"})
		return
	}

	// Runner (launcher) yaz – runtime'a göre
	rt := strings.ToLower(strings.TrimSpace(req.Runtime))

	var runner string
	if rt == "base" || rt == "ml" {
		// Matplotlib yüklü ortamlarda plot yakala
		runner = `
import os, runpy
import matplotlib
matplotlib.use("Agg")
try:
    import matplotlib.pyplot as plt
except Exception:
    plt = None

_saved = 0

def _save_figs():
    global _saved, plt
    if plt is None:
        return
    out = "_plots"
    os.makedirs(out, exist_ok=True)
    nums = plt.get_fignums()
    for i, n in enumerate(nums, start=1):
        fig = plt.figure(n)
        path = os.path.join(out, f"plot_{_saved+i}.png")
        fig.savefig(path, bbox_inches="tight")
    _saved += len(nums)
    plt.close("all")

if plt is not None:
    _orig_show = plt.show
    def _patched_show(*args, **kwargs):
        _save_figs()
    plt.show = _patched_show

# kullanıcı kodunu çalıştır
runpy.run_path("code_user.py", run_name="__main__")

# kullanıcı show() demese de en sonda kaydet
_save_figs()
`
	} else {
		// Saf Python: matplotlib import etme (slim imajda yok)
		runner = `
import runpy
runpy.run_path("code_user.py", run_name="__main__")
`
	}

	runnerFile := filepath.Join(tempDir, "runner.py")
	if err := os.WriteFile(runnerFile, []byte(runner), 0o644); err != nil {
		c.JSON(500, ExecuteResponse{Error: "Cannot write runner"})
		return
	}

	// 4) Hangi imaj? (runtime allowlist + ENV fallback)
	runtimeMap := map[string]string{
		"python": "python:3.11-slim",
		"base":   "py-sandbox:base",
		"ml":     "py-sandbox:ml",
	}
	image := runtimeMap[rt]
	if image == "" {
		image = getEnv("PY_IMAGE", "python:3.11-slim")
	}

	// 4.1 Resources (mem/cpu) – UI preset + default + cap
	defMem := getEnv("DEFAULT_MEM", "512m")
	defCPU := getEnv("DEFAULT_CPU", "0.5")
	maxMem := getEnv("MAX_MEM", "2g")
	maxCPU := getEnv("MAX_CPU", "2.0")

	allowedMem := map[string]int{"256m": 0, "512m": 1, "1g": 2, "2g": 3}
	allowedCPU := map[string]bool{"0.25": true, "0.5": true, "1.0": true, "2.0": true}

	mem := strings.ToLower(strings.TrimSpace(req.Mem))
	cpu := strings.TrimSpace(req.CPU)

	if _, ok := allowedMem[mem]; !ok {
		mem = defMem
	}
	if !allowedCPU[cpu] {
		cpu = defCPU
	}

	// Cap
	idx := func(v string) int {
		if i, ok := allowedMem[v]; ok {
			return i
		}
		return -1
	}
	if idx(mem) > idx(maxMem) && idx(maxMem) >= 0 {
		mem = maxMem
	}
	toF := func(s string) float64 {
		v, _ := strconv.ParseFloat(s, 64)
		return v
	}
	if toF(cpu) > toF(maxCPU) {
		cpu = maxCPU
	}

	// 5) Docker komutunu hazırla (tempDir içeriğini /code altında mount ediyoruz)
	containerName := fmt.Sprintf("sandbox-%d", time.Now().UnixNano())
	cmd := exec.Command(
		"docker", "run", "--rm",
		"-v", fmt.Sprintf("%s:/code", tempDir),
		"-w", "/code", // çalışma dizini /code
		"--network", "none", // internet kapalı
		"--memory", mem, // RAM limiti
		"--cpus", cpu, // CPU limiti
		"--pids-limit", "50",
		"--name", containerName,
		image,
		"python", "runner.py",
	)

	// 6) Çıktıyı al
	output, err := cmd.CombinedOutput()
	duration := time.Since(start).Seconds()

	// 6.5) (başarılı/başarısız fark etmeksizin) oluşan plot'ları topla
	imgs := collectPlotsAsDataURIs(tempDir)

	if err != nil {
		c.JSON(200, ExecuteResponse{
			Output: fmt.Sprintf(
				"Code execution failed.\nDuration: %.2f seconds\n\nError: %s\n\nOutput:\n%s",
				duration, err.Error(), string(output),
			),
			Images: imgs,
		})
		return
	}

	// 7) Başarılı çalıştırma mesajını hazırla
	msg := string(output)
	if msg == "" {
		msg = fmt.Sprintf("Cell ran successfully. (No output)\nDuration: %.2f seconds", duration)
	} else {
		msg = fmt.Sprintf("%s\n\nCell ran successfully.\nDuration: %.2f seconds", msg, duration)
	}

	// 8) JSON ile cevabı geri dön
	c.JSON(200, ExecuteResponse{
		Output: msg,
		Images: imgs,
	})
}
