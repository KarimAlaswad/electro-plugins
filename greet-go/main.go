package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
)

type Request struct {
	Id int `json:"id"`
	Method string `json:"method"`
	Params *json.RawMessage `json:"params,omitempty"`
}

type Response struct {
	Id int `json:"id"`
	Result interface{} `json:"result,omitempty"`
	Error string `json:"error,omitempty"`
}

func main() {
	scanner := bufio.NewScanner(os.Stdin)
	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			continue
		}

		var req Request
		if err := json.Unmarshal([]byte(line), &req); err != nil {
			resp := Response{Error: "Parse error"}
			out, _ := json.Marshal(resp)
			fmt.Println(string(out))
			continue
		}

		var result interface{}
		switch req.Method {
		case "greet.hello":
			var params struct {
				Name string `json:"name"`
			}
			if req.Params != nil {
				json.Unmarshal(*req.Params, &params)
			}
			if params.Name == "" {
				params.Name = "World"
			}
			result = map[string]string{
				"message": "Hello " + params.Name + " from Go!",
			}
		case "greet.bye":
			var params struct {
				Name string `json:"name"`
			}
			if req.Params != nil {
				json.Unmarshal(*req.Params, &params)
			}
			if params.Name == "" {
				params.Name = "World"
			}
			result = map[string]string{
				"message": "Goodbye " + params.Name + "!",
			}
		default:
			resp := Response{Id: req.Id, Error: "Method not found: " + req.Method}
			out, _ := json.Marshal(resp)
			fmt.Println(string(out))
			continue
		}

		resp := Response{Id: req.Id, Result: result}
		out, _ := json.Marshal(resp)
		fmt.Println(string(out))
	}
}

