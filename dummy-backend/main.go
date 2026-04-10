package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
)

type APIResponse struct {
	ID        int        `json:"id"`
	Title     string     `json:"title"`
	FeedItems []FeedItem `json:"feed_items"`
}

type FeedItem struct {
	ID          int    `json:"id"`
	Title       string `json:"title"`
	Link        string `json:"link"`
	Description string `json:"description"`
}

func loadJSONData(filePath string) (APIResponse, error) {
	var response APIResponse

	file, err := os.ReadFile(filePath)
	if err != nil {
		return response, fmt.Errorf("error reading file: %v", err)
	}

	err = json.Unmarshal(file, &response)
	if err != nil {
		return response, fmt.Errorf("error parsing JSON: %v", err)
	}

	return response, nil
}

func dataHandler(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Invalid ID", http.StatusBadRequest)
		return
	}

	filePath := filepath.Join("data", fmt.Sprintf("%d.json", id))

	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		http.Error(w, "Data not found", http.StatusNotFound)
		return
	}

	data, err := loadJSONData(filePath)
	if err != nil {
		http.Error(w, fmt.Sprintf("Error loading data: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

func main() {
	http.HandleFunc("GET /data/{id}", dataHandler)

	port := "5174"
	fmt.Printf("Server running on port %s...\n", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
