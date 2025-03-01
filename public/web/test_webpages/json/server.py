import http.server
import socketserver
import json
from urllib.parse import urlparse

PORT = 8080
JSON_FILE = "params.json"

class JSONRequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed_path = urlparse(self.path).path
        if parsed_path == "/get_json":
            try:
                with open(JSON_FILE, 'r') as f:
                    json_data = json.load(f)
                    json_response = json.dumps(json_data)
                    self.send_response(200)
                    self.send_header("Content-type", "application/json")
                    self.send_header("Access-Control-Allow-Origin", "*")  # Enable CORS
                    self.end_headers()
                    self.wfile.write(json_response.encode())
            except FileNotFoundError:
                self.send_response(404)
                self.end_headers()
        else:
            self.send_response(404)
            self.end_headers()

# Start the server
with socketserver.TCPServer(("", PORT), JSONRequestHandler) as httpd:
    print(f"Serving at port {PORT}")
    httpd.serve_forever()
